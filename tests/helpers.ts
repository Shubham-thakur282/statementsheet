import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPages } from '../src/lib/pdf/extract';
import { parseStatement, type ParseOptions } from '../src/lib/parse/statement';

export const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);

export async function pagesFromFixture(name: string, password?: string) {
  const data = new Uint8Array(readFileSync(fixture(name)));
  const task = getDocument({ data, password, verbosity: 0, useSystemFonts: false });
  const doc = await task.promise;
  try {
    return await extractPages(doc);
  } finally {
    await task.destroy();
  }
}

export async function parseFixture(name: string, opts?: ParseOptions) {
  return parseStatement(await pagesFromFixture(name), opts);
}

export function expected(name: string) {
  return JSON.parse(readFileSync(fixture(`${name}.json`), 'utf8')) as Array<{ date: string; description: string; amount: number; balance?: number }>;
}
