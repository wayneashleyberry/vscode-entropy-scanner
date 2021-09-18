import * as vscode from "vscode";
import { DecorationRangeBehavior } from "vscode";
import * as scanner from "./scanner";

const channel = vscode.window.createOutputChannel("Entropy Scanner");

export function activate(context: vscode.ExtensionContext) {
  let activeEditor = vscode.window.activeTextEditor;
  let timeout: NodeJS.Timer | undefined = undefined;

  const ts = new Date();
  channel.appendLine(`${ts} Extension activated`);

  const decorationType = vscode.window.createTextEditorDecorationType({
    textDecoration: "wavy underline",
    color: "pink",
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  });

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    timeout = setTimeout(updateDecorations, 1000);
  }

  function updateDecorations() {
    if (!activeEditor) {
      return;
    }

    let rangesToDecorate: vscode.DecorationOptions[] = [];

    findEntropy(rangesToDecorate);

    activeEditor.setDecorations(decorationType, rangesToDecorate);
  }

  function findEntropy(rangesToDecorate: vscode.DecorationOptions[] = []) {
    if (!activeEditor) {
      return;
    }

    const text = activeEditor.document.getText();

    if (text === "") {
      return;
    }

    const findings = scanner.findEntropy(text);

    findings.forEach((finding) => {
      if (!activeEditor) {
        return;
      }

      const ts = new Date();
      const filename = activeEditor.document.fileName;

      channel.appendLine(
        `${ts} Found high entropy string ${filename}:${finding}`
      );

      const match = text.indexOf(finding);
      const startPos = activeEditor.document.positionAt(match);
      const endPos = activeEditor.document.positionAt(match + finding.length);

      const decoration = {
        range: new vscode.Range(startPos, endPos),
        hoverMessage: "This string has a high entropy.",
      };

      rangesToDecorate.push(decoration);
    });
  }
}

export function deactivate() {}
