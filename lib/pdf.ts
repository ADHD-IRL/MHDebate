import type { Block, ReportDoc } from "./report";

/**
 * A small PDF writer, deliberately dependency-free.
 *
 * The document is assembled in the reader's browser and never posted anywhere,
 * which matters more here than it would elsewhere: it contains what someone
 * wrote about their own mental health. Pulling in a 350kB PDF library to lay
 * out black text in one typeface was the worse trade.
 *
 * Scope is exactly what the report needs: the base-14 Helvetica family (so no
 * font embedding), WinAnsi text, wrapped paragraphs, bullets, rules and boxes.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { left: 56, right: 56, top: 56, bottom: 64 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

type FontId = "F1" | "F2" | "F3";

const FONTS: Record<FontId, string> = {
  F1: "Helvetica",
  F2: "Helvetica-Bold",
  F3: "Helvetica-Oblique",
};

/** Helvetica AFM advance widths (1/1000 em) for code points 32–126. */
const REGULAR_WIDTHS =
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584"
    .split(" ")
    .map(Number);

/** Helvetica-Bold is a different set; using the regular one visibly overflows. */
const BOLD_WIDTHS =
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584"
    .split(" ")
    .map(Number);

const FALLBACK_WIDTH = 556;

/**
 * The report carries curly quotes, dashes and ellipses from model output and
 * from our own copy. Mapping them to WinAnsi keeps the file single-byte and
 * avoids shipping a font just to render an apostrophe.
 */
const TRANSLITERATE: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
  "•": "-",
  "→": "->",
  "×": "x",
  "≥": ">=",
  "≤": "<=",
};

export function toWinAnsi(text: string): string {
  let out = "";
  for (const char of text) {
    const mapped = TRANSLITERATE[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = char.codePointAt(0) ?? 63;
    // Keep printable ASCII and the Latin-1 upper range; drop anything else
    // rather than emitting a byte the viewer would render as noise.
    out += code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) ? char : "?";
  }
  return out;
}

function charWidth(code: number, bold: boolean): number {
  if (code >= 32 && code <= 126) {
    return (bold ? BOLD_WIDTHS : REGULAR_WIDTHS)[code - 32] ?? FALLBACK_WIDTH;
  }
  return FALLBACK_WIDTH;
}

export function measure(text: string, size: number, bold = false): number {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total += charWidth(text.charCodeAt(i), bold);
  return (total / 1000) * size;
}

/** Greedy wrap, breaking mid-word only when a single word cannot fit a line. */
export function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size, bold) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);

      if (measure(word, size, bold) <= maxWidth) {
        line = word;
        continue;
      }

      // A single unbreakable token (a long URL, usually) — hard-break it.
      let chunk = "";
      for (const char of word) {
        if (measure(chunk + char, size, bold) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }

  return lines;
}

function escapeText(text: string): string {
  return text.replace(/[\\()]/g, "\\$&");
}

// ------------------------------------------------------------------- layout

interface Cursor {
  pages: string[][];
  ops: string[];
  y: number;
}

function newPage(cursor: Cursor): void {
  if (cursor.ops.length) cursor.pages.push(cursor.ops);
  cursor.ops = [];
  cursor.y = A4.height - MARGIN.top;
}

function ensureRoom(cursor: Cursor, needed: number): void {
  if (cursor.y - needed < MARGIN.bottom) newPage(cursor);
}

function drawText(
  cursor: Cursor,
  text: string,
  opts: { size: number; font: FontId; x?: number; gray?: number },
): void {
  const x = opts.x ?? MARGIN.left;
  const parts = [
    "BT",
    opts.gray !== undefined ? `${opts.gray} g` : "0 g",
    `/${opts.font} ${opts.size} Tf`,
    `${x.toFixed(2)} ${cursor.y.toFixed(2)} Td`,
    `(${escapeText(text)}) Tj`,
    "ET",
  ];
  cursor.ops.push(parts.join("\n"));
}

function paragraph(
  cursor: Cursor,
  text: string,
  opts: {
    size: number;
    font: FontId;
    leading: number;
    indent?: number;
    gray?: number;
    hanging?: string;
  },
): void {
  const indent = opts.indent ?? 0;
  const bold = opts.font === "F2";
  const width = CONTENT_WIDTH - indent;
  const lines = wrap(toWinAnsi(text), opts.size, width, bold);

  lines.forEach((line, index) => {
    ensureRoom(cursor, opts.leading);
    if (index === 0 && opts.hanging) {
      drawText(cursor, toWinAnsi(opts.hanging), {
        size: opts.size,
        font: opts.font,
        x: MARGIN.left + indent - 12,
        gray: opts.gray,
      });
    }
    drawText(cursor, line, {
      size: opts.size,
      font: opts.font,
      x: MARGIN.left + indent,
      gray: opts.gray,
    });
    cursor.y -= opts.leading;
  });
}

function rule(cursor: Cursor, gray = 0.75): void {
  ensureRoom(cursor, 12);
  cursor.ops.push(
    `${gray} G 0.6 w ${MARGIN.left} ${cursor.y.toFixed(2)} m ${(A4.width - MARGIN.right).toFixed(2)} ${cursor.y.toFixed(2)} l S`,
  );
  cursor.y -= 12;
}

