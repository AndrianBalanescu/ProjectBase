// Verify export modal (cycle 29):
//  - logs in as existing user
//  - clicks the header Export button (or presses E)
//  - asserts the Export Issues modal renders (title, CSV/JSON tabs, project select)
//  - clicks Export and asserts a success state appears (no console errors)
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
  page.on('console', (m) => {
    if (m.type() === 'error') {
      // Designed fallback: app tries users auth first, then _superusers.
      if (m.text().includes('users/auth-with-password')) return;
      consoleErrors.push(m.text().slice(0, 200));
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (req) => failedReqs.push(req.url()));

  const results = {};

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Authenticate as the demo superuser so we can see the workspace.
    const email = process.env.QA_EMAIL || 'f@flow.com';
    const pass = process.env.QA_PASS || 'superdev123';
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(email);
      const pw = page.locator('input[type="password"]').first();
      await pw.fill(pass);
      const btn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
      await btn.click();
      await page.waitForTimeout(2000);
    }

    // Open the Export modal via the header button.
    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.count()) {
      await exportBtn.click();
      await page.waitForTimeout(600);
      results['exportHeaderButton'] = true;
    } else {
      // Fallback: press E shortcut.
      await page.keyboard.press('e');
      await page.waitForTimeout(600);
      results['exportHeaderButton'] = false;
    }

    // Assert the export modal rendered.
    results['exportHeadingVisible'] = await page.locator('text=Export Issues').first().isVisible().catch(() => false);
    results['csvTabVisible'] = await page.locator('button:has-text("CSV")').first().isVisible().catch(() => false);
    results['jsonTabVisible'] = await page.locator('button:has-text("JSON")').first().isVisible().catch(() => false);
    results['sourceProjectSelect'] = await page.locator('select').first().isVisible().catch(() => false);

    // Click Export and assert a success/result state appears.
    const exportAction = page.locator('button:has-text("Export")').last();
    if (await exportAction.count()) {
      await exportAction.click();
      await page.waitForTimeout(2500);
      results['exportClicked'] = true;
      results['successStateVisible'] = await page.locator('text=Exported').first().isVisible().catch(() => false);
    } else {
      results['exportClicked'] = false;
      results['successStateVisible'] = false;
    }
  } catch (e) {
    results['error'] = String(e).slice(0, 300);
  }

  results['consoleErrors'] = consoleErrors;
  results['pageErrors'] = pageErrors;
  results['failedReqs'] = failedReqs;
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
