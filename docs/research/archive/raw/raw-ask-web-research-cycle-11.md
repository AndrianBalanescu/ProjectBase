PocketBase ≥0.23 (including 0.39) gives you a **full server-side JavaScript runtime (JSVM)** with hook APIs and a **JavaScript migration system** that can reach down to raw SQLite, so you can implement **FTS5-based full‑text indexing** by creating custom tables and queries in migrations and exposing them via hooks and routes. [Source](https://pocketbase.io/docs/js-overview/) [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html) [Source](https://github.com/pocketbase/pocketbase)  
Full‑text search is not a first‑class PocketBase feature; you design it yourself on top of SQLite using JS hooks and migrations, with some important architectural trade‑offs.

---

## 1. JSVM and hook lifecycle in PocketBase (v0.23+ / 0.39)

PocketBase’s prebuilt executable ships with an embedded ES5 JavaScript engine (Goja) that runs server‑side code without Node/Deno. [Source](https://pocketbase.io/docs/js-overview/) [Source](https://github.com/pocketbase/pocketbase/discussions/2767) [Source](https://github.com/pocketbase/pocketbase)  

* You enable hooks by placing `*.pb.js` (or `*.pb.ts` in newer builds) inside a **`pb_hooks`** directory next to the executable. [Source](https://pocketbase.io/docs/js-overview/) [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://www.b4x.com/android/forum/threads/web-pocketbase-hooks-collection.159299/)  
* The JSVM plugin exposes config options like **`HooksDir`**, **`HooksWatch`**, and **`HooksFilesPattern`**, and a **`MigrationsDir`** for JavaScript migrations. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks)  
* Only files matching the hooks pattern (e.g. `^.*(\.pb\.js|\.pb\.ts)$`) are auto‑loaded as hook entry points, and PocketBase watches hook JS files on disk to reload on changes. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://tessl.io/registry/skills/github/pockethost/pockethost/pocketbase-jsvm)  

Version‑specific notes (based on JSVM docs):  

* For **≤0.22**, bootstrap hooks use `onAfterBootstrap` or `$app.onBeforeServe().add`. [Source](https://tessl.io/registry/skills/github/pockethost/pockethost/pocketbase-jsvm)  
* For **≥0.23** (your 0.39 case), bootstrap logic uses **`onBootstrap(e)`** and you call `e.next()` to continue startup. [Source](https://tessl.io/registry/skills/github/pockethost/pockethost/pocketbase-jsvm)  

This gives you a stable lifecycle point to initialize FTS infrastructure (e.g. verify tables, warm caches) when the instance starts.

---

## 2. JavaScript hook APIs: what you can do

PocketBase’s JSVM exposes a **global API surface** aimed at most backend concerns. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

### 2.1 Global bindings

Common global objects include: [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  

* **`$app`** – PocketBase application instance (CRUD, DAO access, etc.). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  
* **`$apis`** – helpers for HTTP routes and middlewares. [Source](https://pocketbase.io/jsvm/modules/hook.html)  
* **`$dbx`** – database query builder helpers (thin layer over SQLite). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  
* **`$http`** – HTTP client for external calls (search, enrichment services, etc.). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
* **`$filesystem`, `$os`, `$filepath`** – system utilities. [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
* **`$security`** – cryptography/security utilities (e.g. signing, hashing). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
* **`$mails`** – email sending utilities. [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
* **`__hooks`** – absolute path to the hooks directory (useful for `require()`). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  

JSVM can import **CommonJS‑style NPM modules that are pure ECMAScript**, which lets you reuse query‑parsing, tokenization, or ranking libraries, as long as they don’t depend on Node‑specific APIs. [Source](https://pocketpages.dev/docs/jsvm)

### 2.2 Global functions / event hooks

PocketBase exposes a set of hook functions to attach behavior: [Source](https://pocketbase.io/docs/js-event-hooks/) [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbasecloud.com/javascript-hooks/) [Source](https://pocketbase.io/jsvm/modules/hook.html)  

* **HTTP routing**
  * `routerAdd(method, path, handler)` – register custom HTTP routes (e.g. `/search` endpoint backed by FTS5). [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
  * `routerUse(middleware)` – register global middlewares (logging, auth). [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  

* **Record lifecycle hooks**
  * `onRecordCreate`, `onRecordUpdate`, `onRecordDelete` (and variants) – run before/after CRUD on collections. [Source](https://pocketbase.io/docs/js-event-hooks/) [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  
  * These get context with collection name, record data, and access to `$app` for DB operations. [Source](https://pocketbase.io/docs/js-event-hooks/) [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  

* **Cron / scheduling**
  * `cronAdd(spec, handler)` – schedule periodic jobs (e.g. FTS reindex, statistics). [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  
  * `cronRemove(id)` – remove scheduled jobs. [Source](https://pocketbase-pocketbase.mintlify.app/js/overview)  

* **Bootstrap / app lifecycle**
  * `onBootstrap(e)` – run during startup; used for one‑time init or integrity checks. [Source](https://tessl.io/registry/skills/github/pockethost/pockethost/pocketbase-jsvm)  

These hooks run **inside the PocketBase instance**, not in the client; they are strictly server‑side and not directly accessible from SvelteKit or other frontends. [Source](https://stackoverflow.com/questions/77513469/how-to-access-pocketbase-custom-hooks-values-in-sveltekit)

---

## 3. JavaScript migrations and low‑level SQLite access

PocketBase adds a **JavaScript migration layer** wired to SQLite through the JSVM. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase.io/jsvm/modules/hook.html)

### 3.1 Migrations directory and `$migrate` API

Configuration fields include a **`MigrationsDir`** pointing to the directory that holds JS migration files (often `pb_migrations`). [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks)  

The JSVM reference exposes a **`migrate` module** under the hook API surface, giving you functions to register migrations. [Source](https://pocketbase.io/jsvm/modules/hook.html)  
While the exact function signatures vary by version, the pattern is:

* Define migration files in the migrations directory.
* Each file registers **“up”** and **“down”** steps with `$migrate` (or similar), containing JS code that runs SQL or uses `$dbx`/`$app` to change schema and data. [Source](https://pocketbase.io/jsvm/modules/hook.html) [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks)  

This is the key mechanism you’d use to create **FTS5 virtual tables**, triggers, and indexes.

### 3.2 DB access from JS

From JS hooks and migrations you can reach SQLite in two ways: [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

* **High‑level CRUD via `$app`** – create/update/delete records like the Go API, respecting PocketBase rules and validations. [Source](https://github.com/pocketbase/pocketbase/discussions/2767) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://www.reddit.com/r/pocketbase/comments/1ifcsb4/you_can_now_use_the_pocketbase_js_sdk_from_inside/)  
* **Query builder / low‑level SQL via `$dbx`** – run more direct queries, which is what you need for FTS5 constructs. [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  

The JS APIs are **semi‑auto‑generated from Go APIs**, so most operations available to Go hooks have corresponding JS bindings. [Source](https://github.com/pocketbase/pocketbase/discussions/2767)  
This implies you can issue custom SQL statements and manage additional tables beyond the PocketBase collections.

---

## 4. Implementing SQLite FTS5 full‑text indexing with JS hooks & migrations

PocketBase does not ship a built‑in full‑text search abstraction. To use SQLite FTS5, you combine:

* **JavaScript migrations** to create and maintain FTS5 virtual tables.
* **Record hooks** to keep those tables synchronized with PocketBase collections.
* **Custom routes** (via `routerAdd`) to expose search endpoints that run FTS queries.

Below is a **technical design pattern** based on PocketBase’s documented capabilities and standard SQLite FTS5 behavior (FTS5 SQL is SQLite‑standard; the integration pattern is an architectural inference from the JSVM + SQLite setup). [Source](https://pocketbase.io/docs/js-overview/) [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html) [Source](https://github.com/pocketbase/pocketbase)

### 4.1 Schema design via migrations (FTS5 virtual tables)

In a JS migration file (e.g. `001_fts_posts.pb.js` under `pb_migrations`), you’d:

* Use `$dbx` or a raw DB handle to execute something like:

```js
// Illustrative example: FTS5 table for a "posts" collection
function up() {
  // Example using a raw SQL execution helper from $dbx:
  $dbx.raw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      body,
      author,
      content='posts',      -- optional content table link
      content_rowid='id'    -- link to PocketBase record id
    );
  `);

  // Optionally pre-fill FTS table from existing records
  const records = $app.collection('posts').getFullList();
  for (const r of records) {
    $dbx.raw(
      'INSERT INTO posts_fts(rowid, title, body, author) VALUES (?, ?, ?, ?)',
      [r.id, r.title, r.body, r.author]
    );
  }
}

function down() {
  $dbx.raw('DROP TABLE IF EXISTS posts_fts;');
}

$migrate.add({
  id: '001_fts_posts',
  up,
  down,
});
```

*This code is conceptual; exact APIs for `raw`/migration registration depend on your JSVM version, but the pattern—FTS5 virtual table created from a migration—is directly supported by PocketBase’s ability to run custom SQL through JS migrations. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)*

Key design points:

* Keep the FTS table in the same SQLite database as PocketBase’s collections for transactionally consistent updates.
* Use `content='posts'`/`content_rowid='id'` if you want to leverage SQLite’s contentless FTS5 rules and automatic column mapping.

### 4.2 Keeping FTS in sync: record hooks vs SQLite triggers

You have two broad options:

#### Option A – Use PocketBase record hooks (JS‑level synchronization)

Use `onRecordCreate`, `onRecordUpdate`, and `onRecordDelete` for the target collection: [Source](https://pocketbase.io/docs/js-event-hooks/) [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

```js
onRecordCreate('posts', (e) => {
  const r = e.record;
  $dbx.raw(
    'INSERT INTO posts_fts(rowid, title, body, author) VALUES (?, ?, ?, ?)',
    [r.id, r.title, r.body, r.author]
  );
});

onRecordUpdate('posts', (e) => {
  const r = e.record;
  $dbx.raw(
    'UPDATE posts_fts SET title = ?, body = ?, author = ? WHERE rowid = ?',
    [r.title, r.body, r.author, r.id]
  );
});

onRecordDelete('posts', (e) => {
  const r = e.record;
  $dbx.raw('DELETE FROM posts_fts WHERE rowid = ?', [r.id]);
});
```

Characteristics (based on documented hook behavior): [Source](https://pocketbase.io/docs/js-event-hooks/) [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

* Runs inside PocketBase’s JSVM with full access to `$app` and `$dbx`.
* Honours PocketBase’s validation and transactional flow.
* Easy to debug and upgrade because logic lives at the hook level.

Trade‑offs (architectural inference):

* You rely on PocketBase’s transaction handling; ensure FTS updates are part of the same DB transaction, or at least fail visibly.
* If you bulk‑import data outside PocketBase, hooks won’t fire, so you need migration‑level backfills.

#### Option B – Use SQLite triggers (DB‑level synchronization)

Alternatively, you can create **SQLite triggers** on the underlying PocketBase table in a migration using raw SQL via `$dbx`. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

Example (conceptual SQL executed from a migration):

```js
$dbx.raw(`
  CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, body, author)
    VALUES (new.id, new.title, new.body, new.author);
  END;
`);

$dbx.raw(`
  CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
    UPDATE posts_fts
    SET title = new.title, body = new.body, author = new.author
    WHERE rowid = new.id;
  END;
`);

$dbx.raw(`
  CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
    DELETE FROM posts_fts WHERE rowid = old.id;
  END;
`);
```

Characteristics (inferred from SQLite + PocketBase architecture):

* Synchronization happens at the DB level, independent of PocketBase hook logic.
* More robust if other tooling writes directly to SQLite through PocketBase’s DAO or lower‑level APIs.

Trade‑offs:

* Debugging is more “database‑centric”; errors manifest in SQLite rather than JS hooks.
* You need to be careful about PocketBase schema migrations (renames/column changes) breaking triggers.

PocketBase’s ability to run arbitrary SQL in JS migrations makes both options viable. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)

### 4.3 Exposing FTS search via JS routes

Once FTS5 is set up, you expose search via **custom HTTP routes**. [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbasecloud.com/javascript-hooks/) [Source](https://pocketbase.io/jsvm/modules/hook.html)

In a hook file (e.g. `search.pb.js` in `pb_hooks`):

```js
routerAdd('GET', '/search/posts', (c) => {
  const q = c.request.query.get('q') || '';
  const limit = parseInt(c.request.query.get('limit') || '20', 10);

  // Basic FTS5 match query; parameterization depends on $dbx API
  const rows = $dbx.raw(
    `
    SELECT p.id, p.title, p.body, p.author
    FROM posts_fts f
    JOIN posts p ON p.id = f.rowid
    WHERE posts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
    `,
    [q, limit]
  );

  // Use $apis to format JSON response (pattern may vary by version)
  return c.json(rows);
});
```

This design uses PocketBase’s documented ability to: [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbasecloud.com/javascript-hooks/) [Source](https://pocketbase.io/jsvm/modules/hook.html)

* Add custom routes via `routerAdd`.
* Use JSVM’s database helpers to run custom queries.
* Build API responses with helpers in `$apis`.

You can then call `/api/search/posts?q=...` (or your chosen path) from frontends, using either raw `fetch` or the official JavaScript SDK. [Source](https://github.com/pocketbase/js-sdk) [Source](https://pocketbase.io/docs/how-to-use/) [Source](https://github.com/pocketbase/js-sdk/blob/master/README.md) [Source](https://github.com/pocketbase/pocketbase)

---

## 5. Operational considerations for PocketBase + FTS5

These points follow from the documented capabilities and typical SQLite FTS5 behavior; they are architectural guidance rather than explicit PocketBase docs.

* **Versioning & JSVM reference**  
  Use the JSVM reference that matches your PocketBase version (0.39 is ≥0.23), as the hook API surface and types have evolved; Pockethost’s docs explicitly highlight version splits and type differences. [Source](https://tessl.io/registry/skills/github/pockethost/pockethost/pocketbase-jsvm)  

* **Performance**  
  * FTS5 can be memory‑intensive; keep per‑collection FTS tables lean (only index fields you need).  
  * Use cron hooks (`cronAdd`) for periodic maintenance tasks like `REBUILD` or statistics tables. [Source](https://pocketbasecloud.com/docs/pocketbase/extending-with-hooks/) [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  

* **Migrations discipline**  
  * Treat FTS schema as first‑class: each change to your PocketBase collections that affects indexed text should come with a paired migration for FTS tables/triggers.  
  * Use `up`/`down` patterns to keep rollbacks safe. JS migrations are explicitly supported and versioned by PocketBase. [Source](https://pocketbase-pocketbase.mintlify.app/extending/javascript-hooks) [Source](https://pocketbase.io/jsvm/modules/hook.html)  

* **Security**  
  * Custom routes should leverage `$apis` and any available auth middlewares so that full‑text search respects the same access rules as standard PocketBase APIs. [Source](https://pocketbase-pocketbase.mintlify.app/js/overview) [Source](https://pocketbase.io/jsvm/modules/hook.html)  
  * Avoid exposing raw SQL semantics (e.g. direct `MATCH` strings) to anonymous clients without sanitization or query shaping.

---

If you share more specifics about your PocketBase 0.39 schema (collections, fields, search requirements), I can sketch concrete migration and hook files tailored to that structure, using the JSVM and `$dbx` patterns that align with the docs above.
