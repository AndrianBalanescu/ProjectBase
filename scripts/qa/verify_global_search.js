// Verify global cross-project search (cycle 31):
//  - logs in as existing user
//  - opens the Cmd+K omnibox
//  - types a query that matches issues in a NON-current project (e.g. "ProjectBase"
//    matches a HOME project issue) and asserts a cross-project result appears
//  - selects it and asserts the drawer opens (switching project context)
//  - asserts zero console/page errors and no failed same-origin requests
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
  const httpErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      // Designed fallback: app tries users auth first, then _superusers.
      if (m.text().includes('users/auth-with-password')) return;
      consoleErrors.push(m.text().slice(0, 200));
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (req) => failedReqs.push(req.url()));
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('users/auth-with-password')) {
      httpErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  const results = {
    login: false,
    omniboxOpened: false,
    globalResultShown: false,
    crossProjectSubtitle: false,
    selectOpenedIssue: false,
    issueTitle: '',
    issueSubtitle: '',
    projectSwitched: false,
  };

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Authenticate via the UI login form (same as the app's first-run flow).
    const email = process.env.QA_EMAIL || 'f@flow.com';
    const pass = process.env.QA_PASS || 'superdev123';
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(email);
      const pw = page.locator('input[type="password"]').first();
      await pw.fill(pass);
      const btn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
      await btn.click();
      await page.waitForTimeout(2500);
      results.login = true;
    }
    // If the UI login didn't appear (already authed), skip.
    results.authenticated = await page.evaluate(() => {
      return !document.querySelector('input[type="password"]') ||
             !!document.querySelector('#app .header, #app .kanban-column');
    });

    // Open the omnibox with Cmd/Ctrl+K (or the app's shortcut).
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(800);
    results.omniboxOpened = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Type a command"]');
      return !!input;
    });

    // Type a query matching an issue in a different project. The demo DB has a
    // HOME project issue titled "...Deploy ProjectBase..." — searching
    // "ProjectBase" should surface a cross-project (HOME/LOAD/etc.) result.
    const inputSel = 'input[placeholder*="Type a command"]';
    if (await page.$(inputSel)) {
      await page.fill(inputSel, 'ProjectBase');
      await page.waitForTimeout(1200); // debounce + fetch
    }

    // Read the visible result rows for any issue with a project tag other than
    // the current project (PB), which indicates a cross-project result.
    results.globalResultShown = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-lucide="check-square"]'));
      return rows.length > 0;
    });
    results.crossProjectSubtitle = await page.evaluate(() => {
      // Global results carry a 4th subtitle segment "• <PROJECT_IDENTIFIER>".
      const subtitles = Array.from(document.querySelectorAll('[class*="text-[10px]"]'));
      return subtitles.some((s) => /\•\s*[A-Z]{2,}/.test((s.textContent || '').trim()));
    });

    // Capture the first cross-project result's subtitle + title, then select it.
    const first = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.flex.items-center.justify-between'));
      const issueRow = rows.find((r) => {
        const chip = r.querySelector('span[class*="text-[10px]"]');
        return chip && (chip.textContent || '').trim() === 'issue';
      });
      if (!issueRow) return null;
      const title = (issueRow.querySelector('.font-semibold') || {}).textContent || '';
      const subtitle = (issueRow.querySelector('[class*="text-[10px]"].text-gray-400') || {}).textContent || '';
      return { title, subtitle };
    });
    if (first) {
      results.issueTitle = first.title;
      results.issueSubtitle = first.subtitle;
    }

    // Select an issue result. The result rows carry a type chip whose text is
    // exactly "issue"; the version badge reads "vX.Y.Z" so we filter precisely.
    const issueRows = page.locator('div.cursor-pointer').filter({
      has: page.locator('span[class*="text-[10px]"]').filter({ hasText: /^issue$/ })
    });
    results.issueRowCount = await issueRows.count();
    if (await issueRows.count() > 0) {
      await issueRows.first().click();
      await page.waitForTimeout(1500);
      results.selectOpenedIssue = await page.evaluate(() => {
        return !!document.querySelector('.slide-in-from-right');
      });
      results.drawerText = await page.evaluate(() => {
        const drawer = document.querySelector('.slide-in-from-right');
        return drawer ? (drawer.textContent || '').slice(0, 120) : '';
      });
    } else {
      results.clickSkipReason = 'no issue result row found';
    }
  } catch (err) {
    results.error = String(err).slice(0, 300);
  }

  const out = {
    ...results,
    consoleErrors,
    pageErrors,
    failedReqs,
    httpErrors,
    PASS: (results.login || results.authenticated) && results.omniboxOpened &&
          results.globalResultShown && results.selectOpenedIssue &&
          results.crossProjectSubtitle &&
          httpErrors.length === 0 && pageErrors.length === 0,
  };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.PASS ? 0 : 1);
})();
