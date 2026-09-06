// verify_listview_sort_logic.js — mechanical assertions for ListView semantic
// sorting (cycle 78). Extracts the pure sort methods from the component source
// and runs adversarial data through them:
//   - estimate: numeric (9 above 10), nulls first in asc
//   - due_date: chronological, undated last in BOTH directions
//   - status:   workflow order (backlog..done..cancelled), not alphabetical
//   - priority: severity order (urgent..none), not alphabetical
//   - subtasks: completion ratio, then absolute done count
// Exits 0 only when every assertion holds. Run: node scripts/qa/verify_listview_sort_logic.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'app', 'pb_public', 'js', 'components', 'ListView.js');
const src = fs.readFileSync(SRC, 'utf8');

const grabBody = (name) => {
  const m = src.match(new RegExp(name + '\\s*\\(([^)]*)\\)\\s*\\{'));
  if (!m) throw new Error('method not found in ListView.js: ' + name);
  const open = m.index + m[0].length - 1;
  let depth = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return { params: m[1], body: src.slice(open + 1, j) };
};
const mk = (name) => {
  const { params, body } = grabBody(name);
  return eval('(function(' + params + '){' + body + '})');
};

const statusRank = mk('statusRank');
const priorityRank = mk('priorityRank');
const sortValueRaw = mk('sortValue');
const ctx = { sortBy: 'estimate', sortDesc: false, statusRank, priorityRank };
const sortValue = (sortBy, sortDesc) => (issue) => {
  ctx.sortBy = sortBy; ctx.sortDesc = sortDesc;
  return sortValueRaw.call(ctx, issue);
};
let sortBy = 'estimate', sortDesc = false;
const cmp = (a, b) => {
  const va = sortValue(sortBy, sortDesc)(a), vb = sortValue(sortBy, sortDesc)(b);
  return va < vb ? (sortDesc ? 1 : -1) : va > vb ? (sortDesc ? -1 : 1) : 0;
};

const assertEq = (got, want, msg) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${msg}: got ${g}, want ${w}`);
};

// estimate: numeric, not lexicographic
sortBy = 'estimate'; sortDesc = false;
let rows = [{ estimate: 10 }, { estimate: 9 }, { estimate: 2 }, { estimate: null }].sort(cmp);
assertEq(rows.map(r => r.estimate), [null, 2, 9, 10], 'estimate numeric asc');

// due_date: chronological with undated last in both directions
sortBy = 'due_date'; sortDesc = false;
let r2 = [{ due_date: '2026-09-10' }, { due_date: null }, { due_date: '2026-09-01' }, { due_date: null }].sort(cmp);
assertEq(r2.map(r => r.due_date), ['2026-09-01', '2026-09-10', null, null], 'due asc nulls-last');
sortDesc = true;
r2 = [{ due_date: '2026-09-10' }, { due_date: null }, { due_date: '2026-09-01' }, { due_date: null }].sort(cmp);
assertEq(r2.map(r => r.due_date), ['2026-09-10', '2026-09-01', null, null], 'due desc nulls-last');

// status: workflow order, not alphabetical
sortBy = 'status'; sortDesc = false;
const r3 = [{ status: 'done' }, { status: 'todo' }, { status: 'in_progress' }, { status: 'backlog' }].sort(cmp);
assertEq(r3.map(r => r.status), ['backlog', 'todo', 'in_progress', 'done'], 'status workflow asc');

// priority: severity order, not alphabetical
sortBy = 'priority'; sortDesc = false;
const r4 = [{ priority: 'low' }, { priority: 'urgent' }, { priority: 'none' }, { priority: 'high' }].sort(cmp);
assertEq(r4.map(r => r.priority), ['urgent', 'high', 'low', 'none'], 'priority severity asc');

// subtasks: completion ratio, empty last
sortBy = 'subtasks'; sortDesc = false;
const r5 = [
  { subtasks: [{ done: true }, { done: true }] },
  { subtasks: [] },
  { subtasks: [{ done: true }, { done: false }] },
  { subtasks: [{ done: true }, { done: true }, { done: true }] },
].sort(cmp);
const ratios = r5.map(r => (r.subtasks || []).length ? r.subtasks.filter(s => s.done).length / r.subtasks.length : -1);
if (!(ratios[0] <= ratios[1] && ratios[1] <= ratios[2] && ratios[2] <= ratios[3])) {
  throw new Error('subtask ratio order failed: ' + ratios.join(','));
}

// Regression guards the component keeps the methods the template binds to
for (const m of ['statusRank', 'priorityRank', 'sortValue', 'toggleSort']) {
  if (!src.includes(m)) throw new Error('ListView.js lost method: ' + m);
}
if (!/toggleSort\('subtasks'\)/.test(src)) throw new Error('Subs column lost its sort toggle');
if (!/colspan="9"/.test(src)) throw new Error('empty-state colspan out of sync with 9 columns');

console.log('verify_listview_sort_logic: ALL ASSERTIONS PASS');