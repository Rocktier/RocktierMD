export type ViewMode = "split" | "editor" | "preview";

export interface MarkdownDocument {
  path: string | null;
  content: string;
  modified: boolean;
}

export const WELCOME_DOCUMENT = `# Welcome to Rocktier Markdown

A fast, private Markdown editor. Your files stay on your machine — nothing is uploaded, ever.

## Start Where You Are

This document is the demo: it renders while you type. Switch views from the toolbar — editor only, split, or preview. Scroll one side, and the other follows.

Type \`# \` for a heading, \`## \` for a subheading. Every heading lands in the sidebar outline; click one to jump straight to it.

## CommonMark + GFM, Rendered

**Bold**, *italic*, ~~strikethrough~~, links, tables and task lists.

- [x] Tables and task lists
- [x] Syntax highlighting in 20 languages
- [x] Math, typeset by KaTeX

### Code

\`\`\`rust
fn main() {
    let message = "Hello, Rocktier!";
    println!("{message}");
}
\`\`\`

### Math

Inline math sits inside a sentence — the area of a circle is $A = \\pi r^2$ — or takes a line of its own:

$$
e^{i\\pi} + 1 = 0
$$

### Shortcuts

| Action | Shortcut |
| --- | --- |
| Save | \`Ctrl/Cmd + S\` |
| Find & replace | \`Ctrl/Cmd + F\` |
| Export PDF | \`Ctrl/Cmd + Shift + P\` |
| Sidebar | \`Ctrl/Cmd + \\\` |

## Your Draft Is Safe

A few seconds after you stop typing, a recovery copy is written to disk. If the app ever quits unexpectedly, the next launch offers to bring it back.

Your files themselves are saved only when you save them — with \`Ctrl/Cmd + S\`, or the toolbar. No cloud, no account, no sync.

---

*Rocktier Markdown — Fast. Private. Beautiful.*
`;
