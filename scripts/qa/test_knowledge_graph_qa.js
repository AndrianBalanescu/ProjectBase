const { chromium } = require('playwright');
const path = require('path');

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
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('favicon') && !resp.url().includes('auth-with-password')) {
      networkErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  console.log('Authenticating with superuser...');
  const authRes = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'f@flow.com', password: 'superdev123' })
  });
  const authData = await authRes.json();
  const token = authData.token;
  const record = authData.record;

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, record }) => {
    const authStore = { token, model: record };
    localStorage.setItem('pocketbase_auth', JSON.stringify(authStore));
    localStorage.setItem('pb_auth', JSON.stringify(authStore));
  }, { token, record });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Navigating to Agents view...');
  await page.click('button:has-text("Agents")');
  await page.waitForTimeout(1000);

  console.log('Switching to Knowledge Graph tab...');
  await page.evaluate(() => {
    const sel = document.querySelector('select');
    if (sel) {
      sel.value = 'knowledge';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(1500);

  // Assert Knowledge Graph elements
  const pageContent = await page.content();
  const hasKnowledgeHeader = pageContent.includes('Autonomous Knowledge Graph');
  const hasInvariantsTab = pageContent.includes('Architectural Invariants');
  const hasAdrsTab = pageContent.includes('Architectural Decision Records');
  const hasPlayground = pageContent.includes('Invariant Verifier Playground');

  console.log('Knowledge Header Visible:', hasKnowledgeHeader);
  console.log('Invariants Tab Visible:', hasInvariantsTab);
  console.log('ADRs Tab Visible:', hasAdrsTab);
  console.log('Playground Tab Visible:', hasPlayground);

  // Test switching subtabs
  console.log('Clicking ADRs subtab...');
  await page.click('button:has-text("Architectural Decision Records")');
  await page.waitForTimeout(500);

  console.log('Clicking Invariants subtab...');
  await page.click('button:has-text("Architectural Invariants")');
  await page.waitForTimeout(500);

  console.log('Clicking Verifier Playground subtab...');
  await page.click('button:has-text("Invariant Verifier Playground")');
  await page.waitForTimeout(500);

  // Click Verify button in playground
  console.log('Executing live Invariant verification in UI...');
  await page.click('button:has-text("Verify Invariants")');
  await page.waitForTimeout(1500);

  const updatedContent = await page.content();
  const hasVerdict = updatedContent.includes('VERDICT:');
  console.log('Verification Verdict Rendered:', hasVerdict);

  console.log('Console Errors Count:', consoleErrors.length);
  console.log('Network Errors Count:', networkErrors.length);

  if (!hasKnowledgeHeader || !hasVerdict) {
    console.error('FAIL: Knowledge Graph UI verification failed');
    process.exit(1);
  }

  if (consoleErrors.length > 0) {
    console.error('FAIL: Console errors detected:', consoleErrors);
    process.exit(1);
  }

  console.log('✅ KNOWLEDGE GRAPH UI END-TO-END QA: PASS');
  await browser.close();
})();
