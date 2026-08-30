// Verify welcome modal (cycle 27): 
//  - logs in as existing user
//  - opens command palette (Ctrl+K)
//  - selects "Show Welcome Guide" action
//  - asserts the welcome modal renders (title + action rows)
//  - clicks the "Create your first project" action and asserts the project modal opens
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

    // Open the command palette (Ctrl+K).
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);
    const paletteInput = page.locator('input[placeholder*="Type a command"]').first();
    if (await paletteInput.count()) {
      await paletteInput.fill('Welcome');
      await page.waitForTimeout(400);
      // Press Enter to select the first matching action.
      await paletteInput.press('Enter');
      await page.waitForTimeout(600);
    }

    // Assert the welcome modal rendered.
    const modalHeading = await page.locator('text=Welcome to ProjectBase').first().isVisible().catch(() => false);
    const createProjectRow = await page.locator('text=Create your first project').first().isVisible().catch(() => false);
    const createIssueRow = await page.locator('text=Create an issue').first().isVisible().catch(() => false);
    results['welcomeHeadingVisible'] = modalHeading;
    results['welcomeCreateProjectRow'] = createProjectRow;
    results['welcomeCreateIssueRow'] = createIssueRow;

    // Click "Create your first project" and assert the project modal opens.
    if (createProjectRow) {
      await page.locator('text=Create your first project').first().click();
      await page.waitForTimeout(500);
      results['projectModalOpensFromWelcome'] = await page.locator('text=Create New Project').first().isVisible().catch(() => false);
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
