// Verify ICS calendar export via ExportModal (cycle 81, PB-10533):
//  - logs in as existing user
//  - opens the Export Issues modal (header button or E shortcut)
//  - asserts CSV/JSON/ICS tabs render
//  - switches to ICS, clicks Export, captures the .ics download and asserts
//    it is a valid VCALENDAR with VEVENTs
//  - asserts zero console/page errors and zero failed requests
// Usage: NODE_PATH=<node_modules with playwright> node verify_export_ics.js
const { chromium } = require('playwright');
const fs = require('fs');

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
  page.on('requestfailed', (r) => failedReqs.push(r.url()));

  const results = {};

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(process.env.QA_EMAIL || 'f@flow.com');
      await page.locator('input[type="password"]').first().fill(process.env.QA_PASSWORD || process.env.QA_PASS || 'superdev123');
      await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first().click();
      await page.waitForTimeout(2500);
    }

    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.count()) {
      await exportBtn.click();
      results.exportHeaderButton = true;
    } else {
      await page.keyboard.press('e');
      results.exportHeaderButton = false;
    }
    await page.waitForTimeout(600);

    results.modalVisible = await page.locator('text=Export Issues').first().isVisible().catch(() => false);
    results.csvTabVisible = await page.locator('button:has-text("CSV")').first().isVisible().catch(() => false);
    results.jsonTabVisible = await page.locator('button:has-text("JSON")').first().isVisible().catch(() => false);
    results.icsTabVisible = await page.locator('button:has-text("ICS")').first().isVisible().catch(() => false);

    // Switch to ICS, select the PB project (has dated cycles/milestones/issues
    // by construction), and export, capturing the download.
    await page.locator('button:has-text("ICS")').first().click();
    await page.waitForTimeout(300);
    // The modal's native select lives inside the modal overlay container;
    // the first page-level select is the board filter, so scope to the modal.
    const modalSelect = page.locator('div.fixed.inset-0 select').first();
    const pbOption = modalSelect.locator('option', { hasText: '(PB)' }).first();
    if (await pbOption.count()) {
      const pid = await pbOption.getAttribute('value');
      await modalSelect.selectOption(pid);
      await page.waitForTimeout(200);
    }
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.locator('button:has-text("Export")').last().click();
    const dl = await dlPromise;
    results.downloadFired = !!dl;
    if (dl) {
      results.downloadName = dl.suggestedFilename();
      const p = '/tmp/qa-export-' + dl.suggestedFilename();
      await dl.saveAs(p);
      const content = fs.readFileSync(p, 'utf8');
      results.icsValid = content.includes('BEGIN:VCALENDAR')
        && content.includes('BEGIN:VEVENT')
        && content.includes('END:VCALENDAR');
      results.eventCount = (content.match(/BEGIN:VEVENT/g) || []).length;
      results.hasEvents = results.eventCount > 0;
    }
    await page.waitForTimeout(1200);
    results.successVisible = await page.locator('text=Exported ICS').first().isVisible().catch(() => false);
  } catch (e) {
    results.error = String(e).slice(0, 300);
  }

  results.consoleErrors = consoleErrors;
  results.pageErrors = pageErrors;
  results.failedReqs = failedReqs;
  results.pass = results.modalVisible && results.icsTabVisible && results.downloadFired
    && results.icsValid && results.hasEvents && consoleErrors.length === 0
    && pageErrors.length === 0 && failedReqs.length === 0;
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
  process.exit(results.pass ? 0 : 1);
})();