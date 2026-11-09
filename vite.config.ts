import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const siteDir = resolve(import.meta.dirname, 'site');

function htmlInputs(dir: string, acc: Record<string, string> = {}): Record<string, string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) htmlInputs(p, acc);
    else if (f.endsWith('.html')) acc[p.slice(siteDir.length + 1).replace(/\.html$/, '').replace(/[/\\]/g, '_') || 'index'] = p;
  }
  return acc;
}

export default defineConfig(() => ({
  root: siteDir,
  base: (process.env.SITE_BASE || '/').replace(/\/?$/, '/'),
  envDir: import.meta.dirname,
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [react(), tailwindcss()],
  server: { port: 5199, strictPort: true, fs: { allow: [import.meta.dirname] } },
  preview: { port: 5199, strictPort: true },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: htmlInputs(siteDir) },
  },
}));
