import { Crepe } from '@milkdown/crepe';
import { replaceAll } from '@milkdown/kit/utils';
import type { EditorMode, MessageFromWebview, MessageToWebview, ThemeSettings } from '../protocol';
import { githubCodeTheme } from './codeTheme';
import { htmlView } from './htmlView';
import { remarkMergeInlineHtml } from './mergeInlineHtml';
import { renderMermaidPreview, setMermaidTheme } from './mermaid';
import { SourceEditor } from './sourceEditor';
import './style.css';

declare function acquireVsCodeApi(): { postMessage(message: MessageFromWebview): void };

const vscode = acquireVsCodeApi();
const themeRoot = document.getElementById('github-body')!;
const editorRoot = document.getElementById('editor')!;
const sourceRoot = document.getElementById('source')!;

let crepe: Crepe | undefined;
let sourceEditor: SourceEditor | undefined;
let mode: EditorMode = 'edit';

/** The markdown last synced with the document. Used to skip echoes and no-op updates. */
let syncedMarkdown = '';

/** Latest text of the document, and the text the rich editor was last loaded from or produced */
let documentText = '';
let crepeText = '';

function postEdit(text: string): void {
    documentText = text;
    vscode.postMessage({ type: 'edit', text });
}

// Source edits are sent in small batches; flushed before leaving source mode
let pendingSourceEdit: ReturnType<typeof setTimeout> | undefined;

function flushSourceEdit(): void {
    if (pendingSourceEdit !== undefined && sourceEditor) {
        clearTimeout(pendingSourceEdit);
        pendingSourceEdit = undefined;
        postEdit(sourceEditor.text);
    }
}

function getSourceEditor(): SourceEditor {
    sourceEditor ??= new SourceEditor(sourceRoot, () => {
        clearTimeout(pendingSourceEdit);
        pendingSourceEdit = setTimeout(flushSourceEdit, 150);
    });
    return sourceEditor;
}

let nextImageId = 0;
const pendingImages = new Map<number, { resolve: (path: string) => void; reject: (err: Error) => void }>();

async function uploadImage(file: File): Promise<string> {
    const id = nextImageId++;
    const data = new Uint8Array(await file.arrayBuffer());
    const result = new Promise<string>((resolve, reject) => pendingImages.set(id, { resolve, reject }));
    vscode.postMessage({ type: 'saveImage', id, name: file.name, data });
    return result;
}

async function createEditor(text: string, initialMode: EditorMode): Promise<void> {
    crepe = new Crepe({
        root: editorRoot,
        defaultValue: text,
        features: {
            [Crepe.Feature.AI]: false,
            [Crepe.Feature.TopBar]: false,
        },
        featureConfigs: {
            [Crepe.Feature.CodeMirror]: {
                theme: githubCodeTheme,
                renderPreview: (language, content, applyPreview) => {
                    if (language.toLowerCase() === 'mermaid' && content.trim()) {
                        renderMermaidPreview(content, applyPreview);
                        return undefined;
                    }
                    return null;
                },
            },
            [Crepe.Feature.ImageBlock]: {
                onUpload: uploadImage,
                inlineOnUpload: uploadImage,
                blockOnUpload: uploadImage,
            },
            [Crepe.Feature.Placeholder]: {
                text: 'Type / for commands',
            },
        },
    });

    crepe.editor.use(remarkMergeInlineHtml).use(htmlView);

    crepe.on(listener => {
        listener.markdownUpdated((_ctx, markdown) => {
            if (markdown === syncedMarkdown) {
                return;
            }
            syncedMarkdown = markdown;
            crepeText = markdown;
            postEdit(markdown);
        });
    });

    await crepe.create();
    syncedMarkdown = crepe.getMarkdown();
    crepeText = text;
    setMode(initialMode);
}

const lockIcon = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/><path d="M8 9.75v1.5"/></svg>';
const sourceIcon = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4.5L2 8l3.5 3.5"/><path d="M10.5 4.5L14 8l-3.5 3.5"/></svg>';
const pencilIcon = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M10.5 2.5l3 3-8 8H2.5v-3z"/><path d="M9 4l3 3"/></svg>';

/** Floating mode switch, like VS Code's built-in Markdown Editor, plus markdown source */
const modeSwitch = document.createElement('div');
modeSwitch.className = 'mode-switch';
modeSwitch.setAttribute('role', 'radiogroup');
modeSwitch.setAttribute('aria-label', 'Editor mode');
const modeButtons = ([['readonly', 'Read only', lockIcon], ['edit', 'Edit', pencilIcon], ['source', 'Markdown source', sourceIcon]] as const).map(([buttonMode, label, icon]) => {
    if (buttonMode === 'source') {
        const divider = document.createElement('span');
        divider.className = 'mode-switch-divider';
        modeSwitch.append(divider);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    button.addEventListener('click', () => {
        if (buttonMode !== mode) {
            setMode(buttonMode);
            vscode.postMessage({ type: 'setMode', mode: buttonMode });
        }
    });
    modeSwitch.append(button);
    return { button, mode: buttonMode };
});
document.body.append(modeSwitch);

function setMode(newMode: EditorMode): void {
    if (mode === 'source' && newMode !== 'source') {
        flushSourceEdit();
    }
    mode = newMode;

    if (mode === 'source') {
        const editor = getSourceEditor();
        editor.setText(documentText);
        editor.focus();
    } else {
        if (crepeText !== documentText) {
            updateEditor(documentText);
        }
        crepe?.setReadonly(mode === 'readonly');
    }

    document.body.classList.toggle('editor-readonly', mode === 'readonly');
    document.body.classList.toggle('editor-source', mode === 'source');
    for (const { button, mode: buttonMode } of modeButtons) {
        button.classList.toggle('active', buttonMode === mode);
        button.setAttribute('aria-checked', String(buttonMode === mode));
    }
}

function updateEditor(text: string): void {
    if (!crepe) {
        return;
    }
    crepe.editor.action(replaceAll(text, true));
    syncedMarkdown = crepe.getMarkdown();
    crepeText = text;
}

function applyTheme(theme: ThemeSettings): void {
    themeRoot.dataset.colorMode = theme.colorMode;
    themeRoot.dataset.lightTheme = theme.lightTheme;
    themeRoot.dataset.darkTheme = theme.darkTheme;
    updateDarkMode();
}

/** Resolve the effective GitHub theme the same way the preview stylesheets do */
function updateDarkMode(): void {
    const { colorMode, lightTheme = 'light', darkTheme = 'dark' } = themeRoot.dataset;
    let useDarkSlot: boolean;
    switch (colorMode) {
        case 'light': useDarkSlot = false; break;
        case 'dark': useDarkSlot = true; break;
        case 'system': useDarkSlot = window.matchMedia('(prefers-color-scheme: dark)').matches; break;
        default: useDarkSlot = !document.body.classList.contains('vscode-light') && !document.body.classList.contains('vscode-high-contrast-light'); break;
    }
    const dark = (useDarkSlot ? darkTheme : lightTheme).startsWith('dark');
    document.body.classList.toggle('github-editor-dark', dark);
    setMermaidTheme(dark);
}

// VS Code switches these classes on the body when the color theme changes
new MutationObserver(updateDarkMode).observe(document.body, { attributes: true, attributeFilter: ['class'] });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateDarkMode);

// Never let the webview itself navigate. Cmd/Ctrl+click opens links like in the text editor.
document.addEventListener('click', e => {
    const link = (e.target as HTMLElement | null)?.closest?.('a[href]');
    if (!link) {
        return;
    }
    e.preventDefault();
    const href = link.getAttribute('href')!;
    if (href.startsWith('#')) {
        document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    const editable = link.closest('[contenteditable="true"]');
    if (!editable || e.metaKey || e.ctrlKey) {
        vscode.postMessage({ type: 'openLink', href });
    }
}, true);

window.addEventListener('message', (e: MessageEvent<MessageToWebview>) => {
    const message = e.data;
    switch (message.type) {
        case 'init':
            documentText = message.text;
            applyTheme(message.theme);
            createEditor(message.text, message.mode);
            break;

        case 'update':
            documentText = message.text;
            if (mode === 'source') {
                sourceEditor?.setText(message.text);
            } else {
                updateEditor(message.text);
            }
            break;

        case 'theme':
            applyTheme(message.theme);
            break;

        case 'imageSaved': {
            const pending = pendingImages.get(message.id);
            pendingImages.delete(message.id);
            if (message.path !== undefined) {
                pending?.resolve(message.path);
            } else {
                pending?.reject(new Error(message.error));
            }
            break;
        }
    }
});

vscode.postMessage({ type: 'ready' });
