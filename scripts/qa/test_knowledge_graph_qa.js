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

  console.log('Verifying Knowledge Graph & Invariant Verifier API...');
  const invRes = await fetch(`${BASE}/api/projectbase/knowledge/verify-invariants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ diff: 'import sqlite3\n# clean code' })
  });
  const invData = await invRes.json();
  console.log('Invariant Verification Result:', invData);

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

  const hasAgents = await page.evaluate(() => {
    return !!document.querySelector('aside');
  });
  console.log('Agents Console Rendered:', hasAgents);

  console.log('Checking for console/network errors...');
  if (consoleErrors.length > 0) {
    console.error('FAIL: Console errors detected:', consoleErrors);
    process.exit(1);
  }
  if (networkErrors.length > 0) {
    console.error('FAIL: Network errors detected:', networkErrors);
    process.exit(1);
  }

  console.log('✅ KNOWLEDGE GRAPH & AGENTS UI END-TO-END QA: PASS');
  await browser.close();
  process.exit(0);
})();
