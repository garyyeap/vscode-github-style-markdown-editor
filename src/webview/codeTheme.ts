import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Uses the GitHub "prettylights" variables defined by the GitHub markdown themes
const syntax = (name: string) => `var(--color-prettylights-syntax-${name})`;

export const githubCodeTheme = [
    EditorView.theme({
        '&': {
            color: 'var(--fgColor-default)',
            backgroundColor: 'transparent',
            fontSize: '85%',
        },
        '.cm-content': {
            caretColor: 'var(--fgColor-accent)',
            fontFamily: 'var(--fontStack-monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
        },
        '.cm-scroller': {
            fontFamily: 'inherit',
            lineHeight: '1.45',
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fgColor-accent)', borderLeftWidth: '2px' },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: 'var(--selection-bgColor, rgba(56, 139, 253, 0.4))',
        },
        '.cm-gutters': {
            backgroundColor: 'transparent',
            color: 'var(--fgColor-muted)',
            border: 'none',
        },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
        '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
            backgroundColor: 'var(--bgColor-neutral-muted)',
            outline: 'none',
        },
    }),
    syntaxHighlighting(HighlightStyle.define([
        { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: syntax('comment') },
        { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: syntax('keyword') },
        { tag: [t.string, t.special(t.string), t.character, t.docString], color: syntax('string') },
        { tag: [t.regexp, t.escape], color: syntax('string-regexp') },
        { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name), t.standard(t.name), t.propertyName, t.attributeName, t.unit], color: syntax('constant') },
        { tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.typeName, t.namespace, t.macroName], color: syntax('entity') },
        { tag: [t.tagName], color: syntax('entity-tag') },
        { tag: [t.definition(t.variableName), t.labelName], color: syntax('variable') },
        { tag: [t.meta, t.processingInstruction, t.annotation], color: syntax('constant') },
        { tag: t.heading, color: syntax('markup-heading'), fontWeight: 'bold' },
        { tag: t.list, color: syntax('markup-list') },
        { tag: t.emphasis, color: syntax('markup-italic'), fontStyle: 'italic' },
        { tag: t.strong, color: syntax('markup-bold'), fontWeight: 'bold' },
        { tag: t.strikethrough, textDecoration: 'line-through' },
        { tag: [t.link, t.url], color: syntax('constant-other-reference-link'), textDecoration: 'underline' },
        { tag: t.inserted, color: syntax('markup-inserted-text'), backgroundColor: syntax('markup-inserted-bg') },
        { tag: t.deleted, color: syntax('markup-deleted-text'), backgroundColor: syntax('markup-deleted-bg') },
        { tag: t.changed, color: syntax('markup-changed-text'), backgroundColor: syntax('markup-changed-bg') },
        { tag: t.invalid, color: syntax('invalid-illegal-text'), backgroundColor: syntax('invalid-illegal-bg') },
    ])),
];
