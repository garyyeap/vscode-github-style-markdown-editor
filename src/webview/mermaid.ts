type Mermaid = typeof import('mermaid').default;

let mermaidPromise: Promise<Mermaid> | undefined;
let currentTheme: 'default' | 'dark' = 'default';
let renderCount = 0;

/** Rendered previews, so they can be redrawn when the theme changes */
const previews = new Map<HTMLElement, string>();

function loadMermaid(): Promise<Mermaid> {
    mermaidPromise ??= import('mermaid').then(module => module.default);
    return mermaidPromise;
}

async function draw(container: HTMLElement, source: string): Promise<void> {
    const mermaid = await loadMermaid();
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: currentTheme });
    try {
        const { svg } = await mermaid.render(`mermaid-${renderCount++}`, source);
        container.classList.remove('mermaid-error');
        container.innerHTML = svg;
    } catch (err) {
        container.classList.add('mermaid-error');
        container.textContent = err instanceof Error ? err.message : String(err);
    }
}

export function renderMermaidPreview(source: string, applyPreview: (value: HTMLElement) => void): void {
    const container = document.createElement('div');
    container.className = 'mermaid-preview';
    draw(container, source).then(() => {
        previews.set(container, source);
        applyPreview(container);
    });
}

export function setMermaidTheme(dark: boolean): void {
    const theme = dark ? 'dark' : 'default';
    if (theme === currentTheme) {
        return;
    }
    currentTheme = theme;
    for (const [container, source] of previews) {
        if (container.isConnected) {
            draw(container, source);
        } else {
            previews.delete(container);
        }
    }
}
