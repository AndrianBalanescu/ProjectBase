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
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (r) => failedReqs.push(r.url().slice(0, 120)));
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) failedReqs.push(`${r.status()} ${r.url().slice(0, 120)}`);
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

  const failures = [];
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.slice(0, 3)}`);
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

  console.log(JSON.stringify({ checks, failures }, null, 1));
  console.log(failures.length === 0 ? 'RENDER QA: PASS' : 'RENDER QA: FAIL');
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
