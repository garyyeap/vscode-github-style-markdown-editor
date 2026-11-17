import * as vscode from 'vscode';
import { EditorModes } from './editorModes';
import { MessageFromWebview, MessageToWebview, ThemeSettings } from './protocol';

const themeConfigSection = 'githubStyleMarkdownEditor';

// Settings of the Markdown Preview Github Styling extension, used when ours are not set
const legacyThemeConfigSection = 'markdown-preview-github-styles';

const githubThemeStyles = [
    'base.css',
    'github-markdown-theme-base.css',
    'github-markdown-light.css',
    'github-markdown-light-colorblind.css',
    'github-markdown-light-tritanopia.css',
    'github-markdown-light-high-contrast.css',
    'github-markdown-dark.css',
    'github-markdown-dark-dimmed.css',
    'github-markdown-dark-colorblind.css',
    'github-markdown-dark-tritanopia.css',
    'github-markdown-dark-high-contrast.css',
];

export class GitHubMarkdownEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'githubMarkdown.editor';

    public static register(context: vscode.ExtensionContext, modes: EditorModes): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            GitHubMarkdownEditorProvider.viewType,
            new GitHubMarkdownEditorProvider(context, modes),
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: true,
            });
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly modes: EditorModes,
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const webview = webviewPanel.webview;
        const styles = getEditorStyles(this.context.extensionUri, document);

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                getDocumentFolder(document),
                ...(vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri),
                ...styles.roots,
            ],
        };
        webview.html = this.getHtml(webview, document, styles.styles);

        const post = (message: MessageToWebview) => webview.postMessage(message);

        // Edits that originate in the webview are echoed back by onDidChangeTextDocument.
        // Track them so we only push changes made elsewhere (text editor, git, undo).
        let pendingWebviewEdits = 0;
        let editQueue = Promise.resolve();

        const disposables: vscode.Disposable[] = [];

        disposables.push(vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length || pendingWebviewEdits > 0) {
                return;
            }
            post({ type: 'update', text: document.getText() });
        }));

        disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(themeConfigSection) || e.affectsConfiguration(legacyThemeConfigSection)) {
                post({ type: 'theme', theme: getThemeSettings() });
            }
        }));

        disposables.push(webview.onDidReceiveMessage(async (message: MessageFromWebview) => {
            switch (message.type) {
                case 'ready':
                    post({ type: 'init', text: document.getText(), theme: getThemeSettings(), mode: this.modes.get(document.uri) });
                    break;

                case 'edit':
                    pendingWebviewEdits++;
                    editQueue = editQueue
                        .then(() => applyText(document, message.text))
                        .catch(err => console.error(err))
                        .finally(() => { pendingWebviewEdits--; });
                    break;

                case 'openLink':
                    openLink(document, message.href);
                    break;

                case 'setMode':
                    this.modes.set(document.uri, message.mode);
                    break;

                case 'saveImage':
                    try {
                        const path = await saveImage(document, message.name, message.data);
                        post({ type: 'imageSaved', id: message.id, path });
                    } catch (err) {
                        vscode.window.showErrorMessage(`Could not save image: ${err}`);
                        post({ type: 'imageSaved', id: message.id, error: String(err) });
                    }
                    break;
            }
        }));

        webviewPanel.onDidDispose(() => {
            vscode.Disposable.from(...disposables).dispose();
        });
    }

    private getHtml(webview: vscode.Webview, document: vscode.TextDocument, styles: vscode.Uri[]): string {
        const nonce = getNonce();
        const dist = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'main.css'));
        const baseUri = webview.asWebviewUri(getDocumentFolder(document));
        const csp = webview.cspSource;

        const styleLinks = styles
            .map(uri => `<link rel="stylesheet" type="text/css" href="${escapeAttribute(webview.asWebviewUri(uri).toString())}">`)
            .join('\n');

        // Mirror the DOM structure of the markdown preview so that preview themes apply unchanged
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} https: data: blob:; media-src ${csp} https: data:; style-src ${csp} 'unsafe-inline'; font-src ${csp} data:; script-src 'nonce-${nonce}' ${csp}; worker-src ${csp} blob:;">
    <base href="${escapeAttribute(baseUri.toString())}/">
    ${styleLinks}
    <link rel="stylesheet" type="text/css" href="${escapeAttribute(styleUri.toString())}">
    <title>GitHub Style Markdown Editor</title>
</head>
<body class="vscode-body">
    <div class="markdown-body">
        <div id="github-body" class="github-markdown-body" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">
            <div class="github-markdown-content">
                <div id="editor"></div>
                <div id="source"></div>
            </div>
        </div>
    </div>
    <script type="module" nonce="${nonce}" src="${escapeAttribute(scriptUri.toString())}"></script>
