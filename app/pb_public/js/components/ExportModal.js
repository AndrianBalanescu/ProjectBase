// pb_public/js/components/ExportModal.js
// Flat-file exporter UI for ProjectBase (cycle 29).
// The importer (ImportModal) only brings data in; this modal lets a user take
// their issues back out as a portable CSV or JSON file so they can back up,
// migrate to Linear/Plane/Trello, or re-import into another ProjectBase.
// Backed by GET /api/projectbase/export/csv and /api/projectbase/export/json.

const ExportModalComponent = {
  props: ['isOpen', 'projects', 'currentProject'],
  emits: ['close', 'exported'],
  data() {
    return {
      projectId: '',
      format: 'csv', // 'csv' | 'json'
      exporting: false,
      error: '',
      result: null
    };
  },
  computed: {
    validProjects() {
      return this.projects || [];
    },
    selectedProject() {
      return this.validProjects.find(p => p.id === this.projectId) || null;
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.error = '';
        this.result = null;
        this.projectId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : '');
      }
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    // Trigger a browser download by navigating the auth'd fetch to a blob URL.
    // CSV is a text blob; JSON is served as a blob too so we can pretty-print.
    async doExport() {
      this.error = '';
      this.result = null;
      if (!this.projectId) {
        this.error = 'Select a target project first.';
        return;
      }
      const token = (typeof API !== 'undefined' && API.client && API.client.authStore)
        ? API.client.authStore.token : '';
      this.exporting = true;
      try {
        const url = '/api/projectbase/export/' + this.format + '?project=' + encodeURIComponent(this.projectId);
        const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!resp.ok) {
          let msg = 'Export failed (' + resp.status + ')';
          try { const b = await resp.json(); if (b && b.error) msg = b.error; } catch (err) {}
          this.error = msg;
          return;
        }
        const text = await resp.text();
        const proj = this.selectedProject || {};
        const base = (proj.name || 'project').replace(/[^\w\-]+/g, '_');
        const isJson = this.format === 'json';
        const blob = isJson ? new Blob([text], { type: 'application/json' }) : new Blob([text], { type: 'text/csv' });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = base + '-issues.' + (isJson ? 'json' : 'csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
        const rows = isJson ? null : (text.trim() ? text.trim().split('\n').length - 1 : 0);
        this.result = { count: isJson ? null : rows, format: this.format, project: proj.name || '' };
        this.$emit('exported', this.result);
      } catch (err) {
        this.error = 'Export failed: ' + String((err && err.message) || err);
      } finally {
        this.exporting = false;
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="close">
      <div class="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div class="flex items-center space-x-2">
            <i data-lucide="download" class="w-4 h-4 text-indigo-400"></i>
            <h2 class="text-sm font-semibold text-white">Export Issues</h2>
          </div>
          <button @click="close" class="text-gray-400 hover:text-white transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Format Tabs -->
          <div class="flex items-center space-x-2 text-xs">
            <button @click="format='csv'" class="px-3 py-1.5 rounded-lg font-medium" :class="format==='csv' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">CSV</button>
            <button @click="format='json'" class="px-3 py-1.5 rounded-lg font-medium" :class="format==='json' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'">JSON</button>
          </div>

          <!-- Source Project -->
          <div>
            <label class="text-xs font-medium text-gray-400 mb-1 block">Source Project</label>
            <select v-model="projectId" class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option v-for="p in validProjects" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
            </select>
          </div>

          <!-- Info / Result -->
          <div v-if="error" class="px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
            {{ error }}
          </div>
          <div v-if="result" class="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
            Exported {{ result.format.toUpperCase() }} for <strong>{{ result.project }}</strong>.
            <template v-if="result.count !== null">{{ result.count }} row(s) included.</template>
          </div>

          <p class="text-[11px] leading-relaxed text-gray-500">
            Exports mirror the importer columns (title, description, status, priority,
            assignee, dates, estimate, labels, source_key) plus custom fields, so a
            downloaded file can be re-imported into ProjectBase or another tool.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-950/50">
          <button @click="close" class="px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-gray-800">Cancel</button>
          <button
            @click="doExport"
            :disabled="exporting || !projectId"
            class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ exporting ? 'Exporting...' : 'Export' }}</button>
        </div>
      </div>
    </div>
  `
};
