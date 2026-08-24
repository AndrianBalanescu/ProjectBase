// Render QA for ProjectBase (cycle 39 CSS fix + cycle 40 issue relationships):
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

  const relations = { checked: false };
  const urlState = { checked: false };
  const bulk = { checked: false };
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
    failedReqs.push(r.url().slice(0, 120));
  });
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
        return !!(card.querySelector('i[data-lucide="lock"]') || card.querySelector('.text-red-400'));
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
        return !!(card.querySelector('i[data-lucide="lock"]') || card.querySelector('.text-red-400'));
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
        return !!(row.querySelector('i[data-lucide="lock"]') || row.querySelector('.text-red-400'));
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
  if (checks.headerBadge !== 'v0.9.0') failures.push(`header version badge ${checks.headerBadge} != v0.9.0`);
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

  console.log(JSON.stringify({ checks, routing, resize, urlState, relations, focusMode, bulk, failures, all4xx }, null, 1));
  console.log(failures.length === 0 ? 'RENDER QA: PASS' : 'RENDER QA: FAIL');
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
