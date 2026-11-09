import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPages } from '../../src/lib/pdf/extract';
import { parseStatement } from '../../src/lib/parse/statement';
import { encryptedFixture } from '../encrypt';

async function open(data: Buffer, password?: string) {
  const task = getDocument({ data: new Uint8Array(data), password, verbosity: 0 });
  try {
    return await extractPages(await task.promise);
  } finally {
    await task.destroy();
  }
}

describe('password-protected PDFs', () => {
  const pdf = encryptedFixture('in-savings.pdf', '01011990');
  it('requires the password', async () => {
    await expect(open(pdf)).rejects.toMatchObject({ name: 'PasswordException', code: 1 });
  });
  it('reports an incorrect password', async () => {
    await expect(open(pdf, 'wrong')).rejects.toMatchObject({ name: 'PasswordException', code: 2 });
  });
  it('parses with the right password', async () => {
    const r = parseStatement(await open(pdf, '01011990'));
    expect(r.transactions).toHaveLength(10);
    expect(r.reconciled).toBe(1);
  });
});
