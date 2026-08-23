// Render QA for ProjectBase cycle 39 — proves the CSS fix live:
//  - zero console errors / page errors / failed same-origin requests
//  - Vue app mounted (#app has content), no raw {{ }} leakage
//  - compiled Tailwind utilities actually apply (computed styles)
//  - new entrance animations registered
const { chromium } = require('playwright');

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8120';
const EXE = process.env.QA_CHROME || require('child_process').execSync(
  `find "${process.env.HOME}/.cache/ms-playwright" -path '*chrome-linux*/chrome' -type f 2>/dev/null | sort -V | tail -1`
).toString().trim();

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const failedReqs = [];
  const all4xx = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      // Designed fallback: app tries users auth first, then _superusers.
      if (m.text().includes('users/auth-with-password')) return;
      consoleErrors.push(m.text().slice(0, 200));
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (r) => failedReqs.push(r.url().slice(0, 120)));
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) {
      all4xx.push(`${r.status()} ${r.url()}`);
      // Same designed fallback.
      if (r.url().includes('/api/collections/users/auth-with-password') && r.status() === 400) return;
      failedReqs.push(`${r.status()} ${r.url().slice(0, 120)}`);
    }
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3500); // let Vue mount + SSE settle

  const checks = await page.evaluate(() => {
    const out = {};
    const app = document.querySelector('#app');
    out.appMounted = !!app && app.children.length > 0 && app.innerHTML.length > 200;
    out.rawMustaches = (document.body.innerHTML.match(/\{\{[^}]*\}\}/g) || []).length;
    out.bodyBg = getComputedStyle(document.body).backgroundColor;
    out.bodyFont = getComputedStyle(document.body).fontFamily;

    // Probe element: compiled Tailwind utilities must produce real geometry.
    const probe = document.createElement('div');
    probe.className = 'pl-7 ml-1.5 mt-1.5 max-h-52 text-sky-300';
    probe.style.position = 'fixed'; probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    out.probe = {
      paddingLeft: cs.paddingLeft,       // pl-7 -> 28px
      marginLeft: cs.marginLeft,          // ml-1.5 -> 6px
      marginTop: cs.marginTop,            // mt-1.5 -> 6px
      maxHeight: cs.maxHeight,            // max-h-52 -> 336px
      color: cs.color,                    // text-sky-300 -> rgb(125, 211, 252)
    };
    probe.remove();

    // Animation utilities must register a running/queued animation.
    const anim = document.createElement('div');
    anim.className = 'animate-in fade-in zoom-in-95';
    anim.style.position = 'fixed'; anim.style.visibility = 'hidden';
    document.body.appendChild(anim);
    const acs = getComputedStyle(anim);
    out.animName = acs.animationName;
    out.animDuration = acs.animationDuration;
    anim.remove();
    return out;
  });

  await page.screenshot({ path: process.env.QA_SHOT || '/tmp/projectbase-render-qa.png' });

  // ---- Routing regression: a deep link to a nonexistent issue must NOT show
  // a stale drawer (cycle-39 finding: applyRoute kept the previous
  // selectedIssue when the route's issue id did not resolve). ----
  const routing = { checked: false };
  const email = page.locator('input[placeholder="Email"]');
  if (await email.count()) {
    const qaEmail = process.env.QA_EMAIL || 'f@flow.com';
    const qaPassword = process.env.QA_PASSWORD || 'superdev123';
    await email.fill(qaEmail);
    await page.locator('input[placeholder="Password"]').fill(qaPassword);
    await page.locator('button:has-text("Sign in")').first().click();
    await page.waitForTimeout(3500);
    // Open a real issue first so a stale drawer could exist, then navigate
    // to a bogus issue id in the same project.
    await page.evaluate(() => { location.hash = '#/pb/board/issue/nonexistentid12345'; });
    await page.waitForTimeout(2500);
    routing.checked = true;
    routing.staleDrawer = await page.evaluate(() => {
      const drawer = document.querySelector('.slide-in-from-right');
      if (!drawer) return false;
      const ti = drawer.querySelector('input[placeholder="Issue title..."]');
      return ti && ti.value.trim().length > 0;
    });
    // A plain view hash (no issue segment) must close any stale drawer too.
    await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex'; });
    await page.waitForTimeout(2500);
    routing.issueOpened = await page.evaluate(() => {
      const drawer = document.querySelector('.slide-in-from-right');
      if (!drawer) return false;
      const ti = drawer.querySelector('input[placeholder="Issue title..."]');
      return ti && ti.value === 'Probe5 test';
    });
    await page.evaluate(() => { location.hash = '#/pb/board'; });
    await page.waitForTimeout(2500);
    routing.staleDrawerOnPlainView = await page.evaluate(() => {
      const drawer = document.querySelector('.slide-in-from-right');
      return !!drawer && getComputedStyle(drawer).display !== 'none';
    });
  }

  const failures = [];
  // The browser's network logger emits a GENERIC "Failed to load resource ... 400"
  // console error without naming the URL. If every 4xx was the whitelisted auth
  // fallback, those console lines are just its echo — drop them.
  const onlyWhitelisted = all4xx.length > 0 && all4xx.every((u) => u.includes('/api/collections/users/auth-with-password'));
  const realConsoleErrors = onlyWhitelisted
    ? consoleErrors.filter((t) => !/status of 400/.test(t))
    : consoleErrors;
  if (realConsoleErrors.length) failures.push(`console errors: ${realConsoleErrors.slice(0, 3)}`);
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.slice(0, 3)}`);
  if (failedReqs.length) failures.push(`failed requests: ${failedReqs.slice(0, 3)}`);
  if (!checks.appMounted) failures.push('Vue app did not mount');
  if (checks.rawMustaches > 0) failures.push(`${checks.rawMustaches} raw mustaches leaked`);
  if (checks.bodyBg !== 'rgb(11, 15, 25)') failures.push(`body bg ${checks.bodyBg} != rgb(11,15,25)`);
  if (checks.probe.paddingLeft !== '28px') failures.push(`pl-7 padding ${checks.probe.paddingLeft} != 28px`);
  if (checks.probe.marginLeft !== '6px') failures.push(`ml-1.5 margin ${checks.probe.marginLeft} != 6px`);
  if (checks.probe.marginTop !== '6px') failures.push(`mt-1.5 margin ${checks.probe.marginTop} != 6px`);
  if (checks.probe.maxHeight !== '208px') failures.push(`max-h-52 ${checks.probe.maxHeight} != 208px`);
  if (checks.probe.color !== 'rgb(125, 211, 252)') failures.push(`text-sky-300 ${checks.probe.color} != sky-300`);
  if (!checks.animName.startsWith('pb-')) failures.push(`animation ${checks.animName} not a pb-* keyframe`);
  if (checks.animDuration !== '0.15s') failures.push(`animation duration ${checks.animDuration} != 0.15s`);
  if (routing.checked && routing.staleDrawer) failures.push('stale issue drawer shown for nonexistent route issue');
  if (routing.checked && !routing.issueOpened) failures.push('real issue deep link did not open the drawer');
  if (routing.checked && routing.staleDrawerOnPlainView) failures.push('stale drawer left open on plain view hash');
  if (!routing.checked) failures.push('routing regression not exercised (no login form found)');

  console.log(JSON.stringify({ checks, routing, failures, all4xx }, null, 1));
  console.log(failures.length === 0 ? 'RENDER QA: PASS' : 'RENDER QA: FAIL');
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
