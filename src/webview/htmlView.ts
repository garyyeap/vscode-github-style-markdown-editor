import { htmlSchema } from '@milkdown/kit/preset/commonmark';
import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { $view } from '@milkdown/kit/utils';
import DOMPurify from 'dompurify';

const voidTags = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

const blockTags = /^\s*<(address|article|aside|blockquote|center|details|dialog|div|dl|figure|footer|h[1-6]|header|hr|ol|p|picture|pre|section|table|ul|video)\b/i;

/**
 * Whether the html can be rendered on its own. Inline markdown like `<b>bold</b>` is split into
 * separate nodes for the open and close tags; those are shown as source instead.
 */
function isRenderable(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed.startsWith('<') || trimmed.startsWith('<!--')) {
        return false;
    }
    const singleTag = /^<(\/?)([a-zA-Z][\w-]*)\b[^>]*>$/.exec(trimmed);
    if (singleTag) {
        return !singleTag[1] && voidTags.has(singleTag[2].toLowerCase());
    }
    return true;
}

class HtmlNodeView implements NodeView {
    public readonly dom: HTMLElement;
    private editor: HTMLTextAreaElement | undefined;

    constructor(
        private node: Node,
        private readonly view: EditorView,
        private readonly getPos: () => number | undefined,
    ) {
        this.dom = document.createElement('span');
        this.dom.className = 'html-node';
        this.dom.contentEditable = 'false';
        this.dom.addEventListener('mousedown', e => {
            // Cmd/Ctrl+click is left for opening links
            if (this.editor || e.metaKey || e.ctrlKey || !this.view.editable) {
                return;
            }
            e.preventDefault();
            this.startEditing();
        });
        this.render();
    }

    private render(): void {
        const value: string = this.node.attrs.value;
        const renderable = isRenderable(value);
        const comment = /^\s*<!--[\s\S]*-->\s*$/.test(value);
        this.dom.classList.toggle('html-node-rendered', renderable);
        this.dom.classList.toggle('html-node-comment', comment);
        this.dom.classList.toggle('html-node-source', !renderable && !comment);
        this.dom.classList.toggle('html-node-block', renderable && blockTags.test(value));
        this.dom.classList.remove('html-node-editing');
        this.dom.title = renderable ? 'Click to edit HTML' : comment ? value.trim() : '';

        if (comment) {
            // GitHub hides comments. Keep a small marker so they can still be found and edited.
            const marker = document.createElement('span');
            marker.className = 'html-node-comment-marker';
            marker.textContent = '<!-- -->';
            this.dom.replaceChildren(marker);
        } else if (renderable) {
            this.dom.innerHTML = DOMPurify.sanitize(value, { ADD_ATTR: ['align', 'target'] });
        } else {
            const code = document.createElement('code');
            code.textContent = value;
            this.dom.replaceChildren(code);
        }
    }

    private startEditing(): void {
        const editor = document.createElement('textarea');
        editor.className = 'html-node-editor';
        editor.value = this.node.attrs.value;
        editor.spellcheck = false;
        this.editor = editor;

        const resize = () => {
            editor.style.height = 'auto';
            editor.style.height = `${editor.scrollHeight}px`;
        };
        editor.addEventListener('input', resize);
        editor.addEventListener('blur', () => this.stopEditing(true));
        editor.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.stopEditing(false);
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.stopEditing(true);
            }
        });

        this.dom.classList.add('html-node-editing');
        this.dom.replaceChildren(editor);
        resize();
        editor.focus();
    }

    private stopEditing(commit: boolean): void {
        const editor = this.editor;
        if (!editor) {
            return;
        }
        this.editor = undefined;

        const pos = this.getPos();
        const value = editor.value;
        if (!commit || pos === undefined || value === this.node.attrs.value) {
            this.render();
            this.view.focus();
            return;
        }

        const tr = value.trim()
            ? this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, value })
            : this.view.state.tr.delete(pos, pos + this.node.nodeSize);
        this.view.dispatch(tr);
        this.view.focus();
    }

    update(node: Node): boolean {
        if (node.type !== this.node.type) {
            return false;
        }
        this.node = node;
        if (!this.editor) {
            this.render();
        }
        return true;
    }

    selectNode(): void {
        this.dom.classList.add('ProseMirror-selectednode');
    }

    deselectNode(): void {
        this.dom.classList.remove('ProseMirror-selectednode');
    }

    stopEvent(): boolean {
        return !!this.editor;
    }

    ignoreMutation(): boolean {
        return true;
    }
}

export const htmlView = $view(htmlSchema.node, () => (node, view, getPos) => new HtmlNodeView(node, view, getPos));
