import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageserver/node";

import * as path from "path";

import { TextDocument } from "vscode-languageserver-textdocument";

import * as scanner from "./scanner";

import * as signature from "./signature";
import * as fs from "fs";
import * as url from "url";
import * as toml from "toml";
import * as util from "util";

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

let excludedSignatures: Array<string> = [];

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

  if (workspaceFolder) {
    const workspacePath = url.fileURLToPath(workspaceFolder);
    const tartufoConfigFilename = "tartufo.toml";
    const tartufoConfigFile = path.join(workspacePath, tartufoConfigFilename);

    let fileContents: string = "";

    try {
      fileContents = fs.readFileSync(tartufoConfigFile, "utf8");
    } catch (err: any) {
      connection.console.error(err);
    }

    if (fileContents !== "") {
      const data = toml.parse(fileContents);
      if (
        data.tool &&
        data.tool.tartufo &&
        data.tool.tartufo["exclude-signatures"]
      ) {
        const signatures: Array<string> =
          data.tool.tartufo["exclude-signatures"];

        excludedSignatures = [];

        signatures.forEach((s) => {
          excludedSignatures.push(s);
        });
      }
    }
  }

  return result;
});

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
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

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
          message: `Signature: ${findingSignature}`,
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
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
