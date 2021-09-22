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

let excludedSignatures: Array<string> = [];
let excludedPathPatterns: Array<string> = [];

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

    if (workspaceFolder) {
      const filename = path.relative(workspaceFolder, textDocument.uri);
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

    const excludeIndex = excludedSignatures.indexOf(findingSignature);

    if (excludeIndex === -1) {
      diagnostics.push(diagnostic);
    }
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
