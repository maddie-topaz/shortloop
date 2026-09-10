import { test, expect } from '@playwright/test';

// Selectors here are role- and label-based on purpose: the UI is daisyUI, so
// class names belong to the framework and change whenever it is restyled.

test('shortens a URL and shows it in the list', async ({ page }) => {
  const destination = `https://example.com/${crypto.randomUUID()}`;

  await page.goto('/');
  await page.getByPlaceholder('https://').fill(destination);
  await page.getByRole('button', { name: 'Shorten' }).click();

  const row = page.getByRole('row').filter({ hasText: destination });
  await expect(row).toBeVisible();
  await expect(row.getByRole('link')).toHaveText(/^\/[A-Za-z0-9]{7}$/);
});

test('a shortened link redirects to the original URL', async ({ page, request }) => {
  const destination = `https://example.com/${crypto.randomUUID()}`;

  await page.goto('/');
  await page.getByPlaceholder('https://').fill(destination);
  await page.getByRole('button', { name: 'Shorten' }).click();

  const shortPath = await page
    .getByRole('row')
    .filter({ hasText: destination })
    .getByRole('link')
    .innerText();

  // Checked as a request rather than a navigation so the test never depends on
  // the destination host being reachable from CI.
  const response = await request.get(shortPath, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()['location']).toBe(destination);
});

test('rejects a URL that is not http or https', async ({ page }) => {
  await page.goto('/');
  // Passes the browser's native type="url" validation but must be refused by
  // the API — shortening a javascript: URL would make this an XSS vector.
  await page.getByPlaceholder('https://').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Shorten' }).click();

  await expect(page.getByRole('alert')).toContainText('valid http(s) URL');
});

test('an unknown short code returns 404', async ({ request }) => {
  const response = await request.get('/doesnotexist', { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});
