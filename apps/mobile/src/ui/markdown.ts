/** A deliberately small Markdown subset: paragraphs, lists, headings, **bold**, *italic*, [[ref]] chips. */
export type Inline =
  { kind: 'text'; text: string; bold?: boolean; italic?: boolean } | { kind: 'ref'; ref: string };

export type Block =
  | { kind: 'heading'; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] };

const LIST_ITEM = /^\s*(?:[-*]|(\d+)[.)])\s+/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[\[([^\]\s]+)\]\]|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1]) out.push({ kind: 'ref', ref: m[1] });
    else if (m[2]) out.push({ kind: 'text', text: m[2], bold: true });
    else out.push({ kind: 'text', text: (m[3] ?? m[4]) as string, italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of md.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (lines.length === 0) continue;
    const first = lines[0] as string;
    if (/^#{1,6}\s/.test(first) && lines.length === 1) {
      blocks.push({ kind: 'heading', inline: parseInline(first.replace(/^#{1,6}\s+/, '')) });
    } else if (lines.every((l) => LIST_ITEM.test(l))) {
      blocks.push({
        kind: 'list',
        ordered: /^\s*\d/.test(first),
        items: lines.map((l) => parseInline(l.replace(LIST_ITEM, ''))),
      });
    } else {
      blocks.push({ kind: 'paragraph', inline: parseInline(lines.join(' ')) });
    }
  }
  return blocks;
}

/** The body as stored starts with "## Response"; the screen has its own heading. */
export function stripResponseHeading(md: string): string {
  return md.replace(/^\s*## Response[^\n]*\n/, '');
}
