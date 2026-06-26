import { marked } from "marked";

// Readings/essences are authored by hand on claude.ai and pasted back as either
// markdown or a full HTML artifact. They render inside a sealed iframe so the
// artifact's own `*`, `body`, and `:root` rules can't leak into the Constello
// page — and so that markdown and HTML can share one rendering path.
//
// The catch: claude.ai artifacts are styled against claude.ai's design tokens
// (`--color-text-primary`, `--font-sans`, …) which don't exist here, so their
// text fell back to black-on-black. This shim defines those tokens against the
// Constello palette (globals.css) so a pasted artifact renders legibly and in
// theme. A self-contained artifact that brings its own `:root` simply overrides
// the shim — its own values win.
const SHIM = `
:root {
  --font-sans: "Inter Tight", system-ui, -apple-system, sans-serif;
  --font-serif: "Fraunces", Georgia, serif;
  --color-text-primary: #efe7d6;
  --color-text-secondary: #b8ad97;
  --color-text-tertiary: #7d7563;
  --color-background-primary: transparent;
  --color-background-secondary: rgba(239, 231, 214, 0.05);
  --color-background-tertiary: rgba(239, 231, 214, 0.08);
  --color-border-primary: rgba(239, 231, 214, 0.16);
  --color-border-secondary: rgba(239, 231, 214, 0.16);
  --color-border-tertiary: rgba(239, 231, 214, 0.11);
  --color-accent: #e8584d;
  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}
* { box-sizing: border-box; }
html, body { background: transparent; margin: 0; padding: 0; }
body {
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  word-break: break-word;
}
/* markdown defaults — only applied to marked() output (.md wrapper) */
.md > :first-child { margin-top: 0; }
.md > :last-child { margin-bottom: 0; }
.md h1, .md h2, .md h3, .md h4 {
  color: var(--color-text-primary);
  font-weight: 600;
  line-height: 1.25;
  margin: 1.5em 0 0.5em;
}
.md h1 { font-size: 1.5em; }
.md h2 { font-size: 1.25em; }
.md h3 { font-size: 1.1em; }
.md p { margin: 0 0 1em; color: var(--color-text-secondary); }
.md strong { color: var(--color-text-primary); font-weight: 600; }
.md em { color: var(--color-text-primary); }
.md a { color: var(--color-accent); text-decoration: none; }
.md ul, .md ol { padding-left: 1.3em; margin: 0 0 1em; }
.md li { margin: 0.3em 0; color: var(--color-text-secondary); }
.md blockquote {
  border-left: 2px solid var(--color-border-tertiary);
  padding-left: 1em;
  margin: 1em 0;
  color: var(--color-text-secondary);
  font-style: italic;
}
.md code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.9em;
  background: var(--color-background-secondary);
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.md pre {
  background: var(--color-background-secondary);
  padding: 1em;
  border-radius: var(--border-radius-md);
  overflow-x: auto;
  margin: 0 0 1em;
}
.md pre code { background: none; padding: 0; }
.md hr { border: none; border-top: 1px solid var(--color-border-tertiary); margin: 1.5em 0; }
`;

function isFullDocument(s: string): boolean {
  return /^\s*(<!doctype\s|<html[\s>])/i.test(s);
}

function isHtmlFragment(s: string): boolean {
  return /<(style|div|section|article|header|h1|h2|h3|p|span|table|ul|ol|hr|img)[\s/>]/i.test(s);
}

// Turn a stored artifact into a complete, themed HTML document for the iframe.
export function buildReadingDoc(artifact: string): string {
  const a = artifact ?? "";

  // A self-contained document brings its own structure; inject the shim into its
  // head/body rather than re-wrapping (which would nest <html>).
  if (isFullDocument(a)) {
    if (/<\/head>/i.test(a)) {
      return a.replace(/<\/head>/i, `<style>${SHIM}</style></head>`);
    }
    if (/<body[\s>]/i.test(a)) {
      return a.replace(/(<body[^>]*>)/i, `$1<style>${SHIM}</style>`);
    }
    return `<style>${SHIM}</style>` + a;
  }

  // An HTML fragment carries its own styling; markdown does not, so wrap it in
  // `.md` to pick up the typographic defaults above.
  const inner = isHtmlFragment(a)
    ? a
    : `<div class="md">${marked.parse(a, { async: false }) as string}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${SHIM}</style></head><body>${inner}</body></html>`;
}
