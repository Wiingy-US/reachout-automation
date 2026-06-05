// Pure HTML/text helpers used by both the deterministic check engine (server)
// and the client-side pre-export validation. No DOM dependency so they run in
// Node and the browser.

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Strip all HTML tags and collapse entities/whitespace to plain text. */
export function stripHtml(html: string): string {
  if (!html) return "";
  let text = html
    // block-level tags become spaces so words don't run together
    .replace(/<\/(p|div|br|li|h[1-6]|tr|td|table|ul|ol)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  return text.replace(/\s+/g, " ").trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** Count words in an HTML string after stripping tags. */
export function wordCount(html: string): number {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Count <b> and <strong> open tags. */
export function countBolds(html: string): number {
  if (!html) return 0;
  const matches = html.match(/<\s*(b|strong)(\s[^>]*)?>/gi);
  return matches ? matches.length : 0;
}

export function hasEmDash(html: string): boolean {
  // em dash U+2014 (and the longer horizontal bar U+2015)
  return /[—―]/.test(html);
}

/** Case-insensitive whole-word test for the literal token "pdf". */
export function mentionsPdf(html: string): boolean {
  return /\bpdf\b/i.test(stripHtml(html));
}

/**
 * Detect unclosed (unbalanced) HTML tags. Returns the names of tags that were
 * opened but never closed (ignoring void elements). Used for the pre-export
 * warning — intentionally lightweight, not a full parser.
 */
export function findUnclosedTags(html: string): string[] {
  if (!html) return [];
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)\s*>/g;
  const stack: string[] = [];
  const unmatched: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const isClosing = m[1] === "/";
    const name = m[2].toLowerCase();
    const selfClosing = m[3] === "/";
    if (VOID_TAGS.has(name) || selfClosing) continue;
    if (!isClosing) {
      stack.push(name);
    } else {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) {
        unmatched.push(name); // stray closing tag
      } else {
        stack.splice(idx, 1);
      }
    }
  }
  return [...stack, ...unmatched];
}

/** Rough sentence count for plain text. */
export function sentenceCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const parts = t.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return parts.length;
}
