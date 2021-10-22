import * as TOML from "@iarna/toml";
import * as fs from "fs";
import * as minimatch from "minimatch";
import * as path from "path";
import * as url from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import * as scanner from "./scanner";
import * as signature from "./signature";

// Tartufo
const tartufoConfigFilename = "tartufo.toml";
const tartufoExcludeSignaturesKey = "exclude-signatures";
const tartufoExcludePathPatternsKey = "exclude-path-patterns";
const tartufoExcludeEntropyPatterns = "exclude-entropy-patterns";

let excludedSignatures: Array<string> = [];
let excludedPathPatterns: Array<string> = [];
let excludedEntropyPatterns: Record<string, string> = {};

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// The workspace folder this server is operating on
let workspaceFolder: string | null;

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  workspaceFolder = params.rootUri;

  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  parseTartufoConfig();

  return result;
});

function parseTartufoConfig() {
  if (!workspaceFolder) {
    return;
  }

  connection.console.log(new Date() + " " + "parsing tartufo config");

  const workspacePath = url.fileURLToPath(workspaceFolder);

  const tartufoConfigFile = path.join(workspacePath, tartufoConfigFilename);

  let fileContents: string = "";

  try {
    fileContents = fs.readFileSync(tartufoConfigFile, "utf8");
  } catch (err: any) {
    connection.console.error(new Date() + " " + err);

    excludedPathPatterns = [];
    excludedSignatures = [];

    return;
  }

  if (fileContents === "") {
    return;
  }

  const data: any = TOML.parse(fileContents);

  // Parse excluded signatures if they are present in the config.
  if (
    data.tool &&
    data.tool.tartufo &&
    data.tool.tartufo[tartufoExcludeSignaturesKey]
  ) {
    const signatures: Array<string> =
      data.tool.tartufo[tartufoExcludeSignaturesKey];

    connection.console.log(new Date() + " " + "clearing excluded signatures");

    excludedSignatures = [];

    signatures.forEach((s) => {
      connection.console.log(new Date() + " " + "excluding signature: " + s);

      excludedSignatures.push(s);
    });
  } else {
    excludedSignatures = [];
  }

  // Parse excluded path patterns if they are present in the config.
  if (
    data.tool &&
    data.tool.tartufo &&
    data.tool.tartufo[tartufoExcludePathPatternsKey]
  ) {
    const patterns: Array<string> =
      data.tool.tartufo[tartufoExcludePathPatternsKey];

    connection.console.log(
      new Date() + " " + "clearing excluded path patterns"
    );

    excludedPathPatterns = [];

    patterns.forEach((s) => {
      connection.console.log(new Date() + " " + "excluding path pattern: " + s);

      excludedPathPatterns.push(s);
    });
  } else {
    excludedPathPatterns = [];
  }

  // Parse excluded entropy patterns if they are present.
  if (
    data.tool &&
    data.tool.tartufo &&
    data.tool.tartufo[tartufoExcludeEntropyPatterns]
  ) {
    const patterns: Array<string> =
      data.tool.tartufo[tartufoExcludeEntropyPatterns];

    connection.console.log(
      new Date() + " " + "clearing excluded entropy patterns"
    );

    excludedEntropyPatterns = {};

    patterns.forEach((s) => {
      if (typeof s !== "string") {
        return;
      }

      connection.console.log(
        new Date() + " " + "excluding entropy pattern: " + s
      );

      const parts = s.split("::");

      if (parts.length !== 2) {
        return;
      }

      excludedEntropyPatterns[parts[0]] = parts[1];
    });
  } else {
    excludedEntropyPatterns = {};
  }
}

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      parseTartufoConfig();
    });
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  connection.console.log(
    new Date() + " content changed: " + change.document.uri
  );

  if (shouldValidateDocument(change.document)) {
    validateTextDocument(change.document);
  } else {
    resetDiagnostics(change.document);
  }
});

function shouldValidateDocument(document: TextDocument): Boolean {
  if (!workspaceFolder) {
    return true;
  }

  const workspacePath = url.fileURLToPath(workspaceFolder);

  const documentPath = url.fileURLToPath(document.uri);

  const relativeFilename = path.relative(workspacePath, documentPath);

  let shouldValidate = true;

  excludedPathPatterns.forEach((pattern) => {
    if (minimatch(relativeFilename, pattern)) {
      connection.console.log(
        new Date() + " skipping validation for file: " + relativeFilename
      );

      shouldValidate = false;
    }
  });

  return shouldValidate;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();

  const diagnostics: Diagnostic[] = [];

  const findings = scanner.findEntropy(text);

  const lines = textDocument.getText().split("\n");

  findings.forEach((finding) => {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(finding.index),
        end: textDocument.positionAt(finding.index + finding.text.length),
      },
      message: `String has a high entropy.`,
      source: finding.reason,
      code: "high_entropy_string",
    };

    let findingSignature: string = "";
    let filename: string = "";

    if (workspaceFolder) {
      filename = path.relative(workspaceFolder, textDocument.uri);
      findingSignature = signature.createSignature(finding.text, filename);
    }

    if (hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: `String: ${finding.text}`,
        },
      ];

      if (findingSignature !== "") {
        diagnostic.relatedInformation.push({
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: `Tartufo Exclusion Signature: ${findingSignature}`,
        });
      }
    }

    let ignoreFindingBasedOnEntropyPattern = false;

    if (workspaceFolder && filename !== "") {
      for (const filenamePattern in excludedEntropyPatterns) {
        const filenameRe = new RegExp(filenamePattern);
        const filenamePatternMatch = filenameRe.test(filename);

        if (!filenamePatternMatch) {
          continue;
        }

        // We need to grab the entire line for pattern matching as of tartufo 2.8.1
        // This logic was reverted in 2.9, but is going to be added back as an optional feature in 3.0.

        // const lineNumber = textDocument.positionAt(finding.index).line;

        // if (!lines[lineNumber]) {
        //   continue;
        // }

        const signaturePattern = excludedEntropyPatterns[filenamePattern];
        const signatureRe = new RegExp(signaturePattern);
        const signaturePatternMatch = signatureRe.test(finding.text);
        // const signaturePatternMatch = signatureRe.test(lines[lineNumber]);

        if (signaturePatternMatch) {
          ignoreFindingBasedOnEntropyPattern = true;
        }
      }
    }

    if (ignoreFindingBasedOnEntropyPattern) {
      return;
    }

    const excludedSignatureIndex = excludedSignatures.indexOf(findingSignature);

    if (excludedSignatureIndex !== -1) {
      return;
    }

    diagnostics.push(diagnostic);
  });

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log(new Date() + " " + "watched files have changed");

  parseTartufoConfig();

  documents.all().forEach((document) => {
    if (shouldValidateDocument(document)) {
      validateTextDocument(document);
    } else {
      resetDiagnostics(document);
    }
  });
});

function resetDiagnostics(document: TextDocument) {
  const diagnostics: Diagnostic[] = [];
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
