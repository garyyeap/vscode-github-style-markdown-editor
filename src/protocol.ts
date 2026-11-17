/**
 * Messages exchanged between the extension and the editor webview.
 */

export type EditorMode = 'readonly' | 'edit' | 'source';

export interface ThemeSettings {
    readonly colorMode: string;
    readonly lightTheme: string;
    readonly darkTheme: string;
}

export type MessageToWebview =
    | { readonly type: 'init'; readonly text: string; readonly theme: ThemeSettings; readonly mode: EditorMode }
    | { readonly type: 'update'; readonly text: string }
    | { readonly type: 'theme'; readonly theme: ThemeSettings }
    | { readonly type: 'imageSaved'; readonly id: number; readonly path?: string; readonly error?: string };

export type MessageFromWebview =
    | { readonly type: 'ready' }
    | { readonly type: 'edit'; readonly text: string }
    | { readonly type: 'openLink'; readonly href: string }
    | { readonly type: 'setMode'; readonly mode: EditorMode }
    | { readonly type: 'saveImage'; readonly id: number; readonly name: string; readonly data: Uint8Array };
