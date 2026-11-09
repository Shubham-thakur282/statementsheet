import { extractPages } from './extract';
import type { PageText } from '../parse/types';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export class PasswordRequiredError extends Error {
  incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? 'Incorrect password' : 'Password required');
    this.incorrect = incorrect;
  }
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist');
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      lib.GlobalWorkerOptions.workerSrc = worker;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export interface LoadedPdf {
  pages: PageText[];
  numPages: number;
}

/** Count pages without extracting text, so plan limits can be checked first. */
export async function readPdf(
  file: File,
  opts: { password?: string; maxPages?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<LoadedPdf> {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 50 MB. Statements are usually much smaller. Is this the right file?');
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!new TextDecoder('latin1').decode(head).includes('%PDF-')) throw new Error('This file is not a PDF.');
  const lib = await pdfjs();
  const base = import.meta.env.BASE_URL;
  const task = lib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: opts.password,
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (opts.maxPages !== undefined && doc.numPages > opts.maxPages) {
      return { pages: [], numPages: doc.numPages };
    }
    const pages = await extractPages(doc, opts.onProgress);
    return { pages, numPages: doc.numPages };
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === 'PasswordException') throw new PasswordRequiredError(err.code === 2);
    if (err?.name === 'InvalidPDFException') throw new Error('This PDF appears to be damaged or incomplete.');
    throw e;
  } finally {
    void task.destroy();
  }
}
