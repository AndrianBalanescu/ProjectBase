// pb_public/js/components/ImportModal.js
// Minimalist Issue Importer (CSV, GitHub, Linear, Plane) supporting Dark and Light themes.

const ImportModalComponent = {
  props: ['isOpen', 'projects', 'currentProject'],
  emits: ['close', 'imported'],
  data() {
    return {
      projectId: '',
      mode: 'csv', // 'csv' | 'github' | 'linear' | 'plane'
      csvText: '',
      linearText: '',
      planeText: '',
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
        this.linearText = '';
        this.planeText = '';
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
        } else if (c === '\n' || (c === '\r' && all[i + 1] === '\n')) {
          if (c === '\r') i++;
          row.push(field);
          field = '';
          if (row.some(f => f.trim() !== '')) rows.push(row);
          row = [];
        } else {
          field += c;
        }
      }
      if (field || row.length > 0) {
        row.push(field);
        if (row.some(f => f.trim() !== '')) rows.push(row);
      }
      if (rows.length === 0) return [];
      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const titleIdx = headers.indexOf('title');
      if (titleIdx === -1) {
        throw new Error('CSV must contain a "title" column in the header row');
      }
      const descIdx = headers.indexOf('description');
      const statusIdx = headers.indexOf('status');
      const prioIdx = headers.indexOf('priority');
      const assignIdx = headers.indexOf('assignee');
      const dueIdx = headers.indexOf('due_date');
      const estIdx = headers.indexOf('estimate');
      const labelsIdx = headers.indexOf('labels');
      const out = [];
      for (let r = 1; r < rows.length; r++) {
        const line = rows[r];
        const title = (line[titleIdx] || '').trim();
        if (!title) continue;
        const rowObj = { title };
        if (descIdx !== -1 && line[descIdx]) rowObj.description = line[descIdx].trim();
        if (statusIdx !== -1 && line[statusIdx]) rowObj.status = line[statusIdx].trim().toLowerCase();
        if (prioIdx !== -1 && line[prioIdx]) rowObj.priority = line[prioIdx].trim().toLowerCase();
        if (assignIdx !== -1 && line[assignIdx]) rowObj.assignee = line[assignIdx].trim();
        if (dueIdx !== -1 && line[dueIdx]) rowObj.due_date = line[dueIdx].trim();
        if (estIdx !== -1 && line[estIdx]) {
          const num = parseInt(line[estIdx], 10);
          if (!isNaN(num)) rowObj.estimate = num;
        }
        if (labelsIdx !== -1 && line[labelsIdx]) {
          rowObj.labels = line[labelsIdx].split(/[;,|]/).map(s => s.trim()).filter(Boolean);
        }
        out.push(rowObj);
      }
      return out;
    },
    async importCsv() {
      if (!this.parsed || this.rows.length === 0) {
        this.error = 'No parsed rows to import.';
        return;
      }
      if (!this.projectId) {
        this.error = 'Select a target project first.';
        return;
      }
      this.importing = true;
      this.error = '';
      this.result = null;
      try {
        const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
          ? API.client.authStore.token : '';
        const resp = await fetch('/api/projectbase/import/csv', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
          },
          body: JSON.stringify({
            project_id: this.projectId,
            rows: this.rows
          })
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || ('HTTP ' + resp.status));
        }
        this.result = data;
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
    async importLinear() {
      const csv = String(this.linearText || '').trim();
      if (!this.projectId) { this.error = 'Select a target project.'; return; }
      if (!csv) { this.error = 'Paste your Linear CSV export first.'; return; }
      this.importing = true;
      this.error = '';
      this.result = null;
      try {
        const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
          ? API.client.authStore.token : '';
        const resp = await fetch('/api/projectbase/import/linear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
          },
          body: JSON.stringify({
            project_id: this.projectId,
            csv: csv
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
    async importPlane() {
      const csv = String(this.planeText || '').trim();
      if (!this.projectId) { this.error = 'Select a target project.'; return; }
      if (!csv) { this.error = 'Paste your Plane CSV export first.'; return; }
      this.importing = true;
      this.error = '';
      this.result = null;
      try {
        const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
          ? API.client.authStore.token : '';
        const resp = await fetch('/api/projectbase/import/plane', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
          },
          body: JSON.stringify({
            project_id: this.projectId,
            csv: csv
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
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" @click.self="close">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="close"></div>

      <div class="relative w-full max-w-2xl rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i>
            </div>
            <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Import Issues</h2>
          </div>
          <button @click="close" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <!-- Source Mode Tabs -->
          <div class="flex items-center space-x-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit">
            <button @click="mode='csv'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="mode==='csv' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">CSV</button>
            <button @click="mode='github'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="mode==='github' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">GitHub</button>
            <button @click="mode='linear'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="mode==='linear' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">Linear</button>
            <button @click="mode='plane'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="mode==='plane' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">Plane</button>
          </div>

          <!-- Target Project -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Target Project</label>
            <select v-model="projectId" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer">
              <option v-for="p in validProjects" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
            </select>
          </div>

          <!-- GitHub Import Fields -->
          <template v-if="mode==='github'">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">GitHub Repository</label>
              <input v-model="ghRepo" @input="result=null" placeholder="owner/repo (e.g. AndrianBalanescu/ProjectBase)"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">State</label>
                <select v-model="ghState" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer">
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Max Issues</label>
                <input v-model.number="ghMax" type="number" min="1"
                  class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Personal Access Token <span class="text-zinc-400 font-normal">(optional, raises rate limit)</span></label>
              <input v-model="ghToken" type="password" placeholder="ghp_... or github_pat_..."
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
            </div>
            <button
              @click="importGithub"
              :disabled="importing"
              class="w-full px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
            >{{ importing ? 'Importing...' : 'Import from GitHub' }}</button>
            <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
            <div v-if="result" class="text-xs space-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-emerald-600 dark:text-emerald-400 font-medium">Import complete</p>
              <p class="text-zinc-600 dark:text-zinc-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total ({{ result.repo }})</p>
              <p v-if="result.rate_limit" class="text-zinc-400">Rate limit remaining: {{ result.rate_limit.remaining ?? 'n/a' }}</p>
            </div>
          </template>

          <!-- Linear Import Fields -->
          <template v-if="mode==='linear'">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Linear CSV Export</label>
              <textarea
                v-model="linearText"
                @input="result=null"
                rows="6"
                placeholder="ID,Title,Status,Priority,Labels,Assignee,Due Date&#10;abc123,Backend rewrite,In Progress,High,\"bug, perf\",Alice,2026-09-01"
                class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-y"
              ></textarea>
            </div>
            <button
              @click="importLinear"
              :disabled="importing || !linearText"
              class="w-full px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
            >{{ importing ? 'Importing...' : 'Import from Linear' }}</button>
            <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
            <div v-if="result" class="text-xs space-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-emerald-600 dark:text-emerald-400 font-medium">Import complete</p>
              <p class="text-zinc-600 dark:text-zinc-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total</p>
            </div>
          </template>

          <!-- Plane Import Fields -->
          <template v-if="mode==='plane'">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Plane Workspace CSV Export</label>
              <textarea
                v-model="planeText"
                @input="result=null"
                rows="6"
                placeholder="Name,State,Priority,Labels,Assignees,Start Date,Target Date&#10;Backend rewrite,In Progress,High,\"bug, perf\",Alice,2026-08-01,2026-09-01"
                class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-y"
              ></textarea>
            </div>
            <button
              @click="importPlane"
              :disabled="importing || !planeText"
              class="w-full px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
            >{{ importing ? 'Importing...' : 'Import from Plane' }}</button>
            <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
            <div v-if="result" class="text-xs space-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-emerald-600 dark:text-emerald-400 font-medium">Import complete</p>
              <p class="text-zinc-600 dark:text-zinc-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total</p>
            </div>
          </template>

          <!-- CSV Import Fields -->
          <template v-if="mode==='csv'">
            <div class="flex items-center space-x-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit">
              <button @click="inputType='paste'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="inputType==='paste' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">Paste CSV</button>
              <button @click="inputType='upload'" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors" :class="inputType==='upload' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'">Upload file</button>
            </div>

            <textarea
              v-if="inputType==='paste'"
              ref="csvInput"
              v-model="csvText"
              @input="parsed=false; result=null"
              rows="6"
              placeholder="title,description,status,priority,assignee,labels&#10;Fix login bug,Description here,todo,high,Alice,bug;auth"
              class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-y"
            ></textarea>
            <div v-else class="flex items-center gap-3">
              <label class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-700 dark:text-zinc-200 cursor-pointer border border-zinc-200 dark:border-zinc-700">
                <i data-lucide="file-up" class="w-3.5 h-3.5 inline mr-1"></i> Choose CSV file
                <input type="file" accept=".csv,text/csv" class="hidden" @change="handleFile" />
              </label>
              <span v-if="inputType==='upload' && csvText" class="text-xs text-zinc-400">Loaded file ({{ csvText.length }} chars)</span>
            </div>

            <button
              v-if="inputType==='paste'"
              @click="parseCsv"
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >Parse CSV</button>

            <!-- Error / Result -->
            <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
            <div v-if="result" class="text-xs space-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-emerald-600 dark:text-emerald-400 font-medium">Import complete</p>
              <p class="text-zinc-600 dark:text-zinc-300">{{ result.imported }} imported, {{ result.skipped }} skipped, {{ result.total }} total</p>
            </div>

            <!-- Preview -->
            <div v-if="parsed">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Preview ({{ rows.length }} rows)</div>
              <div class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table class="w-full text-xs text-left">
                  <thead class="bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                    <tr>
                      <th class="px-3 py-1.5 font-medium">Title</th>
                      <th class="px-3 py-1.5 font-medium">Status</th>
                      <th class="px-3 py-1.5 font-medium">Priority</th>
                      <th class="px-3 py-1.5 font-medium">Assignee</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr v-for="(r, idx) in previewRows" :key="idx" class="bg-white dark:bg-zinc-900/40">
                      <td class="px-3 py-1.5 text-zinc-900 dark:text-zinc-100">{{ r.title }}</td>
                      <td class="px-3 py-1.5 text-zinc-500 font-mono">{{ r.status || 'todo' }}</td>
                      <td class="px-3 py-1.5 text-zinc-500 font-mono">{{ r.priority || 'none' }}</td>
                      <td class="px-3 py-1.5 text-zinc-500">{{ r.assignee || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button @click="close" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            v-if="mode==='csv'"
            @click="importCsv"
            :disabled="importing || !parsed"
            class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
          >{{ importing ? 'Importing...' : 'Import' }}</button>
        </div>
      </div>
    </div>
  `
};
