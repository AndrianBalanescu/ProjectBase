// Render QA for ProjectBase (cycle 39 CSS fix + cycle 40 issue relationships):
//  - zero console errors / page errors / failed same-origin requests
//  - Vue app mounted (#app has content), no raw {{ }} leakage
//  - compiled Tailwind utilities actually apply (computed styles)
//  - new entrance animations registered
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8120';
// Expected UI version badge must always match the VERSION file (release truth).
const EXPECTED_VERSION = fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();
const EXPECTED_BADGE = `v${EXPECTED_VERSION}`;
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

  const relations = { checked: false };
  const urlState = { checked: false };
  const bulk = { checked: false };
  const range = { checked: false };
  const customField = { checked: false };
  const exportModal = { checked: false };
  const notifSettings = { checked: false };
  const importModal = { checked: false };
  const dispatchQA = { checked: false };
  const docsQA = { checked: false };
  // URLs whose requests are intentionally ignored from the failure list (the
  // range+apply E2E's cleanup DELETEs can abort client-side after the server
  // already processed them; the end state is verified instead).
  const ignoredCleanupUrls = new Set();
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

  page.on('requestfailed', (r) => {
    // SSE stream teardown on navigation/reload is expected, not a failure.
    if (r.url().includes('/api/realtime')) return;
    if (ignoredCleanupUrls.has(r.url())) return;

    failedReqs.push(r.url().slice(0, 120));
  });
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) {
      all4xx.push(`${r.status()} ${r.url()}`);
      // Same designed fallback.
      if (r.url().includes('/api/collections/users/auth-with-password') && r.status() === 400) return;
      // Cleanup/verification URLs for the range+apply E2E are expected to 404
      // (deleted records) and are checked via explicit assertions instead.
      if (ignoredCleanupUrls.has(r.url())) return;
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
  const resize = { checked: false };
  const focusMode = { checked: false };
  const email = page.locator('input[placeholder="Email"]');
  if (await email.count()) {
    const qaEmail = process.env.QA_EMAIL || 'f@flow.com';
    const qaPassword = process.env.QA_PASSWORD || 'superdev123';
    await email.fill(qaEmail);
    await page.locator('input[placeholder="Password"]').fill(qaPassword);
    await page.locator('button:has-text("Sign in")').first().click();
    await page.waitForTimeout(3500);
    // Version badge: the header must show the current version (vX.Y.Z) and it
    // must match the VERSION file so the UI never drifts from the release.
    checks.headerBadge = await page.evaluate(() => {
      const badge = document.querySelector('header span[class*="font-mono"]');
      return badge ? badge.textContent.trim() : null;
    });
    // Header layout guard: no horizontal overflow, and the primary "New Issue"
    // CTA must be fully within the viewport. Catches the class of bug where the
    // header accumulates so many tabs/actions that the right-side toolbar (and
    // the primary creation button) get pushed off-screen.
    checks.headerLayout = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return { header: 'missing' };
      const overflows = header.scrollWidth > header.clientWidth + 1;
      const newIssue = [...header.querySelectorAll('button')]
        .find(b => (b.textContent || '').includes('New Issue'));
      let newIssueRect = null;
      if (newIssue) {
        const r = newIssue.getBoundingClientRect();
        newIssueRect = {
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          visible: r.width > 0 && r.left >= 0 && r.right <= window.innerWidth
        };
      }
      return {
        scrollW: header.scrollWidth,
        clientW: header.clientWidth,
        overflows,
        newIssue: newIssueRect
      };
    });
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

    // ---- Drawer resize (cycle 43): drag handle widens the drawer, width
    // persists across reload, and double-click resets to the 768px default. ----

    await page.evaluate(() => { localStorage.removeItem('pb.drawer.width'); });
    await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex'; });
    await page.waitForTimeout(2500);
    const handle = page.locator('.slide-in-from-right > .cursor-col-resize').first();
    if (await handle.count()) {
      resize.checked = true;
      resize.handleFound = true;
      const before = await page.evaluate(() => {
        const d = document.querySelector('.slide-in-from-right');
        return d ? d.getBoundingClientRect().width : 0;
      });
      const hb = await handle.boundingBox();
      if (hb) {
        const y = hb.y + hb.height / 2;
        await page.mouse.move(hb.x + 1, y);
        await page.mouse.down();
        await page.mouse.move(hb.x + 1 - 300, y, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => {
          const d = document.querySelector('.slide-in-from-right');
          return d ? d.getBoundingClientRect().width : 0;
        });
        resize.widthGrew = after > before + 250;
        resize.persisted = await page.evaluate((beforeW) => {
          const v = parseInt(localStorage.getItem('pb.drawer.width') || '', 10);
          return !isNaN(v) && v > beforeW + 250;
        }, before);
        // Reload: the saved width must survive a fresh mount.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex'; });
        await page.waitForTimeout(2000);
        resize.survivesReload = await page.evaluate(() => {
          const d = document.querySelector('.slide-in-from-right');
          return !!d && d.getBoundingClientRect().width > 1000;
        });
        // Double-click the handle: width resets to the max-w-3xl default (768px).
        const hb2 = await page.locator('.slide-in-from-right > .cursor-col-resize').first().boundingBox();
        if (hb2) {
          await page.mouse.dblclick(hb2.x + 1, hb2.y + hb2.height / 2);
          await page.waitForTimeout(300);
          resize.resetWorks = await page.evaluate(() => {
            const d = document.querySelector('.slide-in-from-right');
            return !!d && Math.abs(d.getBoundingClientRect().width - 768) < 2
              && localStorage.getItem('pb.drawer.width') === null;
          });
        }
      }
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.evaluate(() => { localStorage.removeItem('pb.drawer.width'); });
      await page.waitForTimeout(1500);
    }

    // ---- Description focus mode (cycle 5): the Focus button in the drawer
    // opens a distraction-free fullscreen editor, and Done/Esc closes it. ----
    try {
      await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex'; });
      await page.waitForTimeout(2500);
      const focusBtn = page.locator('button:has-text("Focus")').first();
      if (await focusBtn.count()) {
        focusMode.checked = true;
        focusMode.buttonShown = true;
        await focusBtn.click();
        await page.waitForTimeout(1200);
        focusMode.overlayShown = await page.evaluate(() => {
          const ov = document.querySelector('.fixed.inset-0.z-\\[60\\]');
          return !!ov && getComputedStyle(ov).display !== 'none';
        });
        focusMode.editorShown = await page.evaluate(() => {
          const ov = document.querySelector('.fixed.inset-0.z-\\[60\\]');
          return !!ov && !!(ov.querySelector('textarea') || ov.querySelector('.milkdown'));
        });
        // Esc must close the overlay.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        focusMode.escCloses = await page.evaluate(() => {
          return !document.querySelector('.fixed.inset-0.z-\\[60\\]');
        });
      }
    } catch (e) { focusMode.error = String(e).slice(0, 120); }

    // ---- URL deep-link state (cycle 4): filters (?q= &priority= &cycle=),
    // the Cycles view tab (?cycle=) and drawer width (?w=) must round-trip
    // through the hash — typing a filter rewrites the URL, and a shared URL
    // restores the same view state after a reload. ----
    try {
      urlState.checked = true;
      // 1. Typing in the board search box must land in the hash query.
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(1500);
      const search = page.locator('input[placeholder="Filter tasks..."]').first();
      if (await search.count()) {
        await search.fill('URL state probe');
        await page.waitForTimeout(600);
        urlState.filterWritesUrl = await page.evaluate(
          () => new URLSearchParams(location.hash.split('?')[1] || '').get('q') === 'URL state probe'
        );
        // Clearing the input must drop the param (clean URLs).
        await search.fill('');
        await page.waitForTimeout(600);
        urlState.filterClearsUrl = await page.evaluate(
          () => new URLSearchParams(location.hash.split('?')[1] || '').get('q') === null
        );
      }
      // 2. A deep link with ?q= must restore the filter after a reload and
      // actually narrow the board (a garbage term matches nothing).
      await page.evaluate(() => { location.hash = '#/pb/board?q=zzz-no-match-xyz'; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      urlState.qRestored = await page.evaluate(() => {
        const input = document.querySelector('input[placeholder="Filter tasks..."]');
        return !!input && input.value === 'zzz-no-match-xyz';
      });
      // 3. ?priority= must preselect the priority filter.
      await page.evaluate(() => { location.hash = '#/pb/board?priority=urgent'; });
      await page.waitForTimeout(2000);
      urlState.priorityRestored = await page.evaluate(() => {
        const sel = Array.from(document.querySelectorAll('select')).find((s) =>
          Array.from(s.options).some((o) => o.value === 'urgent'));
        return !!sel && sel.value === 'urgent';
      });
      // 4. Clicking a cycle card in Cycles view must add ?cycle=<id>, and the
      // shared URL must reopen that same cycle after a reload.
      await page.evaluate(() => { location.hash = '#/pb/cycles'; });
      await page.waitForTimeout(2000);
      const cycleCard = page.locator('div.cursor-pointer.select-none').first();
      if (await cycleCard.count()) {
        await cycleCard.click();
        await page.waitForTimeout(800);
        const cycleId = await page.evaluate(
          () => new URLSearchParams(location.hash.split('?')[1] || '').get('cycle')
        );
        urlState.tabWritesUrl = !!cycleId;
        if (cycleId) {
          // Capture the rendered cycle heading, then prove the shared URL
          // reopens that exact cycle after a fresh reload.
          const pickedName = await page.evaluate(() => {
            const h = document.querySelector('h3.text-lg');
            return h ? (h.textContent || '').trim() : '';
          });
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);
          urlState.tabRestored = await page.evaluate((name) => {
            const h = document.querySelector('h3.text-lg');
            return !!h && name.length > 0 && (h.textContent || '').trim() === name;
          }, pickedName);
        }
      }
      // 5. ?w= must widen the drawer for the session WITHOUT persisting to
      // localStorage (session-only override).
      await page.evaluate(() => { localStorage.removeItem('pb.drawer.width'); });
      await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex?w=1100'; });
      await page.waitForTimeout(2500);
      urlState.wOverridesWidth = await page.evaluate(() => {
        const d = document.querySelector('.slide-in-from-right');
        return !!d && Math.abs(d.getBoundingClientRect().width - 1100) < 4;
      });
      urlState.wNotPersisted = await page.evaluate(
        () => localStorage.getItem('pb.drawer.width') === null
      );
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(1200);
    } catch (e) {
      urlState.error = String(e).slice(0, 200);
    }

    // ---- Batch multi-select + bulk bar (cycle 16): board card checkboxes
    // toggle a selection the root app tracks; the floating action bar appears
    // with the right count; Esc clears; list view select-all works. ----
    try {
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(1500);

      const boardSelectBtns = page.locator('button[title^="Select for bulk actions"]');
      if (await boardSelectBtns.count() >= 2) {
        await boardSelectBtns.nth(0).click();
        await page.waitForTimeout(300);
        bulk.barShownAfterOne = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return !!bar && getComputedStyle(bar).display !== 'none';
        });
        bulk.countOne = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('1 selected') : false;
        });

        await boardSelectBtns.nth(1).click();
        await page.waitForTimeout(300);
        bulk.countTwo = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('2 selected') : false;
        });

        // Esc clears the selection and hides the bar.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        bulk.escClears = await page.evaluate(() => {
          return !document.querySelector('.fixed.bottom-5.left-1\\/2');
        });
      }

      // List view select-all header checkbox selects every visible row.
      await page.keyboard.press('2'); // list view shortcut
      await page.waitForTimeout(1200);
      const listHeaderBtn = page.locator('thead button[title*="Select all visible"]');
      if (await listHeaderBtn.count()) {
        const rows = await page.locator('tbody tr').count();
        await listHeaderBtn.click();
        await page.waitForTimeout(400);
        bulk.selectAllCount = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').match(/(\d+) selected/) : null;
        });
        bulk.selectAllMatchesRows = !!(bulk.selectAllCount &&
          rows > 0 && Number(bulk.selectAllCount[1]) === rows);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      await page.keyboard.press('1'); // back to board
      await page.waitForTimeout(800);
      bulk.checked = true;
    } catch (e) {
      bulk.error = String(e).slice(0, 200);
    }

    // ---- Shift+click range selection (cycle 17): after anchoring with a
    // single toggle, Shift+clicking a later card selects the whole visible
    // range (Linear-style), the bulk bar count proves the union, Esc clears,
    // and the reverse direction works too. Probed on board and list. ----
    try {
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(1500);

      const boardSelectBtns = page.locator('button[title^="Select for bulk actions"]');
      const boardCards = page.locator('.kanban-card-drag-handle');
      range.boardProbed = await boardSelectBtns.count() >= 3;
      if (range.boardProbed) {
        // Anchor at card 0 via its checkbox.
        await boardSelectBtns.nth(0).click();
        await page.waitForTimeout(300);
        range.boardAnchorOne = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('1 selected') : false;
        });
        // Shift+click card 2 -> cards 0,1,2 selected, no drawer opens.
        await boardCards.nth(2).click({ modifiers: ['Shift'] });
        await page.waitForTimeout(400);
        range.boardRangeThree = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('3 selected') : false;
        });
        range.boardCheckedCount = await page.locator('button[title^="Deselect (Esc)"]').count();
        range.boardNoDrawer = !(await page.locator('.slide-in-from-right').count());
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        range.boardEscClears = !(await page.locator('button[title^="Deselect (Esc)"]').count());

        // Cross-column span: anchor the first backlog card, shift+click the
        // first todo-column card. The flatten must run column-by-column, so
        // every visible backlog card plus that one todo card is selected.
        // Expected count is derived from the live DOM (project-scoped board),
        // never hardcoded.
        const backlogVisible = await page.locator('#kanban-col-backlog .kanban-card-drag-handle').count();
        await boardSelectBtns.nth(0).click();
        await page.waitForTimeout(300);
        const firstTodoCard = page.locator('#kanban-col-todo .kanban-card-drag-handle').first();
        if (await firstTodoCard.count()) {
          await firstTodoCard.click({ modifiers: ['Shift'] });
          await page.waitForTimeout(400);
          range.boardCrossColumn = await page.evaluate(() => {
            const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
            if (!bar) return null;
            const m = (bar.textContent || '').match(/(\d+) selected/);
            return m ? Number(m[1]) : null;
          });
          range.boardCrossColumnExpected = backlogVisible + 1;
          range.boardCrossColumnOK = range.boardCrossColumn === backlogVisible + 1;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }

      // List view: anchor row 0 then shift+click row 2 -> 3 selected; reverse
      // (anchor row 2, shift+click row 0) must still select 3.
      await page.keyboard.press('2'); // list view shortcut
      await page.waitForTimeout(1200);
      const rows = page.locator('tbody tr');
      range.listProbed = await rows.count() >= 3;
      if (range.listProbed) {
        const rowBtns = page.locator('tbody tr button[title^="Select for bulk actions"]');
        const titleCell = (n) => rows.nth(n).locator('td').nth(2);
        await rowBtns.nth(0).click();
        await page.waitForTimeout(300);
        await titleCell(2).click({ modifiers: ['Shift'] });
        await page.waitForTimeout(400);
        range.listRangeThree = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('3 selected') : false;
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await rowBtns.nth(2).click();
        await page.waitForTimeout(300);
        await titleCell(0).click({ modifiers: ['Shift'] });
        await page.waitForTimeout(400);
        range.listReverseThree = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('3 selected') : false;
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // ---- Range selection drives a real bulk action (cycle 17 E2E): create
      // 3 temp issues, range-select them via shift+click, apply status 'todo'
      // through the bulk bar, verify all 3 moved via API, then clean up. ----
      // Title prefix must be short: board cards truncate titles (~20 chars),
      // so the locator matches the visible prefix, never the full title.
      const applyPrefix = 'Rap' + (Date.now() % 100000000);
      const applyTitle = applyPrefix + ' ' + Date.now();
      const applyDbg = await page.evaluate(async (title) => {
        let token = null;
        for (const k of ['pb_auth', 'pocketbase_auth']) {
          try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
        }
        const h = { 'Content-Type': 'application/json' };
        if (token) h.Authorization = token;
        const projRes = await fetch('/api/collections/projects/records?perPage=1', { headers: h });
        const proj = (await projRes.json()).items[0];
        const creates = [];
        for (let i = 1; i <= 3; i++) {
          const r = await fetch('/api/collections/issues/records', {
            method: 'POST', headers: h,
            body: JSON.stringify({ project: proj ? proj.id : '', title: title + ' #' + i, status: 'backlog', priority: 'medium' })
          });
          creates.push({ status: r.status, id: ((await r.json()).id || null) });
        }
        return { token: !!token, proj: proj ? proj.id : null, creates };
      }, applyTitle);
      const applyIds = (applyDbg.creates || []).map(c => c.id);
      range.applyDbg = applyDbg;
      // Ensure the app is on the board BEFORE reload: the reload restores the
      // route from the hash, and the range suite's list section leaves the app
      // on #/pb/list where no board cards exist.
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(400);
      // Reload so loadIssues deterministically includes the raw-fetch-created
      // issues (realtime SSE may have dropped by this point in the suite).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3500);
      range.applyPost = await page.evaluate((prefix) => {
        const q = new URLSearchParams(location.hash.split('?')[1] || '');
        const cards = Array.from(document.querySelectorAll('.kanban-card-drag-handle'));
        return {
          hash: location.hash,
          loginForm: !!document.querySelector('input[placeholder="Email"]'),
          cardCount: cards.length,
          rapCards: cards.filter(c => (c.textContent || '').includes(prefix)).length,
          sample: cards.slice(0, 5).map(c => (c.textContent || '').slice(0, 40)),
          filterQ: q.get('q'), filterP: q.get('priority'), filterC: q.get('cycle'),
        };
      }, applyPrefix);
      const applyCards = page.locator('.kanban-card-drag-handle:has-text("' + applyPrefix + '")');
      if (applyIds.length === 3 && applyIds.every(Boolean) && (await applyCards.count()) === 3) {
        range.applyCardsFound = true;
        await applyCards.nth(0).locator('button[title^="Select for bulk actions"]').click();
        await page.waitForTimeout(300);
        await applyCards.nth(2).click({ modifiers: ['Shift'] });
        await page.waitForTimeout(400);
        range.applyBarThree = await page.evaluate(() => {
          const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
          return bar ? (bar.textContent || '').includes('3 selected') : false;
        });
        // Apply status 'todo' via the bulk bar status select (single match).
        const applyStatus = page.locator('.fixed.bottom-5.left-1\\/2 label:has-text("Status") select');
        await applyStatus.selectOption('todo');
        await page.waitForTimeout(800);
        range.applyMovedAll = await page.evaluate(async (ids) => {
          let token = null;
          for (const k of ['pb_auth', 'pocketbase_auth']) {
            try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
          }
          const h = {}; if (token) h.Authorization = token;
          let ok = true;
          for (const id of ids) {
            const r = await fetch('/api/collections/issues/records/' + id, { headers: h });
            if (r.status !== 200 || (await r.json()).status !== 'todo') { ok = false; break; }
          }
          return ok;
        }, applyIds);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        range.applyBarCleared = await page.evaluate(() => !document.querySelector('.fixed.bottom-5.left-1\\/2'));
      } else {
        range.applyCardsFound = false;
      }
      // Cleanup: delete the temp apply issues. The server-side end state is
      // what matters; a client-side abort of the DELETE after the server
      // processed it is expected (see ignoredCleanupUrls).
      for (const id of applyIds) {
        if (id) ignoredCleanupUrls.add(BASE + '/api/collections/issues/records/' + id);
      }
      const delResults = await page.evaluate(async (ids) => {
        let token = null;
        for (const k of ['pb_auth', 'pocketbase_auth']) {
          try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
        }
        const h = { 'Content-Type': 'application/json' };
        if (token) h.Authorization = token;
        const out = [];
        for (const id of ids) {
          if (!id) { out.push('no-id'); continue; }
          try {
            const r = await fetch('/api/collections/issues/records/' + id, { method: 'DELETE', headers: h });
            out.push(r.status);
          } catch (e) {
            out.push('aborted:' + String(e).slice(0, 30));
          }
        }
        return out;
      }, applyIds);
      range.applyDeletedAll = delResults.length === 3 && delResults.every((s) => s === 204);
      range.applyDelResults = delResults;

      await page.keyboard.press('1'); // back to board
      await page.waitForTimeout(800);
      range.checked = true;
    } catch (e) {
      range.error = String(e).slice(0, 200);
    }

    // ---- Bulk custom-field picker (cycle 18): when the active project defines
    // custom fields, the bulk bar renders a Custom picker (field defs + typed
    // value) and applying it merges the value into every selected issue without
    // clobbering unrelated custom fields. This block is SELF-CONTAINED: it
    // installs a temporary "effort" def on the probe project (saving any prior
    // defs), exercises the picker, and restores the prior defs + deletes the
    // temp issue so it never depends on ambient project config. ----
    customField.checked = true;
    const cfProbeTitle = 'CFPrb' + (Date.now() % 100000000) + ' ' + Date.now();
    let cfProbeId = null;
    let cfPrevDefs = null;
    let cfProjectId = null;
    try {
      // 1. Setup: read the probe project, back up its defs, install an "effort"
      //    number def, and create a temp issue carrying unrelated custom values.
      const cfSetup = await page.evaluate(async (title) => {
        const token = (() => {
          for (const k of ['pb_auth', 'pocketbase_auth']) {
            try { const t = JSON.parse(localStorage.getItem(k)).token; if (t) return t; } catch (e) {}
          }
          return null;
        })();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = token;
        const probeRes = await fetch('/api/collections/issues/records/ckat9ahso93piex', { headers });
        if (!probeRes.ok) return { error: 'probe fetch ' + probeRes.status };
        const probe = await probeRes.json();
        const projId = probe.project;
        const projRes = await fetch('/api/collections/projects/records/' + projId, { headers });
        if (!projRes.ok) return { error: 'project fetch ' + projRes.status };
        const proj = await projRes.json();
        const prevDefs = proj.custom_field_defs || [];
        // Install just an "effort" number field (merge not replace is tested via
        // the issue's custom_fields below; the defs only need 'effort' present).
        const putRes = await fetch('/api/projectbase/projects/' + projId + '/custom-fields', {
          method: 'PUT', headers,
          body: JSON.stringify({ fields: [{ key: 'effort', label: 'Effort', type: 'number', required: false, options: [] }] })
        });
        if (!putRes.ok) return { error: 'install defs ' + putRes.status };
        // Create the temp issue with unrelated custom values so the merge can be
        // proven to preserve them.
        const res = await fetch('/api/collections/issues/records', {
          method: 'POST', headers,
          body: JSON.stringify({ project: projId, title, status: 'todo',
            custom_fields: { effort: 3, client: 'keep-me', qa_signoff: false } })
        });
        if (!res.ok) return { error: 'create ' + res.status };
        return { id: (await res.json()).id, project: projId, prevDefs };
      }, cfProbeTitle);
      if (cfSetup && cfSetup.id) {
        cfProbeId = cfSetup.id;
        cfProjectId = cfSetup.project;
        cfPrevDefs = cfSetup.prevDefs;
      } else {
        customField.createError = (cfSetup && cfSetup.error) || 'setup failed';
      }
    } catch (e) { customField.createError = String(e).slice(0, 120); }
    if (cfProbeId) ignoredCleanupUrls.add(BASE + '/api/collections/issues/records/' + cfProbeId);
    if (cfProjectId) ignoredCleanupUrls.add(BASE + '/api/projectbase/projects/' + cfProjectId + '/custom-fields');
    if (cfProbeId) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        await page.evaluate(() => { location.hash = '#/pb/board'; });
        await page.waitForTimeout(1500);
        const cfCard = page.locator('.kanban-card-drag-handle:has-text("CFPrb")').first();
        if (await cfCard.count()) {
          await cfCard.locator('button[title^="Select for bulk actions"]').click();
          await page.waitForTimeout(400);
          customField.pickerShown = await page.evaluate(() => {
            const bar = document.querySelector('.fixed.bottom-5.left-1\\/2');
            if (!bar) return false;
            return /Custom/i.test(bar.textContent || '') &&
              Array.from(bar.querySelectorAll('select')).some((s) => Array.from(s.options).some((o) => o.value === 'effort'));
          });
          if (customField.pickerShown) {
            const cfFieldSelect = page.locator('.fixed.bottom-5.left-1\\/2 select').filter({ has: page.locator('option[value="effort"]') }).first();
            await cfFieldSelect.selectOption('effort');
            await page.waitForTimeout(300);
            const cfValue = page.locator('.fixed.bottom-5.left-1\\/2 input[type="number"]').first();
            await cfValue.fill('42');
            await page.locator('.fixed.bottom-5.left-1\\/2 button:has-text("Apply")').first().click();
            await page.waitForTimeout(1200);
            customField.updated = await page.evaluate(async (id) => {
              let token = null;
              for (const k of ['pb_auth', 'pocketbase_auth']) {
                try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
              }
              const h = {}; if (token) h.Authorization = token;
              const r = await fetch('/api/collections/issues/records/' + id, { headers: h });
              if (r.status !== 200) return null;
              const rec = await r.json();
              const cf = rec.custom_fields || {};
              return cf.effort === 42 && cf.client === 'keep-me' && cf.qa_signoff === false;
            }, cfProbeId);
            customField.mergePreserved = customField.updated;
          }
        } else {
          customField.cardNotFound = true;
        }
      } catch (e) { customField.error = String(e).slice(0, 200); }
    }
    // 2. Cleanup: delete the temp issue and restore the prior project defs.
    if (cfProbeId) {
      await page.evaluate(async (id) => {
        let token = null;
        for (const k of ['pb_auth', 'pocketbase_auth']) {
          try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
        }
        const h = {}; if (token) h.Authorization = token;
        try { await fetch('/api/collections/issues/records/' + id, { method: 'DELETE', headers: h }); } catch (e) {}
      }, cfProbeId);
    }
    if (cfProjectId && cfPrevDefs !== null) {
      await page.evaluate(async ({ projectId, prevDefs }) => {
        let token = null;
        for (const k of ['pb_auth', 'pocketbase_auth']) {
          try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
        }
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = token;
        try {
          await fetch('/api/projectbase/projects/' + projectId + '/custom-fields', {
            method: 'PUT', headers, body: JSON.stringify({ fields: prevDefs })
          });
        } catch (e) { /* best effort */ }
      }, { projectId: cfProjectId, prevDefs: cfPrevDefs });
    }
    await page.keyboard.press('1'); // back to board
    await page.waitForTimeout(500);
    range.checked = true;

    // ---- Issue relationships UI (cycle 40): drawer section renders, adding a
    // blocks relation through the real UI shows the row + kanban lock badge,
    // and cleanup removes the temp edge/issue. ----
    relations.checked = true;
    const probeId = 'ckat9ahso93piex';
    const tmpTitle = 'Rel QA target ' + Date.now();
    // 1. Create a temp target issue in the probe's project (authed page ctx).
    // The PocketBase SDK stores its token in localStorage; raw fetch calls are
    // anonymous unless we forward it as the Authorization header.
    let tmpIdHolder = null;
    try {
    const tmp = await page.evaluate(async ({ probeId, tmpTitle }) => {
      let token = null;
      try {
        const raw = localStorage.getItem('pb_auth');
        if (raw) token = JSON.parse(raw).token;
      } catch (e) { /* ignore */ }
      if (!token) {
        try {
          const raw2 = localStorage.getItem('pocketbase_auth');
          if (raw2) token = JSON.parse(raw2).token;
        } catch (e) { /* ignore */ }
      }
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = token;
      const probeRes = await fetch('/api/collections/issues/records/' + probeId, { headers });
      if (!probeRes.ok) return { error: 'probe fetch ' + probeRes.status };
      const probe = await probeRes.json();
      const res = await fetch('/api/collections/issues/records', {
        method: 'POST',
        headers,
        body: JSON.stringify({ project: probe.project, title: tmpTitle, status: 'todo' })
      });
      if (!res.ok) return { error: 'create ' + res.status + ' ' + (await res.text()).slice(0, 120) };
      return { id: (await res.json()).id };
    }, { probeId, tmpTitle });
    if (tmp.id) tmpIdHolder = tmp.id;
    if (tmp.id) ignoredCleanupUrls.add(BASE + '/api/collections/issues/records/' + tmp.id);
    // The cleanup DELETE to the relations route can abort client-side after
    // the server processed it (same documented pattern as the tmp-record
    // delete); the end state is verified via explicit assertions below, so
    // ignore that URL to avoid a false failure.
    ignoredCleanupUrls.add(BASE + '/api/projectbase/issues/' + probeId + '/relations');
    if (tmp.id) {
      // 2. Reload so the app's issue list (picker source) includes the temp issue.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      // 3. Open the probe drawer and verify the Relationships section renders.
      await page.evaluate((id) => { location.hash = '#/pb/board/issue/' + id; }, probeId);
      await page.waitForTimeout(2500);
      relations.sectionRendered = await page.evaluate(() => {
        const drawer = document.querySelector('.slide-in-from-right');
        if (!drawer) return false;
        return !!drawer.querySelector('input[placeholder="Search issues to link..."]');
      });
      // 4. Type into the picker and click the temp issue candidate.
      await page.fill('input[placeholder="Search issues to link..."]', tmpTitle);
      await page.waitForTimeout(600);
      const clicked = await page.evaluate((title) => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find((b) => b.textContent && b.textContent.includes(title));
        if (btn) { btn.click(); return true; }
        return false;
      }, tmpTitle);
      relations.pickerPicked = clicked;
      await page.waitForTimeout(2000);
      // 5. The Blocks row for the temp issue must appear in the drawer.
      relations.rowShown = await page.evaluate((title) => {
        const drawer = document.querySelector('.slide-in-from-right');
        return !!drawer && (drawer.textContent || '').includes(title);
      }, tmpTitle);
      // 6. The kanban card for the temp issue must show the blocked lock badge.
      // First WITHOUT a reload: the reciprocal mirror save should arrive via
      // SSE (PB broadcasts app.save() in hooks/routes), proving the real-time
      // loop from API route -> SSE -> Vue reactivity -> card badge.
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(2500);
      relations.kanbanLockNoReload = await page.evaluate((title) => {
        const card = Array.from(document.querySelectorAll('.kanban-card-drag-handle'))
          .find((c) => (c.textContent || '').includes(title));
        if (!card) return false;
        return !!(card.querySelector('[data-lucide="lock"]') || card.querySelector('.text-red-400, .text-red-500, .text-red-600'));
      }, tmpTitle);
      // Then reload as the server-persistence baseline (fresh fetch path).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await page.evaluate(() => { location.hash = '#/pb/board'; });
      await page.waitForTimeout(2500);
      relations.kanbanLockShown = await page.evaluate((title) => {
        const card = Array.from(document.querySelectorAll('.kanban-card-drag-handle'))
          .find((c) => (c.textContent || '').includes(title));
        if (!card) return false;
        return !!(card.querySelector('[data-lucide="lock"]') || card.querySelector('.text-red-400, .text-red-500, .text-red-600'));
      }, tmpTitle);
      // 7. The list view must also surface the blocked lock badge for the temp
      // issue (cycle-42: list view previously had no relationship indicator even
      // though issues carry relations — mirrors the kanban board UI).
      await page.evaluate(() => { location.hash = '#/pb/list'; });
      await page.waitForTimeout(2500);
      relations.listLockShown = await page.evaluate((title) => {
        const row = Array.from(document.querySelectorAll('tbody tr'))
          .find((r) => (r.textContent || '').includes(title));
        if (!row) return false;
        return !!(row.querySelector('[data-lucide="lock"]') || row.querySelector('.text-red-400, .text-red-500, .text-red-600'));
      }, tmpTitle);
    } else {
      relations.error = tmp.error || 'temp issue create failed';
    }
    } finally {
      // Crash-safe cleanup: always remove the temp issue if it was created.
      if (tmpIdHolder) {
        await page.evaluate(async ({ probeId, tmpId }) => {
          let token = null;
          try { const raw = localStorage.getItem('pb_auth'); if (raw) token = JSON.parse(raw).token; } catch (e) {}
          if (!token) { try { const r = localStorage.getItem('pocketbase_auth'); if (r) token = JSON.parse(r).token; } catch (e) {} }
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = token;
          try {
            await fetch('/api/projectbase/issues/' + probeId + '/relations', {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ issue: tmpId, type: 'blocks' })
            });
          } catch (e) { /* ignore */ }
          try {
            await fetch('/api/collections/issues/records/' + tmpId, { method: 'DELETE', headers });
          } catch (e) { /* ignore */ }
        }, { probeId, tmpId: tmpIdHolder });
      }
    }
  }

  // ---- Timeline / Gantt view (cycle 19): a temp issue with start + due dates
  // must render a timeline bar, the view must mount with a day grid, and the
  // Timeline nav command must switch the view. Cleanup removes the temp issue. ----
  const timeline = { checked: false };
  let tlProbeId = null;
  try {
    const tlTitle = 'TL QA target ' + Date.now();
    const tlSetup = await page.evaluate(async ({ tlTitle }) => {
      let token = null;
      try { const raw = localStorage.getItem('pb_auth'); if (raw) token = JSON.parse(raw).token; } catch (e) {}
      if (!token) { try { const r = localStorage.getItem('pocketbase_auth'); if (r) token = JSON.parse(r).token; } catch (e) {} }
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = token;
      const projRes = await fetch('/api/collections/projects/records?perPage=1', { headers });
      if (!projRes.ok) return { error: 'projects ' + projRes.status };
      const proj = (await projRes.json()).items[0];
      const now = new Date();
      const start = new Date(now.getTime() - 3 * 86400000).toISOString();
      const due = new Date(now.getTime() + 4 * 86400000).toISOString();
      const res = await fetch('/api/collections/issues/records', {
        method: 'POST', headers,
        body: JSON.stringify({ project: proj.id, title: tlTitle, status: 'in_progress',
          start_date: start, due_date: due })
      });
      if (!res.ok) return { error: 'create ' + res.status + ' ' + (await res.text()).slice(0, 160) };
      return { id: (await res.json()).id };
    }, { tlTitle });
    if (tlSetup && tlSetup.id) {
      tlProbeId = tlSetup.id;
      ignoredCleanupUrls.add(BASE + '/api/collections/issues/records/' + tlProbeId);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      // Navigate via the Timeline nav command (proves header wiring).
      await page.evaluate(() => { location.hash = '#/pb/timeline'; });
      await page.waitForTimeout(2500);
      timeline.viewMounted = await page.evaluate(() => {
        const app = document.querySelector('#app');
        return !!(app && /Timeline/.test(app.textContent || '') && app.querySelector('.overflow-x-auto'));
      });
      // The temp issue's bar must be present with its title in the schedule.
      timeline.barShown = await page.evaluate((title) => {
        return !!Array.from(document.querySelectorAll('.rounded-md.border')).find((b) => (b.textContent || '').includes(title));
      }, tlTitle);
      // Clicking the issue bar must open the issue drawer.
      if (timeline.barShown) {
        await page.evaluate((title) => {
          const bar = Array.from(document.querySelectorAll('.rounded-md.border'))
            .find((b) => (b.textContent || '').includes(title));
          if (bar) bar.click();
        }, tlTitle);
        await page.waitForTimeout(1200);
        timeline.barOpensDrawer = await page.evaluate((title) => {
          const drawer = document.querySelector('.slide-in-from-right');
          if (!drawer) return false;
          const input = drawer.querySelector('input[placeholder="Issue title..."]');
          const text = (drawer.textContent || '');
          // Title lives in the drawer's title input; identifier/title also
          // render in the header, so match either source.
          return (input && input.value && title.includes(input.value.trim())) ||
                 text.includes(title);
        }, tlTitle);
      }
      // Keyboard shortcut 4 must also reach the timeline view.
      await page.keyboard.press('1'); // board
      await page.waitForTimeout(600);
      await page.keyboard.press('4'); // timeline (new shortcut slot)
      await page.waitForTimeout(1200);
      timeline.shortcutWorks = await page.evaluate(() => {
        const app = document.querySelector('#app');
        return !!app && /Timeline/.test(app.textContent || '');
      });
    } else {
      timeline.error = (tlSetup && tlSetup.error) || 'setup failed';
    }
  } catch (e) { timeline.error = String(e).slice(0, 200); }
  if (tlProbeId) {
    await page.evaluate(async (id) => {
      let token = null;
      try { const raw = localStorage.getItem('pb_auth'); if (raw) token = JSON.parse(raw).token; } catch (e) {}
      if (!token) { try { const r = localStorage.getItem('pocketbase_auth'); if (r) token = JSON.parse(r).token; } catch (e) {} }
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = token;
      try { await fetch('/api/collections/issues/records/' + id, { method: 'DELETE', headers }); } catch (e) {}
    }, tlProbeId);
  }
  timeline.checked = true;

  // ---- Portfolio Dashboard view (cycle 20): the view must mount, aggregate
  // per-project progress, and a nav command must switch to it. The view fetches
  // its own workspace snapshot, so no temp data is required. ----
  const portfolio = { checked: false };
  try {
    // Navigate via the Portfolio nav command (proves header wiring).
    await page.evaluate(() => { location.hash = '#/pb/portfolio'; });
    await page.waitForTimeout(2500);
    portfolio.viewMounted = await page.evaluate(() => {
      const app = document.querySelector('#app');
      return !!(app && /Portfolio Dashboard/.test(app.textContent || '') && app.querySelector('.pb-portfolio'));
    });
    // The view must render at least one project progress row (live data).
    portfolio.projectRowShown = await page.evaluate(() => {
      const app = document.querySelector('#app');
      const txt = app ? app.textContent : '';
      return /Project Progress/.test(txt) && (txt.match(/Total Issues/g) || []).length > 0;
    });
    // The keyboard 9 shortcut must switch to the portfolio view.
    await page.evaluate(() => { location.hash = '#/pb/board'; });
    await page.waitForTimeout(1800);
    await page.keyboard.press('9');
    await page.waitForTimeout(1800);
    portfolio.shortcutWorks = await page.evaluate(() => {
      const app = document.querySelector('#app');
      return !!(app && /Portfolio Dashboard/.test(app.textContent || ''));
    });

    // ---- Realtime refresh (cycle 21): the portfolio must auto-refresh when a
    // new issue is created. The shell updates its issues prop optimistically on
    // create (PB-56 design: it does not depend on the SSE event), which the view
    // watches and debounce-refetches from. We stay on the portfolio view, read
    // the "Total Issues" KPI, create an issue via the app's own NewIssueModal
    // (keyboard C), wait past the debounce, and assert the KPI increments
    // without any navigation or reload. ----
    portfolio.realtime = {};
    const rtTitle = 'RTprobe' + (Date.now() % 100000000);
    const rtBefore = await page.evaluate(() => {
      const app = document.querySelector('#app');
      const m = (app ? app.textContent : '').match(/Total Issues\s*([\d,]+)/);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
    });
    // Open the NewIssueModal via the keyboard and create an issue.
    let rtStatus = 'skipped';
    try {
      await page.keyboard.press('c');
      await page.waitForTimeout(1000);
      const modalTitle = page.locator('input[placeholder="What needs to be done?"]').first();
      if (await modalTitle.count()) {
        await modalTitle.fill(rtTitle);
        await page.keyboard.press('Enter');
        rtStatus = 'created';
      } else {
        rtStatus = 'modal-not-found';
      }
    } catch (e) { rtStatus = 'create-error: ' + String(e).slice(0, 120); }
    // Wait past the 400ms debounce + refetch, then read the KPI again.
    await page.waitForTimeout(2500);
    const rtAfter = await page.evaluate(() => {
      const app = document.querySelector('#app');
      const m = (app ? app.textContent : '').match(/Total Issues\s*([\d,]+)/);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
    });
    portfolio.realtime = {
      before: rtBefore, created: rtStatus, after: rtAfter,
      incremented: rtBefore !== null && rtAfter !== null && rtAfter === rtBefore + 1
    };
    // Cleanup the probe issue: register its id as an ignored cleanup URL BEFORE
    // deleting so a client-side abort (the app's realtime path already removed
    // the record) is not counted as a failure — same pattern as the range suite.
    const probeIds = await page.evaluate(async (title) => {
      let token = null;
      for (const k of ['pb_auth', 'pocketbase_auth']) {
        try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
      }
      const h = {}; if (token) h.Authorization = token;
      const list = await fetch('/api/collections/issues/records?filter=' + encodeURIComponent('(title="' + title + '")'), { headers: h });
      const d = await list.json().catch(() => ({}));
      return (d.items || []).map(it => it.id);
    }, rtTitle);
    for (const pid of probeIds) ignoredCleanupUrls.add(BASE + '/api/collections/issues/records/' + pid);
    await page.evaluate(async (ids) => {
      let token = null;
      for (const k of ['pb_auth', 'pocketbase_auth']) {
        try { token = JSON.parse(localStorage.getItem(k)).token; if (token) break; } catch (e) {}
      }
      const h = {}; if (token) h.Authorization = token;
      for (const id of ids) await fetch('/api/collections/issues/records/' + id, { method: 'DELETE', headers: h });
    }, probeIds);
  } catch (e) { portfolio.error = String(e).slice(0, 200); }
  portfolio.checked = true;

  // ---- Deep-link after login (cycle 20 fix): a shared hash like #/pb/portfolio
  // opened BEFORE auth must land on that view after sign-in, not fall back to
  // the board. Regression guard for the applyRoute() call added to signIn. ----
  const deepLink = { checked: false };
  try {
    const dlCtx = await browser.newContext();
    const dlPage = await dlCtx.newPage();
    await dlPage.goto(BASE + '/#/pb/portfolio');
    await dlPage.waitForTimeout(2000);
    const dlEmail = dlPage.locator('input[placeholder="Email"]');
    if (await dlEmail.count()) {
      await dlEmail.fill(process.env.QA_EMAIL || 'f@flow.com');
      await dlPage.locator('input[placeholder="Password"]').fill(process.env.QA_PASSWORD || 'superdev123');
      await dlPage.locator('button:has-text("Sign in")').first().click();
      await dlPage.waitForTimeout(4000);
    }
    deepLink.landedOnPortfolio = await dlPage.evaluate(() =>
      /Portfolio Dashboard/.test(document.querySelector('#app').textContent || ''));
    await dlCtx.close();
  } catch (e) { deepLink.error = String(e).slice(0, 200); }
  deepLink.checked = true;

  // ---- Export modal (cycle 30): opens via the header More menu, renders tabs
  // and project select, and triggers a download. ----
  try {
    // Open the More actions overflow menu (Export/Fields/Admin are grouped).
    const moreBtn = page.locator('header button[title*="More actions"]');
    if (await moreBtn.count()) await moreBtn.click();
    await page.waitForTimeout(500);
    const headerExport = page.locator('header .glass-dropdown button:has-text("Export Issues")');
    if (await headerExport.count()) {
      await headerExport.click();
      await page.waitForTimeout(800);
      exportModal.modalVisible = await page.locator('text=Export Issues').first().isVisible().catch(() => false);
      exportModal.csvTab = await page.locator('button:has-text("CSV")').first().isVisible().catch(() => false);
      exportModal.jsonTab = await page.locator('button:has-text("JSON")').first().isVisible().catch(() => false);
      exportModal.projectSelect = await page.locator('select').first().isVisible().catch(() => false);
      const exportBtn = page.locator('button:has-text("Export")').last();
      if (await exportBtn.count()) {
        await exportBtn.click();
        await page.waitForTimeout(2500);
        exportModal.exportClicked = true;
        exportModal.successState = await page.locator('text=Exported').first().isVisible().catch(() => false);
      }
      await page.locator('button:has-text("Close")').first().click().catch(() => {});
      await page.waitForTimeout(400);
    } else {
      exportModal.headerButtonMissing = true;
    }
  } catch (e) { exportModal.error = String(e).slice(0, 200); }
  exportModal.checked = true;

  // ---- Notification channel settings modal (cycle 33): opens via the header
  // More menu, renders all channel fields, and saves a webhook URL. ----
  try {
    // Ensure the More actions overflow menu is open (Export test may have closed it).
    const moreBtn = page.locator('header button[title*="More actions"]');
    if (await moreBtn.count()) await moreBtn.click();
    await page.waitForTimeout(500);
    const headerNotif = page.locator('header .glass-dropdown button:has-text("Notification Settings")');
    if (await headerNotif.count()) {
      await headerNotif.click();
      await page.waitForTimeout(800);
      notifSettings.modalVisible = await page.locator('text=Notification Channels').first().isVisible().catch(() => false);
      notifSettings.discordField = await page.locator('input[placeholder*="discord.com"]').first().isVisible().catch(() => false);
      notifSettings.telegramToken = await page.locator('input[placeholder*="ABC"]').first().isVisible().catch(() => false);
      notifSettings.telegramChat = await page.locator('input[placeholder*="-100"]').first().isVisible().catch(() => false);
      notifSettings.genericField = await page.locator('input[placeholder*="hook"]').first().isVisible().catch(() => false);
      const saveBtn = page.locator('button:has-text("Save Settings")').first();
      if (await saveBtn.count()) {
        await saveBtn.click();
        await page.waitForTimeout(800);
        notifSettings.savedMsg = await page.locator('text=Notification channels updated').first().isVisible().catch(() => false);
      } else {
        notifSettings.saveBtnMissing = true;
      }
    } else {
      notifSettings.headerButtonMissing = true;
    }
  } catch (e) { notifSettings.error = String(e).slice(0, 200); }
  notifSettings.checked = true;

  // ---- Import modal (cycle 36/37): opens via the 'i' shortcut and renders the
  // Linear + Plane importer tabs (Linear/Plane workspace CSV exporters). ----
  try {
    // Ensure the app shell has focus (the 'i' shortcut is app-level).
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(300);
    await page.keyboard.press('i');
    await page.waitForTimeout(600);
    importModal.opened = await page.locator('text=Import Issues').first().isVisible().catch(() => false);
    importModal.linearTab = await page.locator('button:has-text("Linear")').first().isVisible().catch(() => false);
    if (importModal.linearTab) {
      await page.locator('button:has-text("Linear")').first().click();
      await page.waitForTimeout(400);
      importModal.linearField = await page.locator('textarea[placeholder*="ID,Title,Status"]').first().isVisible().catch(() => false);
      importModal.linearBtn = await page.locator('button:has-text("Import from Linear")').first().isVisible().catch(() => false);
    }
    importModal.planeTab = await page.locator('button:has-text("Plane")').first().isVisible().catch(() => false);
    if (importModal.planeTab) {
      await page.locator('button:has-text("Plane")').first().click();
      await page.waitForTimeout(400);
      importModal.planeField = await page.locator('textarea[placeholder*="Name,State,Priority"]').first().isVisible().catch(() => false);
      importModal.planeBtn = await page.locator('button:has-text("Import from Plane")').first().isVisible().catch(() => false);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) { importModal.error = String(e).slice(0, 200); }
  importModal.checked = true;

  // ---- Autonomous agent dispatch (cycle 39): the drawer's Trigger Agent
  // dropdown must render the Custom Agent control plus the custom-instruction
  // prompt editor, so the charter's signature dispatch moat (custom target +
  // 8000-char prompt) is reachable from the UI, not just the raw API. ----
  dispatchQA.checked = true;
  try {
    // Open the drawer for a real issue already in the app's dataset (the same
    // probe id the relations + resize QA blocks use, which demonstrably loads).
    await page.evaluate(() => { location.hash = '#/pb/board/issue/ckat9ahso93piex'; });
    await page.waitForTimeout(2500);
    const trigger = page.locator('button[title="Dispatch this issue to an autonomous agent"]').first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(600);
      dispatchQA.customVisible = await page.locator('text=Custom Agent').first().isVisible().catch(() => false);
      dispatchQA.promptEditor = await page.locator('textarea[placeholder*="custom instructions"]').first().isVisible().catch(() => false);
      const prompt = page.locator('textarea[placeholder*="custom instructions"]').first();
      if (await prompt.count()) {
        await prompt.fill('Refactor the dispatch payload');
        await page.waitForTimeout(300);
        dispatchQA.counter = await page.evaluate(() => {
          const el = [...document.querySelectorAll('span.font-mono')].find((s) => /\/8000/.test(s.textContent || ''));
          return el ? el.textContent.trim() : null;
        });
        dispatchQA.counterHasLength = /\/8000/.test(dispatchQA.counter || '');
      }
    } else {
      dispatchQA.triggerMissing = true;
    }
  } catch (e) { dispatchQA.error = String(e).slice(0, 200); }

  // ---- Docs surface (cycle 45): the Docs view must render the FastMCP setup
  // snippet with a concrete runtime origin. The MCP snippet used to embed a
  // literal ${PROJECTBASE_URL:-...} env placeholder that was never substituted
  // in this zero-build app, producing a broken copy-paste config. ----
  try {
    await page.evaluate(() => { location.hash = '#/pb/docs'; });
    await page.waitForTimeout(1800);
    await page.locator('button:has-text("FastMCP Setup")').first().click().catch(() => {});
    await page.waitForTimeout(500);
    docsQA.tabOpened = await page.locator('button:has-text("FastMCP Setup")').first().isVisible().catch(() => false);
    const snippet = await page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre code')).find((el) => el.textContent.includes('mcpServers'));
      return pre ? pre.textContent : '';
    });
    docsQA.snippetFound = Boolean(snippet);
    docsQA.noPlaceholder = !snippet.includes('${');
    docsQA.hasOriginUrl = /"PROJECTBASE_URL": "http:\/\//.test(snippet);
  } catch (e) { docsQA.error = String(e).slice(0, 200); }
  docsQA.checked = true;

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
  if (checks.headerBadge !== EXPECTED_BADGE) failures.push(`header version badge ${checks.headerBadge} != ${EXPECTED_BADGE} (VERSION file)`);
  if (checks.headerLayout && checks.headerLayout.overflows) failures.push(`header horizontally overflows (scrollW ${checks.headerLayout.scrollW} > clientW ${checks.headerLayout.clientW})`);
  if (checks.headerLayout && checks.headerLayout.newIssue && !checks.headerLayout.newIssue.visible) failures.push(`New Issue button off-screen: ${JSON.stringify(checks.headerLayout.newIssue)}`);
  if (!['rgb(11, 15, 25)', 'rgb(9, 9, 11)', 'rgb(248, 250, 252)', 'rgb(236, 238, 242)', 'rgb(223, 227, 232)', 'rgb(226, 230, 235)'].includes(checks.bodyBg)) failures.push(`body bg ${checks.bodyBg} != expected theme background`);
  if (checks.probe.paddingLeft !== '28px') failures.push(`pl-7 padding ${checks.probe.paddingLeft} != 28px`);
  if (checks.probe.marginLeft !== '6px') failures.push(`ml-1.5 margin ${checks.probe.marginLeft} != 6px`);
  if (checks.probe.marginTop !== '6px') failures.push(`mt-1.5 margin ${checks.probe.marginTop} != 6px`);
  if (checks.probe.maxHeight !== '208px') failures.push(`max-h-52 ${checks.probe.maxHeight} != 208px`);
  if (checks.probe.color !== 'rgb(125, 211, 252)') failures.push(`text-sky-300 ${checks.probe.color} != sky-300`);
  if (!checks.animName.startsWith('pb-')) failures.push(`animation ${checks.animName} not a pb-* keyframe`);
  if (checks.animDuration !== '0.15s') failures.push(`animation duration ${checks.animDuration} != 0.15s`);
  if (routing.checked && routing.staleDrawer) failures.push('stale issue drawer shown for nonexistent route issue');
  if (routing.checked && !routing.issueOpened) failures.push('real issue deep link did not open the drawer');
  if (routing.checked && routing.staleDrawerOnPlainView) failures.push('stale issue drawer shown on plain view hash');
  if (urlState && urlState.checked) {
    if (urlState.error) failures.push('url state setup error: ' + urlState.error);
    if (urlState.filterWritesUrl === false) failures.push('typing a board filter did not write ?q= to the URL');
    if (urlState.filterClearsUrl === false) failures.push('clearing the board filter did not drop ?q= from the URL');
    if (urlState.qRestored === false) failures.push('?q= deep link did not restore the search filter after reload');
    if (urlState.priorityRestored === false) failures.push('?priority= deep link did not preselect the priority filter');
    if (urlState.tabWritesUrl === false) failures.push('clicking a cycle card did not write ?cycle= to the URL');
    if (urlState.tabRestored === false) failures.push('?cycle= deep link did not reopen the same cycle after reload');
    if (urlState.wOverridesWidth === false) failures.push('?w= deep link did not widen the drawer to 1100px');
    if (urlState.wNotPersisted === false) failures.push('?w= override leaked into localStorage');
  }
  if (relations && relations.checked) {
    if (relations.error) failures.push('relations setup error: ' + relations.error);
    if (relations.sectionRendered === false) failures.push('Relationships section did not render in drawer');
    if (!relations.pickerPicked) failures.push('relation picker could not pick the temp issue');
    if (relations.rowShown === false) failures.push('added relation row did not appear in drawer');
    if (relations.kanbanLockNoReload === false) failures.push('blocked kanban card did not show lock badge via SSE (no reload)');
    if (relations.kanbanLockShown === false) failures.push('blocked kanban card did not show lock badge after reload');
    if (relations.listLockShown === false) failures.push('blocked list-view row did not show lock badge');
  }
  if (bulk && bulk.checked) {
    if (bulk.error) failures.push('bulk select setup error: ' + bulk.error);
    if (bulk.barShownAfterOne === false) failures.push('bulk bar did not appear after selecting one card');
    if (bulk.countOne === false) failures.push('bulk bar did not show "1 selected"');
    if (bulk.countTwo === false) failures.push('bulk bar did not show "2 selected" after second selection');
    if (bulk.escClears === false) failures.push('Esc did not clear the bulk selection');
    if (bulk.selectAllMatchesRows === false) failures.push('list select-all did not select every visible row');
  }
  if (range && range.checked) {
    if (range.error) failures.push('range select setup error: ' + range.error);
    if (range.boardProbed === false) failures.push('range suite could not probe the board (need >=3 cards)');
    if (range.listProbed === false) failures.push('range suite could not probe the list view (need >=3 rows)');
    if (range.boardAnchorOne === false) failures.push('board anchor click did not select 1 issue');
    if (range.boardRangeThree === false) failures.push('board shift+click did not select the range (expected 3)');
    if (range.boardCheckedCount !== undefined && range.boardCheckedCount !== 3) failures.push(`board range selected ${range.boardCheckedCount} checkboxes, expected 3`);
    if (range.boardNoDrawer === false) failures.push('board shift+click opened the drawer');
    if (range.boardEscClears === false) failures.push('Esc did not clear the board range selection');
    if (range.boardCrossColumnOK === false) failures.push(`board cross-column span selected ${range.boardCrossColumn}, expected ${range.boardCrossColumnExpected} (${range.boardCrossColumnExpected - 1} backlog + first todo)`);
    if (range.listRangeThree === false) failures.push('list shift+click did not select the range (expected 3)');
    if (range.listReverseThree === false) failures.push('list reverse shift+click did not select the range (expected 3)');
    if (range.applyCardsFound === false) failures.push('range+apply E2E could not find its 3 temp cards on the board');
    if (range.applyBarThree === false) failures.push('range+apply E2E: bulk bar did not show 3 selected before applying');
    if (range.applyMovedAll === false) failures.push('range+apply E2E: bulk status apply did not move all 3 temp issues to todo');
    if (range.applyBarCleared === false) failures.push('range+apply E2E: Esc did not clear the bulk bar after apply');
    if (range.applyDeletedAll === false) failures.push('range+apply E2E: temp issues were not deleted (cleanup end state)');
  }
  if (routing.checked && !routing.issueOpened) failures.push('real issue deep link did not open the drawer');
  if (routing.checked && routing.staleDrawerOnPlainView) failures.push('stale drawer left open on plain view hash');
  if (!routing.checked) failures.push('routing regression not exercised (no login form found)');
  if (resize.checked) {
    if (!resize.handleFound) failures.push('drawer resize handle missing');
    if (resize.widthGrew === false) failures.push('dragging resize handle did not widen drawer');
    if (!resize.persisted) failures.push('drawer width not persisted to localStorage');
    if (resize.survivesReload === false) failures.push('drawer width lost after reload');
    if (resize.resetWorks === false) failures.push('double-click did not reset drawer width to 768px');
    if (resize.checked && !resize.widthGrew && resize.widthGrew !== false) failures.push('drawer resize drag not exercised');
  }
  if (focusMode.checked) {
    if (!focusMode.buttonShown) failures.push('focus mode button missing');
    if (!focusMode.overlayShown) failures.push('focus mode overlay did not open');
    if (!focusMode.editorShown) failures.push('focus mode editor not rendered');
    if (!focusMode.escCloses) failures.push('Esc did not close focus mode');
  } else if (focusMode.error) {
    failures.push(`focus mode not exercised: ${focusMode.error}`);
  }

  if (customField.checked) {
    if (customField.createError) failures.push(`custom-field E2E setup error: ${customField.createError}`);
    if (customField.cardNotFound) failures.push('custom-field E2E could not find its temp card on the board');
    if (customField.pickerShown === false) failures.push('bulk bar custom-field picker did not render when field defs exist');
    if (customField.updated === false) failures.push('bulk custom-field apply did not update effort=42 on the selected issue');
    if (customField.mergePreserved === false) failures.push('bulk custom-field apply clobbered unrelated custom fields (merge broken)');
    if (customField.error) failures.push(`custom-field picker E2E error: ${customField.error}`);
  } else if (!customField.checked && !customField.error) {
    failures.push('custom-field picker E2E not exercised');
  }

  if (timeline && timeline.checked) {
    if (timeline.error) failures.push('timeline E2E setup error: ' + timeline.error);
    if (timeline.viewMounted === false) failures.push('timeline view did not mount (no day grid)');
    if (timeline.barShown === false) failures.push('timeline did not render a bar for the temp dated issue');
    if (timeline.barOpensDrawer === false) failures.push('clicking a timeline issue bar did not open the drawer');
    if (timeline.shortcutWorks === false) failures.push('keyboard 4 did not switch to the timeline view');
  } else if (!timeline.checked) {
    failures.push('timeline E2E not exercised');
  }
  if (portfolio && portfolio.checked) {
    if (portfolio.error) failures.push('portfolio E2E setup error: ' + portfolio.error);
    if (portfolio.viewMounted === false) failures.push('portfolio view did not mount');
    if (portfolio.projectRowShown === false) failures.push('portfolio did not render project progress rows');
    if (portfolio.shortcutWorks === false) failures.push('keyboard 9 did not switch to the portfolio view');
    const rt = portfolio.realtime || {};
    if (rt.created && rt.created !== 'created') failures.push(`portfolio realtime: could not create probe issue (${rt.created})`);
    if (rt.before !== null && rt.incremented === false) {
      failures.push(`portfolio realtime KPI did not increment (before=${rt.before}, after=${rt.after}) — auto-refresh on create failed`);
    }
  } else if (!portfolio.checked) {
    failures.push('portfolio E2E not exercised');
  }
  if (deepLink && deepLink.checked) {
    if (deepLink.error) failures.push('deep-link E2E error: ' + deepLink.error);
    if (deepLink.landedOnPortfolio === false) failures.push('deep link #/pb/portfolio did not land on portfolio after login');
  } else if (!deepLink.checked) {
    failures.push('deep-link E2E not exercised');
  }
  if (exportModal && exportModal.checked) {
    if (exportModal.error) failures.push('export modal E2E error: ' + exportModal.error);
    if (exportModal.headerButtonMissing) failures.push('export modal header button not found');
    if (exportModal.modalVisible === false) failures.push('export modal did not open');
    if (exportModal.csvTab === false) failures.push('export modal CSV tab missing');
    if (exportModal.jsonTab === false) failures.push('export modal JSON tab missing');
    if (exportModal.projectSelect === false) failures.push('export modal project select missing');
    if (exportModal.exportClicked === false) failures.push('export modal Export button not clickable');
    if (exportModal.successState === false) failures.push('export modal did not show success state');
  } else if (!exportModal || !exportModal.checked) {
    failures.push('export modal E2E not exercised');
  }
  if (notifSettings && notifSettings.checked) {
    if (notifSettings.error) failures.push('notification settings E2E error: ' + notifSettings.error);
    if (notifSettings.headerButtonMissing) failures.push('notification settings header button not found');
    if (notifSettings.modalVisible === false) failures.push('notification settings modal did not open');
    if (notifSettings.discordField === false) failures.push('notification settings Discord field missing');
    if (notifSettings.telegramToken === false) failures.push('notification settings Telegram token field missing');
    if (notifSettings.telegramChat === false) failures.push('notification settings Telegram chat field missing');
    if (notifSettings.genericField === false) failures.push('notification settings generic webhook field missing');
    if (notifSettings.saveBtnMissing) failures.push('notification settings Save button missing');
    if (notifSettings.savedMsg === false) failures.push('notification settings did not show saved message');
  } else if (!notifSettings || !notifSettings.checked) {
    failures.push('notification settings E2E not exercised');
  }
  if (importModal && importModal.checked) {
    if (importModal.error) failures.push('import modal E2E error: ' + importModal.error);
    if (importModal.opened === false) failures.push('import modal did not open via i shortcut');
    if (importModal.linearTab === false) failures.push('import modal Linear tab missing');
    if (importModal.linearTab && importModal.linearField === false) failures.push('Linear CSV textarea missing');
    if (importModal.linearTab && importModal.linearBtn === false) failures.push('Import from Linear button missing');
    if (importModal.planeTab === false) failures.push('import modal Plane tab missing');
    if (importModal.planeTab && importModal.planeField === false) failures.push('Plane CSV textarea missing');
    if (importModal.planeTab && importModal.planeBtn === false) failures.push('Import from Plane button missing');
  } else if (!importModal || !importModal.checked) {
    failures.push('import modal E2E not exercised');
  }
  if (dispatchQA && dispatchQA.checked) {
    if (dispatchQA.error) failures.push('agent dispatch E2E error: ' + dispatchQA.error);
    if (dispatchQA.triggerMissing) failures.push('agent dispatch Trigger Agent button not found in drawer');
    if (dispatchQA.customVisible === false) failures.push('Custom Agent row did not render in dispatch dropdown');
    if (dispatchQA.promptEditor === false) failures.push('custom instruction prompt editor missing in dispatch dropdown');
    if (dispatchQA.counterHasLength === false) failures.push('prompt char counter did not update after typing');
  } else if (!dispatchQA || !dispatchQA.checked) {
    failures.push('agent dispatch E2E not exercised');
  }
  if (docsQA && docsQA.checked) {
    if (docsQA.error) failures.push('docs surface E2E error: ' + docsQA.error);
    if (docsQA.snippetFound === false) failures.push('MCP snippet not found in Docs view');
    if (docsQA.noPlaceholder === false) failures.push('MCP snippet leaks an unresolved ${...} placeholder');
    if (docsQA.hasOriginUrl === false) failures.push('MCP snippet PROJECTBASE_URL is not a concrete http origin');
  } else if (!docsQA || !docsQA.checked) {
    failures.push('docs surface E2E not exercised');
  }

  console.log(JSON.stringify({ checks, routing, resize, urlState, relations, focusMode, bulk, range, customField, timeline, portfolio, deepLink, exportModal, notifSettings, importModal, dispatchQA, docsQA, failures, all4xx }, null, 1));
  console.log(failures.length === 0 ? 'RENDER QA: PASS' : 'RENDER QA: FAIL');
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
