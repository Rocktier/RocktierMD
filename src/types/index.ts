export type ViewMode = "split" | "editor" | "preview";

export interface MarkdownDocument {
  path: string | null;
  content: string;
  modified: boolean;
}

export const WELCOME_DOCUMENT = `# Welcome to Rocktier Markdown

A **fast**, elegant Markdown reader. Part of the Rocktier family — private by design.

---

## Real-time Editing

Type on the left, see beautifully rendered output on the right. Scroll on one side, the other follows.

### Code Highlighting

\`\`\`rust
fn main() {
    let message = "Hello, Rocktier!";
    println!("{message}");
}
\`\`\`

\`\`\`
const greeting = () => console.log("Simple and fast");
\`\`\`

### Task Lists

- [x] CommonMark + GFM
- [x] Syntax highlighting
- [x] Scroll sync
- [ ] KaTeX (math)
- [ ] Mermaid diagrams

### Tables

| Feature    | Status |
|------------|--------|
| Editing    | Done   |
| Preview    | Done   |
| Highlight  | Done   |

### Blockquote

> Simplicity is the ultimate sophistication.
> — Leonardo da Vinci

---

*Rocktier Markdown — Fast. Private. Beautiful.*
`;
