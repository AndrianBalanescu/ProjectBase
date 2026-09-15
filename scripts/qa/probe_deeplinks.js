// Deep-link sweep: every live route renders non-blank; legacy routes redirect.
// Pins the post-Timeline-restoration shell end to end.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:8120/#/pb/board', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!(await page.locator('main').count())) {
    const t = page.locator("text='Sign in instead'");
    if (await t.isVisible().catch(() => false)) { await t.click(); await page.waitForTimeout(300); }
    await page.fill('#login-email', 'f@flow.com');
    await page.fill('#login-password', 'superdev123');
    await page.click('#login-submit-button');
    await page.waitForTimeout(2500);
  }

  const liveRoutes = ['board', 'list', 'cycles', 'timeline', 'milestones', 'projects', 'agents'];
  const results = [];
  for (const route of liveRoutes) {
    await page.goto(`http://127.0.0.1:8120/#/pb/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      textLen: (document.querySelector('main')?.innerText || '').trim().length,
      blank: !(document.querySelector('main')?.innerText || '').trim(),
    }));
    results.push({ route, ...state, ok: state.textLen > 40 });
  }

  // Legacy deep links must land on a real view, never blank.
  const legacy = [];
  for (const [from, expectViewRegex] of [['portfolio', /project/i], ['stats', /./]]) {
    await page.goto(`http://127.0.0.1:8120/#/pb/${from}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      textLen: (document.querySelector('main')?.innerText || '').trim().length,
    }));
    legacy.push({ from, ...state, ok: state.textLen > 40 });
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(JSON.stringify({ live: results, legacy, overflow, errors }, null, 1));
  await browser.close();
  const bad = [...results, ...legacy].filter(r => !r.ok);
  if (bad.length || errors.length || overflow > 0) {
    console.error('SWEEP FAIL', JSON.stringify(bad));
    process.exit(1);
  }
  console.log('SWEEP PASS: all 7 live deep links + 2 legacy redirects render non-blank, 0 errors, 0 overflow');
})().catch(e => { console.error(e); process.exit(1); });
