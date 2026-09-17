# Field Notes: Offline-First Software

A short document used for the Store screenshots. It exercises everything the
editor renders: headings, lists, tables, code and math.

## Why offline first

Software that does not need a network is simpler to reason about. There is no
account to expire, no sync to conflict, and no server that can be shut down
underneath your work.

> A file on disk outlives every service that ever claimed to keep it safe.

## The writing surface

The editor splits into two panes. The left one is the document itself — plain
text, nothing hidden. The right one is what it will look like.

- [x] Live preview that keeps up with typing
- [x] GitHub Flavored Markdown, including ~~strikethrough~~
- [x] Task lists you can tick from the preview
- [ ] Nothing here requires an account

## What it handles

| Element | Syntax | Notes |
|---|---|---|
| Table | `\|` pipes | Alignment from the header row |
| Code | fenced blocks | Highlighted per language |
| Math | `$inline$` / `$$display$$` | Typeset with KaTeX |
| Front matter | `---` at the top | Shown in its own panel |

## Code

```rust
fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}
```

## Math

The reading time of a document is roughly

$$
t = \frac{n}{200}
$$

where `n` is the word count — about 200 words per minute for prose.

## Structure over length

Long documents are navigable without scrolling: every heading appears in the
outline, and clicking one moves the cursor there. Word count, reading time, and
the current line and column sit in the status bar.

### Export

HTML for the web, PDF through the system print dialog. Both start from the same
rendered document you see on screen, so what you hand over is what you wrote.
