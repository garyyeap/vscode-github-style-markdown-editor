import { $remark } from '@milkdown/kit/utils';

interface MdNode {
    type: string;
    value?: string;
    children?: MdNode[];
    position?: { start: { offset?: number }; end: { offset?: number } };
}

const openTag = /^<([a-zA-Z][\w-]*)\b[^>]*>$/;
const voidTags = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

/**
 * Markdown parses inline html such as `<kbd>Cmd</kbd>` into separate nodes for the open tag, the
 * text and the close tag. Merge each matched pair back into one html node holding the original
 * source, so it can be rendered as a whole and is written back unchanged.
 */
function mergeChildren(parent: MdNode, source: string): void {
    const children = parent.children;
    if (!children) {
        return;
    }

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tag = child.type === 'html' && !child.value?.endsWith('/>') ? openTag.exec(child.value ?? '')?.[1] : undefined;
        if (!tag || voidTags.has(tag.toLowerCase())) {
            mergeChildren(child, source);
            continue;
        }

        const sameOpen = new RegExp(`^<${tag}\\b[^>]*>$`, 'i');
        const close = new RegExp(`^</${tag}\\s*>$`, 'i');
        let depth = 0;
        for (let j = i + 1; j < children.length; j++) {
            const candidate = children[j];
            if (candidate.type !== 'html') {
                continue;
            }
            if (sameOpen.test(candidate.value ?? '')) {
                depth++;
            } else if (close.test(candidate.value ?? '') && depth-- === 0) {
                const start = child.position?.start.offset;
                const end = candidate.position?.end.offset;
                if (start !== undefined && end !== undefined) {
                    children.splice(i, j - i + 1, {
                        type: 'html',
                        value: source.slice(start, end),
                        position: { start: child.position!.start, end: candidate.position!.end },
                    });
                }
                break;
            }
        }
    }
}

export const remarkMergeInlineHtml = $remark('remarkMergeInlineHtml', () => () => (tree: unknown, file: unknown) => {
    mergeChildren(tree as MdNode, String(file));
});
