import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file" }],
    synchronize: {
      // Notify the server about file changes to tartufo.toml contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/tartufo.toml"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "entropyScanner",
    "Entropy Scanner",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  // Setup code actions.

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "*",
      new HighEntropyStringInfo(),
      {
        providedCodeActionKinds: HighEntropyStringInfo.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXCLUDE_SIGNATURE_COMMAND,
      (signature: string) => {
        console.log(new Date() + " exclude signature: " + signature);
      }
    )
  );
}

const EXCLUDE_SIGNATURE_COMMAND = "entropy-scanner.exclude-signature";

/**
 * Provides code actions corresponding to diagnostic problems.
 */
export class HighEntropyStringInfo implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    // for each diagnostic entry that has the matching `code`, create a code action command
    return context.diagnostics
      .filter((diagnostic) => diagnostic.code === "high_entropy_string")
      .map((diagnostic) => this.createCommandCodeAction(document, diagnostic));
  }

  private createCommandCodeAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Exclude signature from entropy scanner",
      vscode.CodeActionKind.QuickFix
    );
    const finding: string = document.getText(diagnostic.range);
    let signature: string = "";

    diagnostic.relatedInformation.forEach((rel) => {
      if (rel.message.startsWith("Tartufo")) {
        const parts = rel.message.split(" ");
        signature = parts[parts.length - 1];
      }
    });

    action.command = {
      command: "COMMAND",
      title: "Learn more about emojis",
      tooltip: "This will open the unicode emoji page.",
      arguments: [signature],
    };

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    return action;
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }

  return client.stop();
}
