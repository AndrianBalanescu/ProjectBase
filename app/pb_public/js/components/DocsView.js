// pb_public/js/components/DocsView.js
// Read-only repository documentation viewer.
//
// Source of truth: app/pb_public/docs-files/manifest.json, produced by
// scripts/sync_docs.sh (a build-time copy). This component NEVER reads files
// from the server filesystem: it only fetches static assets inside the public
// dir. PocketBase's $os.readFile has no path-traversal guard, so a runtime
// file-read route would let an authenticated user read arbitrary server files
// (see scripts/sync_docs.sh for the full rationale).

const DocsViewComponent = {
  props: [],
  data() {
    return {
      manifest: null,
      active: null,      // selected manifest entry
      content: '',       // raw markdown of the active file
      loadingList: true,
      loadingDoc: false,
      error: null,
      filter: '',
    };
  },
  computed: {
    files() {
      return this.manifest && Array.isArray(this.manifest.files) ? this.manifest.files : [];
    },
    filteredFiles() {
      const q = this.filter.trim().toLowerCase();
      if (!q) return this.files;
      return this.files.filter(f =>
        (f.title || '').toLowerCase().includes(q) ||
        (f.source || '').toLowerCase().includes(q));
    },
    groups() {
      const out = [];
      for (const f of this.filteredFiles) {
        const g = f.group || 'Docs';
        let bucket = out.find(b => b.name === g);
        if (!bucket) { bucket = { name: g, files: [] }; out.push(bucket); }
        bucket.files.push(f);
      }
      return out;
    },
    rendered() {
      if (!this.content) return '';
      if (window.marked && window.DOMPurify) {
        try {
          return window.DOMPurify.sanitize(
            window.marked.parse(this.content, { breaks: false, gfm: true }),
            { ADD_ATTR: ['target', 'rel'] });
        } catch (e) {
          return '<p class="text-xs text-red-500">Failed to render markdown.</p>';
        }
      }
      // Degrade honestly rather than showing raw HTML as if it were rendered.
      const esc = String(this.content)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<pre class="text-xs whitespace-pre-wrap">' + esc + '</pre>';
    },
    activeMeta() {
      return this.active || null;
    },
  },
  watch: {
    active(v) {
      if (v) this.loadDoc(v);
    },
  },
  mounted() {
    this.loadManifest();
  },
  methods: {
    async loadManifest() {
      this.loadingList = true;
      this.error = null;
      let res;
      try {
        res = await fetch('/docs-files/manifest.json', { cache: 'no-cache' });
      } catch (e) {
        // Network failure: the honest cause is connectivity or an uncached
        // first visit, NOT a missing sync. Do not blame the build script.
        this.error = 'Could not reach the server. If you are offline, open the Docs view once while online to cache it.';
        this.loadingList = false;
        return;
      }
      try {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.manifest = await res.json();
        if (this.files.length && !this.active) this.active = this.files[0];
      } catch (e) {
        // The server answered, so the manifest really is missing: this is the
        // case that the sync script fixes.
        this.error = 'Documentation manifest missing (HTTP ' + res.status + '). Run scripts/sync_docs.sh.';
      } finally {
        this.loadingList = false;
      }
    },
    async loadDoc(file) {
      this.loadingDoc = true;
      this.error = null;
      this.content = '';
      let res;
      try {
        res = await fetch('/docs-files/' + encodeURIComponent(file.file), { cache: 'no-cache' });
      } catch (e) {
        this.error = 'Could not reach the server for ' + (file.source || file.file) + '. You may be offline and this document is not cached yet.';
        this.loadingDoc = false;
        return;
      }
      try {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.content = await res.text();
      } catch (e) {
        this.error = 'Could not load ' + (file.source || file.file) + ' (HTTP ' + res.status + ').';
      } finally {
        this.loadingDoc = false;
      }
    },
    selectFile(file) {
      this.active = file;
    },
    fmtBytes(n) {
      if (!n && n !== 0) return '';
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / (1024 * 1024)).toFixed(1) + ' MB';
    },
    isActive(file) {
      return this.active && this.active.file === file.file;
    },
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-hidden flex bg-zinc-50 dark:bg-[#09090b]">
      <!-- Left: file index -->
      <aside class="w-64 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto p-3 select-none">
        <div class="mb-2">
          <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Docs</h2>
          <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Repository markdown, read-only</p>
        </div>
        <div class="relative mb-2">
          <i data-lucide="search" class="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400"></i>
          <input
            v-model="filter"
            type="text"
            placeholder="Filter files"
            class="w-full pl-7 pr-2 py-1.5 rounded-md text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div v-if="loadingList" class="text-xs text-zinc-500 px-1 py-2">Loading…</div>
        <div v-else-if="!files.length" class="text-xs text-zinc-500 px-1 py-2">
          No documentation synced yet.
        </div>
        <template v-else>
          <div v-for="g in groups" :key="g.name" class="mb-3">
            <div class="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1 mb-1">{{ g.name }}</div>
            <button
              v-for="f in g.files"
              :key="f.file"
              type="button"
              @click="selectFile(f)"
              class="w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors mb-0.5"
              :class="isActive(f)
                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
              :title="f.source"
            >
              <span class="block truncate">{{ f.title }}</span>
              <span class="block text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">{{ f.source }}</span>
            </button>
          </div>
        </template>
      </aside>

      <!-- Right: rendered document -->
      <section class="flex-1 min-w-0 overflow-y-auto">
        <div v-if="error" class="p-4">
          <div class="text-xs px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
            {{ error }}
          </div>
        </div>

        <template v-else-if="activeMeta">
          <header class="sticky top-0 z-10 px-4 py-2.5 bg-zinc-50/95 dark:bg-[#09090b]/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{{ activeMeta.title }}</h3>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{{ activeMeta.source }} · {{ fmtBytes(activeMeta.bytes) }}</p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">read-only mirror</span>
          </header>

          <div v-if="loadingDoc" class="p-4 text-xs text-zinc-500">Loading document…</div>
          <article
            v-else
            class="chat-markdown px-5 py-4 max-w-3xl text-zinc-800 dark:text-zinc-200"
            v-html="rendered"
          ></article>
        </template>

        <div v-else class="p-6 text-xs text-zinc-500">Select a document from the list.</div>
      </section>
    </div>
  `,
};
