import 'server-only';

/**
 * Pure-JS minimal PDF generator. Used by the eval runner to convert a
 * golden case's `synthetic_first_pages_text` into a real PDF Buffer that
 * gets attached to the agent invocation — so eval runs exercise the same
 * code path as production (vision input), not a degraded text-only path.
 *
 * Output: a valid 1-page Helvetica PDF, US Letter, ~9pt left-aligned,
 * line-wrapped at ~95 columns. No images, no embedded fonts.
 *
 * Spec reference: PDF 1.4 (ISO 32000-1). Tiny enough to vendor inline.
 */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 54;
const MARGIN_TOP = 54;
const FONT_SIZE = 10;
const LEADING = 14;
const COLS = 95;

export function syntheticPdfFromText(text: string): Buffer {
  const wrapped = wrapText(text, COLS);
  const startY = PAGE_HEIGHT - MARGIN_TOP;
  const visibleLines = wrapped.slice(0, Math.floor((PAGE_HEIGHT - 2 * MARGIN_TOP) / LEADING));

  const ops: string[] = ['BT', `/F1 ${FONT_SIZE} Tf`, `${LEADING} TL`];
  ops.push(`${MARGIN_LEFT} ${startY} Td`);
  for (let i = 0; i < visibleLines.length; i++) {
    ops.push(`(${escapePdfString(visibleLines[i] ?? '')}) Tj`);
    if (i < visibleLines.length - 1) ops.push(`T*`);
  }
  ops.push('ET');
  const stream = ops.join('\n');

  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`,
  );
  objects.push(
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
  );
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Build the file with a correct xref table — byte offsets matter.
  const header = '%PDF-1.4\n%âãÏÓ\n';
  let cursor = Buffer.byteLength(header, 'binary');
  const offsets: number[] = [];
  let body = '';
  for (const obj of objects) {
    offsets.push(cursor);
    const block = obj + '\n';
    body += block;
    cursor += Buffer.byteLength(block, 'binary');
  }

  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'binary');
}

function wrapText(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.length === 0) {
      out.push('');
      continue;
    }
    const words = rawLine.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (line.length === 0) {
        line = w;
      } else if (line.length + 1 + w.length <= cols) {
        line += ' ' + w;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

function escapePdfString(s: string): string {
  // PDF string literal escapes — keep ASCII-only for the synthetic fixture.
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Strip non-Latin-1 chars (₹ etc.) — replace with ASCII fallback so the
    // built-in Helvetica encoding doesn't choke. The agent reads the text via
    // OCR which is encoding-agnostic; minor degradation is acceptable for evals.
    .replace(/[^\x20-\x7e]/g, '?');
}
