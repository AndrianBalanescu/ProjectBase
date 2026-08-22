// pb_public/js/components/ImportModal.js
// CSV importer UI for ProjectBase (cycle 2). Users paste or select a CSV file,
// preview the parsed rows, pick a target project, and import. Duplicate rows are
// reported by the backend. Format:
//   title,description,status,priority,assignee,due_date,estimate,labels
// Supports a flexible CSV parser (quoted fields, commas in fields).

const ImportModalComponent = {
  props: ['isOpen', 'projects', 'currentProject'],
  emits: ['close', 'imported'],
  data() {
    return {
      projectId: '',
      mode: 'csv', // 'csv' | 'github'
      csvText: '',
      rows: [],
      parsed: false,
      importing: false,
      result: null,
      error: '',
      inputType: 'paste', // 'paste' | 'upload'
      // GitHub import state
      ghRepo: '',
      ghToken: '',
      ghState: 'all',
      ghMax: 1000
    };
  },
  computed: {
    validProjects() {
      return this.projects || [];
    },
    previewRows() {
      return this.rows.slice(0, 5);
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.projectId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : '');
        this.csvText = '';
        this.rows = [];
        this.parsed = false;
        this.importing = false;
        this.result = null;
        this.error = '';
        this.ghRepo = '';
        this.ghToken = '';
        this.ghState = 'all';
        this.ghMax = 1000;
        this.$nextTick(() => {
          const inp = this.$refs.csvInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    handleFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.csvText = String(ev.target.result || '');
        this.inputType = 'upload';
        this.parseCsv();
      };
      reader.readAsText(file);
    },
    parseCsv() {
      this.error = '';
      this.result = null;
      try {
        this.rows = this._parse(this.csvText);
        if (this.rows.length === 0) {
          this.error = 'No rows found. Check that the CSV has a title column.';
          this.parsed = false;
          return;
        }
        this.parsed = true;
      } catch (err) {
        this.parsed = false;
        this.error = 'Could not parse CSV: ' + String((err && err.message) || err);
      }
    },
    // Minimal RFC-4180 CSV parser handling quotes, commas, CRLF.
    _parse(text) {
      const rows = [];
      let row = [];
      let field = '';
      let inQuotes = false;
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      // Handle multiline quoted fields by joining lines, but keep simple: split on \n.
      // We iterate char-by-char to properly handle quotes and embedded commas.
      const all = String(text || '');
      for (let i = 0; i < all.length; i++) {
        const c = all[i];
        if (inQuotes) {
          if (c === '"') {
            if (all[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else {
            field += c;
          }
        } else if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(field);
          field = '';
        } else if (c === '\n' || c === '\r') {
          if (c === '\r' && all[i + 1] === '\n') i++;
          row.push(field);
          field = '';
          if (row.some(x => x.trim() !== '')) rows.push(row);
          row = [];
        } else {
          field += c;
        }
      }
      // flush last row
      if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.some(x => x.trim() !== '')) rows.push(row);
      }
      return this._mapHeaders(rows);
    },
    _mapHeaders(parsed) {
      if (parsed.length === 0) return [];
      const header = parsed[0].map(h => h.trim().toLowerCase());
      const map = (row) => {
        const obj = {};
        header.forEach((h, idx) => {
          const val = row[idx] != null ? String(row[idx]).trim() : '';
          if (h === 'labels') {
            obj[h] = val ? val.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [];
          } else {
            obj[h] = val;
          }
        });
        return obj;
      };
      return parsed.slice(1).map(map).filter(r => r.title);
    },
    async importCsv() {
      if (!this.parsed || this.rows.length === 0) {
        this.error = 'Parse the CSV first.';
        return;
      }
      if (!this.projectId) {
        this.error = 'Select a target project.';
        return;
      }
      this.importing = true;
      this.error = '';
      this.result = null;
      try {
        // API is a top-level `const` in a classic script (global lexical scope),
        // NOT a window property — so reference it bare like the other components.
        const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
          ? API.client.authStore.token
          : '';
        const resp = await fetch('/api/projectbase/import/csv', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
          },
          body: JSON.stringify({ project_id: this.projectId, rows: this.rows })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
        this.result = data;
        this.parsed = false;
        this.$emit('imported', data);
      } catch (err) {
        this.error = 'Import failed: ' + String((err && err.message) || err);
      } finally {
        this.importing = false;
      }
    },
    async importGithub() {
      const repo = String(this.ghRepo || '').trim();
      if (!this.projectId) { this.error = 'Select a target project.'; return; }
      if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) { this.error = 'Enter a GitHub repo as owner/name.'; return; }
      this.importing = true;
      this.error = '';
      this.result = null;
      try {
        const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
          ? API.client.authStore.token : '';
        const resp = await fetch('/api/projectbase/import/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
          },
          body: JSON.stringify({
            project_id: this.projectId,
            repo: repo,
            token: this.ghToken || undefined,
            state: this.ghState,
            max_issues: this.ghMax
          })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
        this.result = data;
        this.$emit('imported', data);
      } catch (err) {
        this.error = 'Import failed: ' + String((err && err.message) || err);
      } finally {
        this.importing = false;
      }
    },
    close() {
      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="close">
      <div class="w-full max-w-2xl rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div class="flex items-center space-x-2">
            <i data-lucide="upload" class="w-4 h-4 text-indigo-400"></i>
            <h2 class="text-sm font-semibold text-white">Import Issues</h2>
          </div>
          <button @click="close" class="text-gray-400 hover:text-white transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Source Mode Tabs -->
          <div class="flex items-center space-x-2 text-xs">
            <button @click="mode='csv'" class="px-3 py-1.5 rounded-lg font-medium" :class="mode==='csv' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">CSV</button>
            <button @click="mode='github'" class="px-3 py-1.5 rounded-lg font-medium" :class="mode==='github' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">GitHub</button>
          </div>

          <!-- Target Project -->
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Target Project</label>
            <select v-model="projectId" class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option v-for="p in validProjects" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
            </select>
          </div>

          <!-- GitHub Import Fields -->
          <template v-if="mode==='github'">
            <div>
              <label class="text-xs font-medium text-gray-400 mb-1 block">GitHub Repository</label>
              <input v-model="ghRepo" @input="result=null" placeholder="owner/repo (e.g. AndrianBalanescu/ProjectBase)"
                class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-gray-400 mb-1 block">State</label>
                <select v-model="ghState" class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-400 mb-1 block">Max Issues</label>
                <input v-model.number="ghMax" type="number" min="1" max="5000"
                  class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-400 mb-1 block">Personal Access Token <span class="text-gray-500">(optional, raises rate limit)</span></label>
              <input v-model="ghToken" type="password" placeholder="ghp_... or github_pat_..."
                class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <button
              @click="importGithub"
              :disabled="importing"
              class="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >{{ importing ? 'Importing...' : 'Import from GitHub' }}</button>
            <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
            <div v-if="result" class="text-xs space-y-1 rounded-lg bg-gray-950 border border-gray-800 p-3">
              <p class="text-emerald-400 font-medium">Import complete</p>
              <p class="text-gray-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total ({{ result.repo }})</p>
              <p v-if="result.rate_limit" class="text-gray-500">Rate limit remaining: {{ result.rate_limit.remaining ?? 'n/a' }}</p>
              <p v-if="result.errors && result.errors.length" class="text-amber-400">{{ result.errors.length }} error(s): {{ result.errors.slice(0,3).map(e => (e.gh!=null ? '#' + e.gh : 'page ' + e.page) + ': ' + e.error).join('; ') }}</p>
            </div>
          </template>

          <!-- CSV Import Fields -->
          <template v-if="mode==='csv'">
          <!-- Input Mode Tabs -->
          <div class="flex items-center space-x-2 text-xs">
            <button @click="inputType='paste'" class="px-3 py-1.5 rounded-lg font-medium" :class="inputType==='paste' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">Paste CSV</button>
            <button @click="inputType='upload'" class="px-3 py-1.5 rounded-lg font-medium" :class="inputType==='upload' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">Upload file</button>
          </div>


          <textarea
            v-if="inputType==='paste'"
            ref="csvInput"
            v-model="csvText"
            @input="parsed=false; result=null"
            rows="6"
            placeholder="title,description,status,priority,assignee,labels&#10;Fix login bug,Description here,todo,high,Alice,bug;auth"
            class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
          ></textarea>
          <div v-else class="flex items-center gap-3">
            <label class="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 cursor-pointer border border-gray-700/60">
              <i data-lucide="file-up" class="w-3.5 h-3.5 inline mr-1"></i> Choose CSV file
              <input type="file" accept=".csv,text/csv" class="hidden" @change="handleFile" />
            </label>
            <span v-if="inputType==='upload' && csvText" class="text-xs text-gray-400">Loaded file ({{ csvText.length }} chars)</span>
          </div>

          <button
            @click="parseCsv"
            class="w-full px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 border border-gray-700/60"
          >Parse CSV</button>

          <!-- Error / Result -->
          <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
          <div v-if="result" class="text-xs space-y-1 rounded-lg bg-gray-950 border border-gray-800 p-3">
            <p class="text-emerald-400 font-medium">Import complete</p>
            <p class="text-gray-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total</p>
            <p v-if="result.errors && result.errors.length" class="text-amber-400">Warnings: {{ result.errors.length }} row(s) skipped (see first below)</p>
            <p v-if="result.errors && result.errors.length" class="text-amber-400/80 font-mono">{{ result.errors.slice(0,3).map(e => 'row ' + e.row + ': ' + e.error).join('; ') }}</p>
          </div>

          <!-- Preview -->
          <div v-if="parsed">
            <div class="text-xs font-medium text-gray-400 mb-1">Preview ({{ rows.length }} rows)</div>
            <div class="overflow-x-auto rounded-lg border border-gray-800">
              <table class="w-full text-xs text-left">
                <thead class="bg-gray-950 text-gray-400">
                  <tr>
                    <th class="px-3 py-2 font-medium">Title</th>
                    <th class="px-3 py-2 font-medium">Status</th>
                    <th class="px-3 py-2 font-medium">Priority</th>
                    <th class="px-3 py-2 font-medium">Assignee</th>
                  </tr>
                </thead>
                <tbody class="bg-gray-900/50">
                  <tr v-for="(r, idx) in previewRows" :key="idx" class="border-t border-gray-800/60">
                    <td class="px-3 py-2 text-gray-200">{{ r.title }}</td>
                    <td class="px-3 py-2 text-gray-400">{{ r.status || 'todo' }}</td>
                    <td class="px-3 py-2 text-gray-400">{{ r.priority || 'none' }}</td>
                    <td class="px-3 py-2 text-gray-400">{{ r.assignee || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </template>
        </div>

        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-950/50">
          <button @click="close" class="px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-gray-800">Cancel</button>
          <button
            @click="importCsv"
            :disabled="importing || !parsed"
            class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ importing ? 'Importing...' : 'Import' }}</button>
        </div>
      </div>
    </div>
  `
};
