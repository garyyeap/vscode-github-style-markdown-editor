A GitHub style WYSIWYG markdown editor for VS Code.

> This is a fork of [GitHub Markdown Preview](https://github.com/mjbvz/vscode-github-markdown-preview) by [Matt Bierner](https://github.com/mjbvz). See [Credits](#credits).

# Features

- Edit markdown files in place, rendered the way GitHub shows them. Light, dark, dimmed, high contrast and colorblind GitHub themes are built in.
- Type `/` for a block menu. Blocks can be dragged by their handle.
- Supports tables, task lists, syntax highlighted code blocks, live `mermaid` diagrams, and `$math$` / `$$math$$` via KaTeX.
- Raw HTML (such as `<p align="center">`, `<img>` and `<kbd>`) is rendered like on GitHub. Click it to edit the source; Cmd+Enter or clicking away applies the change, and Escape cancels.
- The switch in the top-right corner has three modes: read only (lock), edit (pencil), and markdown source (`</>`). In read-only mode, links open with a plain click. Source mode edits the raw markdown in the same tab. The mode is remembered for each file.
- Cmd/Ctrl+click opens a link. Pasted or uploaded images are saved next to the markdown file.
- Files are saved as plain Markdown. After you edit in the rich view, the whole document is written back in a normalized format, so some formatting may change (for example, list bullet characters or blank lines). Edits in source mode are kept exactly as typed.

# Usage

Open a markdown file and click the pencil icon in its title bar, run **Markdown: Open in GitHub Style Markdown Editor**, or use **Reopen Editor With... → Editor - GitHub Style Markdown Editor**. To make it the default, pick **Configure default editor for '*.md'...** from that menu.

# Settings

- `githubStyleMarkdownEditor.colorTheme`: `auto` (match VS Code), `system`, `light` or `dark`.
- `githubStyleMarkdownEditor.lightTheme` / `githubStyleMarkdownEditor.darkTheme`: the GitHub theme for each mode, such as `light`, `dark` or `dark_dimmed`.
- `markdown.styles`: extra stylesheets, applied after the GitHub theme.

If these are not set, the `markdown-preview-github-styles.*` settings from [Markdown Preview GitHub Styling](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-preview-github-styles) are used.

# Credits

- This project is forked from [vscode-github-markdown-preview](https://github.com/mjbvz/vscode-github-markdown-preview) by [Matt Bierner](https://github.com/mjbvz).
- The GitHub theme stylesheets in `media/github-styles` come from [Markdown Preview GitHub Styling](https://github.com/mjbvz/vscode-markdown-preview-github-styles), also by Matt Bierner (MIT).
- The editor is built on [Milkdown](https://milkdown.dev) (Crepe), [CodeMirror](https://codemirror.net), [Mermaid](https://mermaid.js.org), [KaTeX](https://katex.org) and [DOMPurify](https://github.com/cure53/DOMPurify).
