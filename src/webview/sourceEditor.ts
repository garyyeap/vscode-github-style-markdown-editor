import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { githubCodeTheme } from './codeTheme';

const sourceTheme = EditorView.theme({
    '&': {
        fontSize: 'var(--vscode-editor-font-size, 13px)',
    },
    '.cm-content, .cm-scroller': {
        fontFamily: 'var(--vscode-editor-font-family, var(--fontStack-monospace, monospace))',
        lineHeight: '1.6',
    },
    '.cm-gutters': {
        paddingRight: '8px',
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--bgColor-neutral-muted, transparent)',
    },
    '.cm-foldGutter span': {
        color: 'var(--fgColor-muted)',
    },
});

/**
 * Plain text editor for the raw markdown, shown in source mode.
 */
export class SourceEditor {
    private readonly view: EditorView;
    private applyingUpdate = false;

    constructor(parent: HTMLElement, onChange: (text: string) => void) {
        this.view = new EditorView({
            parent,
            state: EditorState.create({
                extensions: [
                    basicSetup,
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    EditorView.lineWrapping,
                    githubCodeTheme,
                    sourceTheme,
                    EditorView.updateListener.of(update => {
                        if (update.docChanged && !this.applyingUpdate) {
                            onChange(update.state.doc.toString());
                        }
                    }),
                ],
            }),
        });
    }

    public get text(): string {
        return this.view.state.doc.toString();
    }

    /** Replace the content, touching only the changed span so the cursor stays put */
    public setText(text: string): void {
        const current = this.text;
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

        this.applyingUpdate = true;
        try {
            this.view.dispatch({ changes: { from: start, to: currentEnd, insert: text.slice(start, textEnd) } });
        } finally {
            this.applyingUpdate = false;
        }
    }

    public focus(): void {
        this.view.focus();
    }
}