</body>
</html>`;
    }
}

/**
 * The bundled GitHub theme, plus the user's `markdown.styles` setting.
 */
function getEditorStyles(extensionUri: vscode.Uri, document: vscode.TextDocument): { styles: vscode.Uri[]; roots: vscode.Uri[] } {
    const styles = githubThemeStyles.map(file => vscode.Uri.joinPath(extensionUri, 'media', 'github-styles', file));
    const roots: vscode.Uri[] = [];

    const userStyles = vscode.workspace.getConfiguration('markdown', document.uri).get<string[]>('styles', []);
    for (const style of userStyles) {
        if (/^https?:/i.test(style)) {
            continue; // Remote stylesheets are blocked by the webview CSP
        }
        if (style.startsWith('/') || /^[a-z]:[\\/]/i.test(style)) {
            const uri = vscode.Uri.file(style);
            styles.push(uri);
            roots.push(vscode.Uri.joinPath(uri, '..'));
            continue;
        }
        const folder = vscode.workspace.getWorkspaceFolder(document.uri)?.uri ?? getDocumentFolder(document);
        styles.push(vscode.Uri.joinPath(folder, style));
    }

    return { styles, roots };
}

function getThemeSettings(): ThemeSettings {
    const settings = vscode.workspace.getConfiguration(themeConfigSection, null);
    const legacySettings = vscode.workspace.getConfiguration(legacyThemeConfigSection, null);
    const get = (key: string, defaultValue: string): string => {
        const inspected = settings.inspect<string>(key);
        const value = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
        return value ?? legacySettings.get<string>(key) ?? defaultValue;
    };
    return {
        colorMode: get('colorTheme', 'auto'),
        lightTheme: get('lightTheme', 'light'),
        darkTheme: get('darkTheme', 'dark'),
    };
}

async function applyText(document: vscode.TextDocument, text: string): Promise<void> {
    if (document.eol === vscode.EndOfLine.CRLF) {
        text = text.replace(/\r?\n/g, '\r\n');
    }

    // Only replace the span that changed so that undo and text editor cursors stay sensible
    const current = document.getText();
    if (current === text) {
        return;
    }

    let start = 0;
    while (start < current.length && start < text.length && current[start] === text[start]) {
        start++;
    }

    let currentEnd = current.length;
    let textEnd = text.length;
    while (currentEnd > start && textEnd > start && current[currentEnd - 1] === text[textEnd - 1]) {
        currentEnd--;
        textEnd--;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(start), document.positionAt(currentEnd)),
        text.slice(start, textEnd));
    await vscode.workspace.applyEdit(edit);
}

/**
 * Switch the text editor tab for `uri` in the active group to another editor in place, instead of opening a second tab.
 */
export async function reopenWith(uri: vscode.Uri, viewType: string): Promise<void> {
    const column = vscode.window.tabGroups.activeTabGroup.viewColumn;
    await vscode.commands.executeCommand('vscode.openWith', uri, viewType, column);

    // The text document stays open in the new tab, so closing never prompts to save
    const group = vscode.window.tabGroups.all.find(group => group.viewColumn === column);
    const textTabs = group?.tabs.filter(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()) ?? [];
    if (textTabs.length) {
        await vscode.window.tabGroups.close(textTabs);
    }
}

function openLink(document: vscode.TextDocument, href: string): void {
    if (!href || href.startsWith('#')) {
        return;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        vscode.env.openExternal(vscode.Uri.parse(href));
        return;
    }

    const path = decodeURIComponent(href.replace(/[?#].*$/, ''));
    const target = path.startsWith('/')
        ? vscode.Uri.joinPath(vscode.workspace.getWorkspaceFolder(document.uri)?.uri ?? getDocumentFolder(document), path)
        : vscode.Uri.joinPath(getDocumentFolder(document), path);
    vscode.commands.executeCommand('vscode.open', target);
}

async function saveImage(document: vscode.TextDocument, name: string, data: Uint8Array): Promise<string> {
    if (document.isUntitled) {
        throw new Error('Save the document before adding images');
    }

    const folder = getDocumentFolder(document);
    const safeName = name.replace(/[\\/:*?"<>|]/g, '-') || 'image.png';
    const dot = safeName.lastIndexOf('.');
    const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
    const ext = dot > 0 ? safeName.slice(dot) : '';

    for (let i = 0; ; i++) {
        const fileName = i === 0 ? safeName : `${stem}-${i}${ext}`;
        const target = vscode.Uri.joinPath(folder, fileName);
        try {
            await vscode.workspace.fs.stat(target);
        } catch {
            await vscode.workspace.fs.writeFile(target, data);
            return encodeURI(fileName);
        }
    }
}

function getDocumentFolder(document: vscode.TextDocument): vscode.Uri {
    return vscode.Uri.joinPath(document.uri, '..');
}

function escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
