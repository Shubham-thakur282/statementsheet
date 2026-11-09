import type { PageText, TextItem } from '../parse/types';

/** Minimal structural types so this works with both the browser and Node builds of pdf.js. */
interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }>; cleanup?: () => void }>;
}

/** Pull positioned text out of every page. */
export async function extractPages(doc: PdfDocLike, onProgress?: (done: number, total: number) => void): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items as PdfTextItemLike[]) {
      if (typeof raw.str !== 'string' || !raw.transform) continue;
      const [a, b, , d, e, f] = raw.transform;
      // Skip rotated text (watermarks, vertical margin notes).
      if (Math.abs(b) > Math.abs(a) * 0.2) continue;
      items.push({ str: raw.str, x: e, y: f, w: raw.width ?? 0, h: Math.abs(raw.height || d) || 8 });
    }
    pages.push({ page: n, items });
    page.cleanup?.();
    onProgress?.(n, doc.numPages);
  }
  return pages;
}
