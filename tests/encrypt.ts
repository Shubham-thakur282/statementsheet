// Builds an encrypted copy of a fixture IN MEMORY. (Endpoint-security software on some machines
// blocks reading encrypted PDFs from disk, so we never write one.)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fixture } from './helpers';

const require = createRequire(import.meta.url);

export function encryptedFixture(name: string, userPassword: string): Buffer {
  const m = require('muhammara');
  const chunks: Buffer[] = [];
  const sink = { write: (b: Uint8Array | number[]) => void chunks.push(Buffer.from(b as Uint8Array)) };
  m.recrypt(new m.PDFRStreamForBuffer(readFileSync(fixture(name))), new m.PDFStreamForResponse(sink), {
    userPassword,
    ownerPassword: 'owner-secret',
    userProtectionFlag: 4,
  });
  return Buffer.concat(chunks);
}
