# Markdown Test for README

This document is a compact fixture for previewing common Markdown syntax.

---

## Headings

# H1
## H2
### H3
#### H4
##### H5
###### H6

## Paragraphs

This is a normal paragraph.

This is another paragraph with a line break at the end of the first line.  
This line should appear after a hard break.

## Emphasis

*Italic text*

**Bold text**

***Bold and italic text***

~~Strikethrough text~~

## Inline Code

Use `pnpm install` to install dependencies.

Use `git submodule update --init --recursive` when submodules are missing.

## Links

[OpenAI](https://openai.com/)

<https://github.com/>

## Blockquotes

> This is a standard blockquote.
>
> It contains multiple paragraphs.

> A second quote should remain independent.

## GitHub Alerts

> [!NOTE]
> Useful information that users should know, even when skimming content.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

> This is a normal quote after alerts.

## Lists

- Unordered item A
- Unordered item B
- Unordered item C

1. Ordered item 1
2. Ordered item 2
3. Ordered item 3

- Parent item
  - Nested item
  - Another nested item

## Task Lists

- [x] Checked item
- [ ] Unchecked item
- [ ] Another unchecked item

## Tables

| Syntax | Description |
| --- | --- |
| Header | Title |
| Paragraph | Text |
| Code | `const x = 1` |

| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |
| 1 | 2 | 3 |

## Code Blocks

```bash
git clone --recursive https://github.com/AstraEditor/desktop astraeditor-desktop
cd astraeditor-desktop
pnpm install
```

```javascript
function greet(name) {
    return `Hello, ${name}!`;
}

console.log(greet('world'));
```

```json
{
  "name": "markdown-syntax-test",
  "private": true,
  "packageManager": "pnpm"
}
```

```css
.example {
    display: block;
    width: max-content;
    min-width: 100%;
}
```

## Image

![Readme Icon](../../src/components/gui/readme.svg)

## Horizontal Rule

---

## Escapes

\*This should not be italic\*

\`This should not be inline code\`

## HTML

<details>
  <summary>Expandable HTML block</summary>

  <p>This is raw HTML inside Markdown.</p>
</details>

<kbd>Ctrl</kbd> + <kbd>R</kbd>

## Mixed Content

1. Run `pnpm install`.
2. Read the table below.
3. Check the note after the table.

| Step | Command | Status |
| --- | --- | --- |
| Install | `pnpm install` | Done |
| Build | `pnpm build` | Pending |

> [!NOTE]
> The code block below is intentionally long to test horizontal overflow behavior.

```text
This is a very long line: 1234567890 abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ /path/to/some/really/long/location/that/should/overflow/horizontally/instead/of/breaking/the/modal
```

## End

End of syntax test.
