import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/pricing/', '/bank-statement-to-quickbooks/', '/guides/is-it-safe-to-upload-bank-statements-online/', '/privacy/', '/support/'];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  });
}

test('results table and upgrade dialog are accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(new URL('../fixtures/us-checking.pdf', import.meta.url).pathname);
  await page.getByTestId('results-table').waitFor();
  let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  await page.getByRole('button', { name: /^Excel/ }).click();
  await page.getByRole('dialog').waitFor();
  r = await new AxeBuilder({ page }).include('[role=dialog]').analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
