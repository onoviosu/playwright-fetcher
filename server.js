import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Default user agent to look like a normal Chrome browser
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Health check
app.get('/healthz', (req, res) => {
  res.send('ok');
});

// Fetch endpoint
app.post('/fetch', async (req, res) => {
  const { url, timeoutMs = 90000, locale = 'en-US' } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let browser;
  try {
    // Launch Chromium in stealth mode
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-http2',
      ],
    });

    // Context with realistic browser settings
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: DEFAULT_UA,
      locale,
      viewport: { width: 1366, height: 768 },
    });

    const page = await context.newPage();

    // Hide webdriver property (extra stealth)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Navigate
    let resp;
    try {
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      // Wait specifically for BizBuySell listing cards to appear
      await page.waitForSelector('.listing-card', { timeout: 30000 });
    } catch (err) {
      console.warn('Timeout or selector not found, returning partial content');
    }

    // Scroll a bit to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(500);

    // Grab page HTML
    const html = await page.content();

    // Return structured response
    res.json({
      status: resp ? resp.status() : 408,
      finalUrl: page.url(),
      htmlLength: html.length,
      html,
    });
  } catch (err) {
    console.error('Fetcher error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Fetcher running on port ${PORT}`);
});