function banner(cursor: Cursor, lines: string[]): void {
  const size = 8.5;
  const leading = 11.5;
  const padding = 10;
  const inner = CONTENT_WIDTH - padding * 2;

  const wrapped = lines.flatMap((line, i) =>
    wrap(toWinAnsi(line), size, inner, i === 0).map((text) => ({ text, bold: i === 0 })),
  );
  const boxHeight = wrapped.length * leading + padding * 2 - 4;

  ensureRoom(cursor, boxHeight + 8);

  const top = cursor.y;
  cursor.ops.push(
    `0.94 0.90 0.88 rg 0.55 0.25 0.15 RG 0.8 w ` +
      `${MARGIN.left} ${(top - boxHeight).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} ${boxHeight.toFixed(2)} re B`,
  );

  cursor.y = top - padding - size;
  for (const line of wrapped) {
    drawText(cursor, line.text, {
      size,
      font: line.bold ? "F2" : "F1",
      x: MARGIN.left + padding,
      gray: 0.15,
    });
    cursor.y -= leading;
  }
  cursor.y = top - boxHeight - 14;
}

function renderBlock(cursor: Cursor, block: Block): void {
  switch (block.kind) {
    case "title":
      ensureRoom(cursor, 30);
      cursor.y -= 4;
      paragraph(cursor, block.text, { size: 18, font: "F2", leading: 22 });
      cursor.y -= 2;
      break;

    case "meta":
      paragraph(cursor, block.text, { size: 8.5, font: "F1", leading: 12, gray: 0.4 });
      cursor.y -= 8;
      break;

    case "banner":
      banner(cursor, block.lines);
      break;

    case "heading":
      ensureRoom(cursor, 34);
      cursor.y -= 8;
      paragraph(cursor, block.text, { size: 11.5, font: "F2", leading: 15 });
      cursor.y -= 3;
      break;

    case "subheading":
      ensureRoom(cursor, 26);
      cursor.y -= 4;
      paragraph(cursor, block.text, { size: 10, font: "F2", leading: 13, gray: 0.2 });
      break;

    case "paragraph":
      paragraph(cursor, block.text, { size: 9.5, font: "F1", leading: 13 });
      cursor.y -= 4;
      break;

    case "quote": {
      const lines = wrap(toWinAnsi(block.text), 9.5, CONTENT_WIDTH - 18, false);
      const height = lines.length * 13 + 8;
      ensureRoom(cursor, height);
      const top = cursor.y + 3;
      cursor.ops.push(
        `0.55 0.25 0.15 RG 1.6 w ${MARGIN.left} ${top.toFixed(2)} m ${MARGIN.left} ${(top - height).toFixed(2)} l S`,
      );
      for (const line of lines) {
        drawText(cursor, line, { size: 9.5, font: "F3", x: MARGIN.left + 14, gray: 0.1 });
        cursor.y -= 13;
      }
      cursor.y -= 6;
      break;
    }

    case "bullets":
      for (const item of block.items) {
        paragraph(cursor, item, {
          size: 9.5,
          font: "F1",
          leading: 13,
          indent: 14,
          hanging: "-",
        });
        cursor.y -= 2;
      }
      cursor.y -= 4;
      break;

    case "rule":
      cursor.y -= 6;
      rule(cursor);
      break;
  }
}

// ---------------------------------------------------------------- assembly

function footerOps(text: string, page: number, total: number): string {
  const size = 7.5;
  const label = toWinAnsi(`${text}  ·  page ${page} of ${total}`);
  const y = MARGIN.bottom - 24;
  return [
    `0.8 G 0.5 w ${MARGIN.left} ${(y + 14).toFixed(2)} m ${(A4.width - MARGIN.right).toFixed(2)} ${(y + 14).toFixed(2)} l S`,
    "BT",
    "0.45 g",
    `/F1 ${size} Tf`,
    `${MARGIN.left} ${y.toFixed(2)} Td`,
    `(${escapeText(label)}) Tj`,
    "ET",
  ].join("\n");
}

function latin1Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

/** Lay a report out and serialise it. Returns raw PDF bytes. */
export function renderPdf(doc: ReportDoc): Uint8Array {
  const cursor: Cursor = { pages: [], ops: [], y: A4.height - MARGIN.top };

  for (const block of doc.blocks) renderBlock(cursor, block);
  if (cursor.ops.length) cursor.pages.push(cursor.ops);
  if (cursor.pages.length === 0) cursor.pages.push([]);

  const total = cursor.pages.length;
  const streams = cursor.pages.map(
    (ops, index) => `${ops.join("\n")}\n${footerOps(doc.footer, index + 1, total)}`,
  );

  // Object numbering: 1 catalog, 2 pages, 3–5 fonts, then page/content pairs.
  const FIRST_PAGE_OBJ = 6;
  const pageIds = streams.map((_, i) => FIRST_PAGE_OBJ + i * 2);
  const objects: string[] = [];

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${total} >>`,
  );
  for (const font of ["F1", "F2", "F3"] as FontId[]) {
    objects.push(
      `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[font]} /Encoding /WinAnsiEncoding >>`,
    );
  }

  streams.forEach((stream, index) => {
    const contentId = pageIds[index] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}\nendstream`);
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(latin1Bytes(body).length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = latin1Bytes(body).length;
  const count = objects.length + 1;

  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;

  const trailer =
    `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return latin1Bytes(body + xref + trailer);
}
