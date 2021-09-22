import * as path from "path";
import { CodeActionKind, ExtensionContext, languages, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import * as vscode from "vscode";

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
    languages.registerCodeActionsProvider("*", new Emojizer(), {
      providedCodeActionKinds: [CodeActionKind.QuickFix],
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider("*", new Emojinfo(), {
      providedCodeActionKinds: Emojinfo.providedCodeActionKinds,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND, () => console.log("COMMAND"))
  );
}

const COMMAND = "code-actions-sample.command";

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }

  return client.stop();
}

export class Emojizer implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | undefined {
    if (!this.isAtStartOfSmiley(document, range)) {
      return;
    }

    const replaceWithSmileyCatFix = this.createFix(document, range, "😺");

    const replaceWithSmileyFix = this.createFix(document, range, "😀");
    // Marking a single fix as `preferred` means that users can apply it with a
    // single keyboard shortcut using the `Auto Fix` command.
    replaceWithSmileyFix.isPreferred = true;

    const replaceWithSmileyHankyFix = this.createFix(document, range, "💩");

    const commandAction = this.createCommand();

    return [
      replaceWithSmileyCatFix,
      replaceWithSmileyFix,
      replaceWithSmileyHankyFix,
      commandAction,
    ];
  }

  private isAtStartOfSmiley(
    document: vscode.TextDocument,
    range: vscode.Range
  ) {
    const start = range.start;
    const line = document.lineAt(start.line);
    return (
      line.text[start.character] === ":" &&
      line.text[start.character + 1] === ")"
    );
  }

  private createFix(
    document: vscode.TextDocument,
    range: vscode.Range,
    emoji: string
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `Convert to ${emoji}`,
      vscode.CodeActionKind.QuickFix
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(
      document.uri,
      new vscode.Range(range.start, range.start.translate(0, 2)),
      emoji
    );
    return fix;
  }

  private createCommand(): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Learn more...",
      vscode.CodeActionKind.Empty
    );
    action.command = {
      command: COMMAND,
      title: "Learn more about emojis",
      tooltip: "This will open the unicode emoji page.",
    };
    return action;
  }
}

export const EMOJI_MENTION = "emoji_mention";

/**
 * Provides code actions corresponding to diagnostic problems.
 */
export class Emojinfo implements vscode.CodeActionProvider {
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
      .filter((diagnostic) => diagnostic.code === EMOJI_MENTION)
      .map((diagnostic) => this.createCommandCodeAction(diagnostic));
  }

  private createCommandCodeAction(
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Learn more...",
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: COMMAND,
      title: "Learn more about emojis",
      tooltip: "This will open the unicode emoji page.",
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }
}
