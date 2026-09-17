# Code, Math and Tables

Two things every technical document eventually needs.

## Syntax highlighting

```rust
fn reading_time(words: usize) -> f64 {
    words as f64 / 200.0
}
```

## Math

The same idea, typeset:

$$
t = \frac{n}{200}
$$

Inline math works too: a 900-word piece takes $4.5$ minutes.

## Tables

| Element | Syntax | Notes |
|---|---|---|
| Table | pipes | Alignment comes from the header row |
| Code | fenced blocks | Highlighted per language |
| Math | `$inline$`, `$$display$$` | Typeset with KaTeX |

- [x] GitHub Flavored Markdown, including ~~strikethrough~~
- [x] Task lists you can tick from the preview
