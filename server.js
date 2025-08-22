import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Helpful defaults to look less like a bot
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

app.post('/fetch', async (req, res) => {
  const { url, waitUntil = 'domcontentloaded', timeoutMs = 45000, locale = 'en-US' } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      userAgent: DEFAULT_UA,
      locale,
      viewport: { width: 1366, height: 768 },
    });

    const page = await context.newPage();

    // Basic stealth
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const resp = await page.goto(url, { waitUntil, timeout: timeoutMs });

    // Optional: small scroll to trigger lazy content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(500);

    const html = await page.content();
    const status = resp?.status() ?? 0;
    const finalUrl = page.url();

    await context.close();
    await browser.close();

    return res.json({
      status,
      finalUrl,
      htmlLength: html.length,
      html
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/healthz', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Playwright fetcher listening on :${PORT}`));