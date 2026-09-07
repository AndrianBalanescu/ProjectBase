// verify_kanban_touch_dnd.js — real-browser QA for cycle 79 mobile touch DnD.
//
// What it proves:
//  1. Desktop regression: drag-and-drop still works with mouse (Sortable
//     config change must not break pointer drag), zero console/page errors.
//  2. Touch emulation: a long-press (180ms delayOnTouchOnly) + move + drop on
//     another column triggers the same onEnd path (status transition persists).
//  3. The touch-grip affordance markup renders inside every issue card and is
//     display:none on desktop viewport (hover:hover) media gates.
//  4. A quick tap (no long-press) on touch still opens the issue drawer.
//
// Run: node scripts/qa/verify_kanban_touch_dnd.js
const { chromium } = require('playwright');

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8120';
const EXE = process.env.QA_CHROME || require('child_process').execSync(
  `find "${process.env.HOME}/.cache/ms-playwright" -path '*chrome-linux*/chrome' -type f 2>/dev/null | sort -V | tail -1`
).toString().trim();

const results = {
  login: false,
  boardReached: false,
  desktopGripHidden: false,
  desktopGripRendered: false,
  desktopDragMovedCard: false,
  touchGripRendered: false,
  touchGripHiddenIdle: false,
  touchDragMovedCard: false,
  touchTapOpensDrawer: false,
  consoleErrors: [],
  pageErrors: [],
  failedReqs: [],
};

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const mkPage = (opts) => browser.newPage(opts);
  const wire = (page) => {
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('users/auth-with-password')) {
        results.consoleErrors.push(m.text().slice(0, 200));
      }
    });
    page.on('pageerror', (e) => results.pageErrors.push(String(e).slice(0, 200)));
    page.on('requestfailed', (r) => {
      if (!r.url().includes('auth-with-password')) results.failedReqs.push(r.url());
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('auth-with-password') && !res.url().includes('favicon')) {
        results.failedReqs.push(`HTTP ${res.status()} ${res.url()}`);
      }
    });
  };

  const login = async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(process.env.QA_EMAIL || 'f@flow.com');
      await page.locator('input[type="password"]').first().fill(process.env.QA_PASSWORD || 'superdev123');
      await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first().click();
      await page.waitForTimeout(2500);
    }
    results.login = !(await page.locator('input[type="password"]').count());
    await page.evaluate(() => { location.hash = '#/pb/board'; });
    await page.waitForTimeout(2000);
    results.boardReached = (await page.locator('#kanban-col-backlog').count()) > 0;
    if (!results.boardReached) throw new Error('board did not render');
  };

  // ------------------------------------------------------------------
  // 1. DESKTOP: mouse drag regression + grip hidden
  // ------------------------------------------------------------------
  const desktop = await mkPage({ viewport: { width: 1440, height: 900 }, hasTouch: false });
  wire(desktop);
  await login(desktop);

  results.desktopGripRendered = await desktop.evaluate(() => {
    const card = document.querySelector('.kanban-card-drag-handle .touch-grip, .kanban-card-drag-handle svg.lucide-grip-vertical');
    return !!card;
  });
  results.desktopGripHidden = await desktop.evaluate(() => {
    const grip = document.querySelector('.kanban-card-drag-handle .touch-grip');
    if (!grip) return false; // replaced <i> becomes svg with class lucide-grip-vertical
    const svg = document.querySelector('.kanban-card-drag-handle svg.lucide-grip-vertical');
    const el = svg || grip;
    const cs = getComputedStyle(el);
    return cs.display === 'none' || el.closest('.kanban-card-drag-handle') === null;
  });

  // Real mouse drag: first card of todo -> in_progress column.
  const dragCard = async (page, fromSel, toSel) => {
    const empty = await page.evaluate((sel) => {
      const strip = document.querySelector('#kanban-col-in_progress').closest('.overflow-x-auto');
      if (strip) strip.scrollLeft = 296;
      return document.querySelectorAll(`${sel} .kanban-card-drag-handle`).length === 0;
    }, fromSel);
    if (empty) return false;
    await page.waitForTimeout(500);
    // Center the source column horizontally (1440px viewport still clips the
    // 6-column strip on smaller windows) and clamp drop coordinates.
    await page.evaluate((sel) => {
      const col = document.querySelector(sel);
      const strip = col && col.closest('.overflow-x-auto');
      if (strip) {
        const r = col.getBoundingClientRect();
        strip.scrollLeft += (r.x + r.width / 2) - (window.innerWidth / 2);
      }
      const card = col && col.querySelector('.kanban-card-drag-handle');
      if (card) {
        const colRect = col.getBoundingClientRect();
        col.scrollTop += (card.getBoundingClientRect().y - colRect.y - 150);
      }
    }, fromSel);
    await page.waitForTimeout(500);
    const from = page.locator(`${fromSel} .kanban-card-drag-handle`).first();
    const to = page.locator(toSel);
    const fb = await from.boundingBox();
    const tb = await to.boundingBox();
    if (!fb || !tb) return false;
    await page.mouse.move(fb.x + Math.min(fb.width / 2, 200), fb.y + 8);
    await page.mouse.down();
    await page.mouse.move(fb.x + Math.min(fb.width / 2, 200) + 10, fb.y + 14, { steps: 4 });
    const vw = await page.evaluate(() => window.innerWidth);
    await page.mouse.move(Math.min(tb.x + Math.min(tb.width / 2, 500), vw - 20), tb.y + Math.min(tb.height / 2, 300), { steps: 18 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(1200);
  };

  const snapshotCards = (page) => page.evaluate(() => ({
    todo: Array.from(document.querySelectorAll('#kanban-col-todo .kanban-card-drag-handle')).map((n) => n.getAttribute('data-issue-id')),
    prog: Array.from(document.querySelectorAll('#kanban-col-in_progress .kanban-card-drag-handle')).map((n) => n.getAttribute('data-issue-id')),
  }));

  const before = await snapshotCards(desktop);
  await dragCard(desktop, '#kanban-col-todo', '#kanban-col-in_progress');
  const after = await snapshotCards(desktop);
  results.desktopDragMovedCard = before.todo.length > 0 && after.prog.length === before.prog.length + 1;

  // undo if we moved something: drag it back
  if (results.desktopDragMovedCard) {
    await dragCard(desktop, '#kanban-col-in_progress', '#kanban-col-todo');
  }

  // ------------------------------------------------------------------
  // 2. TOUCH: long-press drag + tap-to-open
  // ------------------------------------------------------------------
  const touch = await mkPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  wire(touch);
  await login(touch);

  results.touchGripRendered = await touch.evaluate(() =>
    !!document.querySelector('.kanban-card-drag-handle svg.lucide-grip-vertical, .kanban-card-drag-handle .touch-grip'));
  results.touchGripHiddenIdle = await touch.evaluate(() => {
    const svg = document.querySelector('.kanban-card-drag-handle svg.lucide-grip-vertical');
    if (!svg) return false;
    return getComputedStyle(svg).display === 'none';
  });

  const touchDragCard = async (page, fromSel, toSel) => {
    // Columns are 286px wide inside a horizontal overflow-x-auto strip, so a
    // 390px phone shows ONE column at a time. Center the SOURCE column in the
    // viewport (touch must land on real pixels; CDP touches outside the
    // viewport are silently ignored), scroll the source column vertically so
    // the issue card is on screen, then read boxes and clamp every touch
    // coordinate into the viewport.
    const empty = await page.evaluate((sel) => {
      const col = document.querySelector(sel);
      if (!col) return true;
      const strip = col.closest('.overflow-x-auto');
      if (strip) {
        const r = col.getBoundingClientRect();
        strip.scrollLeft += (r.x + r.width / 2) - (window.innerWidth / 2);
      }
      col.scrollTop = 0;
      const card = col.querySelector('.kanban-card-drag-handle');
      if (card) {
        const colRect = col.getBoundingClientRect();
        col.scrollTop += (card.getBoundingClientRect().y - colRect.y - 150);
      }
      return !col.querySelector('.kanban-card-drag-handle');
    }, fromSel);
    if (empty) return false;
    await page.waitForTimeout(800);
    const from = page.locator(`${fromSel} .kanban-card-drag-handle`).first();
    const to = page.locator(toSel);
    const fb = await from.boundingBox();
    const tb = await to.boundingBox();
    if (!fb || !tb) return false;
    const cx = Math.min(fb.x + fb.width / 2, 370);
    const cy = Math.min(fb.y + 30, 800);
    // Long-press: touch down and hold past the 180ms delayOnTouchOnly window.
    // Aim the drop inside the target column body (x clamped to viewport).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    await page.waitForTimeout(420); // > delay 180ms
    const dropX = Math.min(Math.max(tb.x + 60, 20), 370);
    const dropY = Math.min(tb.y + 80, 800);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const x = cx + (dropX - cx) * (i / steps);
      const y = cy + (dropY - cy) * (i / steps);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(250);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1200);
    return true;
  };

  const tBefore = await snapshotCards(touch);
  await touchDragCard(touch, '#kanban-col-todo', '#kanban-col-in_progress');
  const tAfter = await snapshotCards(touch);
  results.touchDragMovedCard = tBefore.todo.length > 0 && tAfter.prog.length === tBefore.prog.length + 1;
  if (results.touchDragMovedCard) {
    await touchDragCard(touch, '#kanban-col-in_progress', '#kanban-col-todo');
  }

  // Tap opens drawer (no drag intent, no long-press movement)
  const tapCard = touch.locator('#kanban-col-todo .kanban-card-drag-handle').first();
  if (await tapCard.count()) {
    await tapCard.tap();
    await touch.waitForTimeout(1500);
    results.touchTapOpensDrawer = await touch.evaluate(() =>
      !!document.querySelector('.slide-in-from-right, #issue-drawer, [class*="drawer"]'));
    await touch.keyboard.press('Escape');
  }

  await browser.close();

  // ------------------------------------------------------------------
  // Verdict
  // ------------------------------------------------------------------
  const failures = [];
  if (!results.login) failures.push('login failed');
  if (!results.boardReached) failures.push('board not reached');
  if (!results.desktopGripRendered) failures.push('touch-grip icon not rendered in cards');
  if (!results.desktopGripHidden) failures.push('touch-grip visible on desktop (must be hidden)');
  if (!results.desktopDragMovedCard) failures.push('desktop mouse drag did not move card between columns');
  if (!results.touchGripRendered) failures.push('touch-grip missing on touch viewport');
  if (!results.touchGripHiddenIdle) failures.push('touch-grip visible before long-press (should be hidden idle)');
  if (!results.touchDragMovedCard) failures.push('touch long-press drag did not move card between columns');
  if (!results.touchTapOpensDrawer) failures.push('touch tap did not open issue drawer');
  if (results.consoleErrors.length) failures.push(`console errors: ${results.consoleErrors.slice(0, 3).join(' | ')}`);
  if (results.pageErrors.length) failures.push(`page errors: ${results.pageErrors.slice(0, 3).join(' | ')}`);
  if (results.failedReqs.length) failures.push(`failed requests: ${results.failedReqs.slice(0, 3).join(' | ')}`);

  console.log(JSON.stringify({ pass: failures.length === 0, results, failures }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });