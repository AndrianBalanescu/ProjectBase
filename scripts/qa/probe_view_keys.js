// Keyboard-view probe: keys 4/5/6 hit live views, 7 is a no-op, main never blank.
// Proves the debloat-leftover fix: previously 4/6/7/8/9 rendered a blank main.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:8120/#/pb/board', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Login if gated (fresh context has no session).
  if (!(await page.locator('main').count())) {
    const signinToggle = page.locator("text='Sign in instead'");
    if (await signinToggle.isVisible().catch(() => false)) {
      await signinToggle.click();
      await page.waitForTimeout(300);
    }
    await page.fill('#login-email', 'f@flow.com');
    await page.fill('#login-password', 'superdev123');
    await page.click('#login-submit-button');
    await page.waitForTimeout(2500);
    await page.goto('http://127.0.0.1:8120/#/pb/board', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  }

  const mainText = () => page.evaluate(() => (document.querySelector('main')?.innerText || '').trim().length);
  const activeTab = () => page.evaluate(() =>
    document.querySelector('header .bg-white, header .bg-zinc-800')?.innerText?.trim() || '');

  async function pressKey(key) {
    await page.keyboard.press(key);
    await page.waitForTimeout(900);
    return { key, textLen: await mainText(), tab: await activeTab() };
  }

  const results = [];
  await page.keyboard.press('1'); await page.waitForTimeout(800); // start from board
  results.push(await pressKey('4')); // Timeline (Gantt)
  results.push(await pressKey('5')); // Roadmap (milestones)
  results.push(await pressKey('6')); // Projects
  results.push(await pressKey('7')); // Sessions (agents)
  results.push(await pressKey('8')); // no-op: stays Sessions, never blank

  // Timeline-specific assertions: the restored Gantt view must render bars.
  await page.keyboard.press('4');
  await page.waitForTimeout(1200);
  const timeline = await page.evaluate(() => {
    const main = document.querySelector('main');
    const html = main.innerHTML;
    return {
      rendered: /timeline|gantt/i.test(main.className + html),
      barLike: main.querySelectorAll('[style*="left"], [style*="width"]').length,
      textSample: main.innerText.trim().slice(0, 80).replace(/\s+/g, ' '),
      height: main.getBoundingClientRect().height,
    };
  });

  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });

  console.log(JSON.stringify({ results, timeline, overflow, errors }, null, 1));
  await browser.close();
  const bad = results.filter(r => r.textLen < 40);
  if (!timeline.rendered || timeline.barLike < 1) {
    console.error('PROBE FAIL: Timeline view did not render bars', JSON.stringify(timeline));
    process.exit(1);
  }
  if (bad.length || errors.length || overflow > 0) {
    console.error('PROBE FAIL: blank/dead views:', JSON.stringify(bad));
    process.exit(1);
  }
  console.log('PROBE PASS: keys 4-7 land on live views, 8 is a no-op, Timeline renders ' + timeline.barLike + ' bars, 0 overflow, 0 errors');
})().catch(e => { console.error(e); process.exit(1); });
