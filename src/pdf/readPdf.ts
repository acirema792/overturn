// Reads the text of a PDF letter ON THE DEVICE with Mozilla's pdf.js.
// pdf.js and its worker are bundled with the app and loaded only when a PDF
// is chosen; the file is read from memory and never uploaded.

export interface PdfText {
  text: string;
  pages: number;
  /** True when the PDF has (almost) no text layer, i.e. a scan. */
  textless: boolean;
  truncated: boolean;
}

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;

interface TextItemLike {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
}

/** Joins pdf.js text items into lines, using end-of-line flags and baseline changes. */
export function itemsToText(items: TextItemLike[]): string {
  let out = '';
  let lastY: number | undefined;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const y = it.transform?.[5];
    if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    else if (out && !out.endsWith('\n') && !out.endsWith(' ') && it.str && !it.str.startsWith(' ')) out += ' ';
    out += it.str;
    if (it.hasEOL) out += '\n';
    if (y !== undefined) lastY = y;
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type PdfErrorKind = 'tooLarge' | 'password' | 'invalid' | 'other';

/** A PDF that couldn't be read; `kind` picks the message in the user's language. */
export class PdfReadError extends Error {
  readonly kind: PdfErrorKind;
  constructor(kind: PdfErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'PdfReadError';
  }
}

/** Maps pdf.js exceptions (by name) to a kind the UI can explain. */
export function pdfErrorKind(e: unknown): PdfErrorKind {
  if (e instanceof PdfReadError) return e.kind;
  const name = (e as { name?: string } | null)?.name ?? '';
  if (name === 'PasswordException') return 'password';
  if (name === 'InvalidPDFException' || name === 'FormatError') return 'invalid';
  return 'other';
}

export async function readPdfText(file: File): Promise<PdfText> {
  if (file.size > MAX_PDF_BYTES) throw new PdfReadError('tooLarge', 'This PDF is larger than 15 MB');
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, disableAutoFetch: true, disableStream: true });
  try {
    const doc = await task.promise;
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const parts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(itemsToText(content.items as TextItemLike[]));
    }
    const text = parts.filter(Boolean).join('\n\n');
    return { text, pages: doc.numPages, textless: text.replace(/\s/g, '').length < 40, truncated: doc.numPages > MAX_PDF_PAGES };
  } finally {
    // Also when opening fails (corrupt or password-protected file).
    await task.destroy();
  }
}
