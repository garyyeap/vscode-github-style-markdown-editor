import * as vscode from 'vscode';
import { EditorMode } from './protocol';

const storageKey = 'githubMarkdown.documentModes';

/**
 * Remembers the mode (read only, edit or markdown source) each document was last viewed in.
 */
export class EditorModes {
    constructor(
        private readonly memento: vscode.Memento,
    ) { }

    public get(uri: vscode.Uri): EditorMode {
        return this.memento.get<Record<string, EditorMode>>(storageKey, {})[uri.toString()] ?? 'edit';
    }

    public async set(uri: vscode.Uri, mode: EditorMode): Promise<void> {
        const { [uri.toString()]: _previous, ...others } = this.memento.get<Record<string, EditorMode>>(storageKey, {});
        await this.memento.update(storageKey, mode === 'edit' ? others : { ...others, [uri.toString()]: mode });
    }
}
