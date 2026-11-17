import * as vscode from 'vscode';
import { EditorModes } from './editorModes';
import { GitHubMarkdownEditorProvider, reopenWith } from './editorProvider';
import { EditorMode } from './protocol';

export function activate(context: vscode.ExtensionContext) {
    const modes = new EditorModes(context.workspaceState);
    context.subscriptions.push(GitHubMarkdownEditorProvider.register(context, modes));

    const openEditor = async (uri: vscode.Uri | undefined, mode: EditorMode) => {
        const target = uri instanceof vscode.Uri ? uri : vscode.window.activeTextEditor?.document.uri;
        if (target) {
            await modes.set(target, mode);
            await reopenWith(target, GitHubMarkdownEditorProvider.viewType);
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('githubMarkdown.openEditor', (uri?: vscode.Uri) => openEditor(uri, 'edit')),
        vscode.commands.registerCommand('githubMarkdown.openEditorReadonly', (uri?: vscode.Uri) => openEditor(uri, 'readonly')),
    );
}

export function deactivate() { }
