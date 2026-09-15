// Verify keyboard shortcuts guide (cycle 66 feature, cycle 67 QA remediation):
//  - logs in as existing user
//  - opens the Shortcuts modal via the real browser '?' keypress
//  - asserts grouped bindings render (General, Create & Migrate, Switch Views)
//  - closes via Escape, reopens via the kanban toolbar (?) button
//  - closes via "Got it", the X button, and the backdrop
//  - reopens via the command palette "Keyboard Shortcuts" entry
//  - asserts single-key shortcuts are guarded while the guide is open (press 'c'
//    with the guide open; the New Issue modal must NOT open)
//  - reports console errors / page exceptions / failed same-origin requests
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
      const sourceUrl = (m.location && m.location().url) || '';
      // Designed fallback: app tries users auth first, then _superusers.
      if (m.text().includes('users/auth-with-password') || sourceUrl.includes('/api/collections/users/auth-with-password')) return;
      consoleErrors.push(m.text().slice(0, 200));
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(BASE)) failedReqs.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) {
      // PocketBase may return 400 or 401 for the designed users-auth fallback
      // before the app retries the _superusers collection.
      if ([400, 401].includes(r.status()) && r.url().includes('/api/collections/users/auth-with-password')) return;
      failedReqs.push(`${r.request().method()} ${r.url()} -> ${r.status()}`);
    }
  });

  const results = {};
  const modalVisible = () => page.evaluate(() => {
    const app = document.querySelector('#app');
    return !!(app && /Keyboard Shortcuts/.test(app.textContent || '') && document.querySelector('.fixed.inset-0'));
  });

  try {
    // 1. Login
    await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const email = page.locator('input[placeholder="Email"]');
    if (await email.count()) {
      await email.fill(process.env.QA_EMAIL || 'f@flow.com');
      await page.locator('input[placeholder="Password"]').fill(process.env.QA_PASSWORD || 'superdev123');
      await page.locator('button:has-text("Sign in")').first().click();
      await page.waitForTimeout(3000);
    }
    // Land on the board view
    await page.goto(BASE + '/#/pb/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    results.boardLoaded = await page.evaluate(() => !!document.querySelector('#app'));

    // Dismiss the welcome modal if shown (first login state) so single-key
    // shortcuts are active.
    const welcomeClose = page.locator('button:has-text("Got it"), button[aria-label*="lose"]').first();
    if (await welcomeClose.count()) {
      await welcomeClose.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // 2. Open via real '?' keypress
    await page.keyboard.press('Shift+Slash'); // canonical '?' on US layouts
    await page.waitForTimeout(700);
    results.openViaKey = await modalVisible();
    results.groupsPresent = results.openViaKey ? await page.evaluate(() => {
      const t = document.querySelector('#app').textContent || '';
      return {
        general: /General/.test(t),
        createMigrate: /Create & Migrate|Create &amp; Migrate/.test(t),
        switchViews: /Switch Views/.test(t),
      };
    }) : null;

    // 3. Guard check while guide is open: press 'c' — New Issue modal must NOT open
    if (results.openViaKey) {
      await page.keyboard.press('c');
      await page.waitForTimeout(600);
      results.guardHoldsWhileOpen = await page.evaluate(() => {
        const t = document.querySelector('#app').textContent || '';
        return !/What needs to be done\?/.test(t);
      });
    }

    // 4. Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    results.closedViaEscape = !(await modalVisible());

    // 5. Reopen via toolbar (?) button
    const qBtn = page.locator('button[title*="Keyboard shortcuts"]:visible').first();
    results.toolbarButtonPresent = await qBtn.count() > 0;
    if (results.toolbarButtonPresent) {
      await qBtn.click();
      await page.waitForTimeout(700);
      results.openViaToolbarButton = await modalVisible();

      // 6. Close via "Got it"
      const gotIt = page.locator('button:has-text("Got it")').first();
      results.gotItPresent = await gotIt.count() > 0;
      if (results.gotItPresent) {
        await gotIt.click();
        await page.waitForTimeout(500);
        results.closedViaGotIt = !(await modalVisible());
      }

      // 7. Reopen via toolbar button, close via X
      if (results.toolbarButtonPresent) {
        await qBtn.click();
        await page.waitForTimeout(700);
        const xBtn = page.locator('button[aria-label="Close shortcuts guide"]').first();
        results.xButtonPresent = await xBtn.count() > 0;
        if (results.xButtonPresent) {
          await xBtn.click();
          await page.waitForTimeout(500);
          results.closedViaX = !(await modalVisible());
        }

        // 8. Reopen via toolbar button, close via backdrop
        await qBtn.click();
        await page.waitForTimeout(700);
        await page.mouse.click(20, 500); // far left edge = backdrop
        await page.waitForTimeout(500);
        results.closedViaBackdrop = !(await modalVisible());
      }
    }

    // 9. Reopen via command palette entry
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(800);
    // Palette rows are clickable wrappers around the title div; type to filter
    // first so exactly one row matches, then click the row.
    await page.keyboard.type('Keyboard Shortcuts', { delay: 40 });
    await page.waitForTimeout(400);
    const paletteEntry = page.locator(
      '.max-h-96 .cursor-pointer:has(.text-xs.font-medium:text-is("Keyboard Shortcuts"))'
    ).first();
    results.paletteEntryPresent = await paletteEntry.count() > 0;
    if (results.paletteEntryPresent) {
      await paletteEntry.click();
      await page.waitForTimeout(700);
      results.openViaPalette = await modalVisible();
    }
  } catch (e) {
    results.error = String(e).slice(0, 300);
  }

  results.consoleErrors = consoleErrors;
  results.pageErrors = pageErrors;
  results.failedRequests = failedReqs;

  console.log(JSON.stringify(results, null, 1));
  const pass = results.boardLoaded && results.openViaKey && results.closedViaEscape
    && results.openViaToolbarButton && results.closedViaGotIt && results.closedViaX
    && results.closedViaBackdrop && results.openViaPalette && results.guardHoldsWhileOpen
    && results.groupsPresent?.general && results.groupsPresent?.createMigrate
    && results.groupsPresent?.switchViews
    && consoleErrors.length === 0 && pageErrors.length === 0 && failedReqs.length === 0;
  console.log(pass ? 'SHORTCUTS QA: PASS' : 'SHORTCUTS QA: FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
