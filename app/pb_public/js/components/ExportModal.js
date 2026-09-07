// pb_public/js/components/ExportModal.js
// Minimalist Flat-file exporter modal supporting Dark and Light themes.
// Formats: CSV | JSON | ICS (cycle 81, PB-10533) — ICS is an RFC 5545
// calendar feed (issues due dates, cycles, milestones) for calendar clients.

const ExportModalComponent = {
  props: ['isOpen', 'projects', 'currentProject'],
  emits: ['close', 'exported'],
  data() {
    return {
      projectId: '',
      format: 'csv', // 'csv' | 'json' | 'ics'
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
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
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
        const isIcs = this.format === 'ics';
        const mime = isJson ? 'application/json' : (isIcs ? 'text/calendar' : 'text/csv');
        const ext = isJson ? 'json' : (isIcs ? 'ics' : 'csv');
        const blob = new Blob([text], { type: mime });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = base + (isIcs ? '-calendar.' : '-issues.') + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
        const rows = isJson ? null : (isIcs
          ? (text.match(/BEGIN:VEVENT/g) || []).length
          : (text.trim() ? text.trim().split('\n').length - 1 : 0));
        this.result = { count: rows, format: this.format, project: proj.name || '' };
        this.$emit('exported', this.result);
      } catch (err) {
        this.error = 'Export failed: ' + String((err && err.message) || err);
      } finally {
        this.exporting = false;
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" @click.self="close">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="close"></div>

      <div class="relative w-full max-w-lg rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </div>
            <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Export Issues</h2>
          </div>
          <button @click="close" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">
          <!-- Format Tabs -->
          <div class="flex items-center space-x-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit">
            <button
              @click="format='csv'"
              class="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              :class="format==='csv' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >CSV</button>
            <button
              @click="format='json'"
              class="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              :class="format==='json' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >JSON</button>
            <button
              @click="format='ics'"
              class="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              :class="format==='ics' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >ICS</button>
          </div>

          <!-- Source Project -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Source Project</label>
            <select
              v-model="projectId"
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer"
            >
              <option v-for="p in validProjects" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
            </select>
          </div>

          <!-- Info / Result -->
          <div v-if="error" class="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300 text-xs">
            {{ error }}
          </div>
          <div v-if="result" class="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs">
            Exported {{ result.format.toUpperCase() }} for <strong>{{ result.project }}</strong>.
            <template v-if="result.count !== null">{{ result.format === 'ics' ? result.count + ' event(s) included.' : result.count + ' row(s) included.' }}</template>
          </div>

          <p class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Exports mirror the importer columns (title, description, status, priority,
            assignee, dates, estimate, labels, source_key) plus custom fields, so a
            downloaded file can be re-imported into ProjectBase or another tool.
            ICS is an RFC 5545 calendar feed (issue due dates, cycles, milestones)
            you can import or subscribe to from Google Calendar, Apple Calendar,
            or Thunderbird.
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button @click="close" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            @click="doExport"
            :disabled="exporting || !projectId"
            class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >{{ exporting ? 'Exporting...' : 'Export' }}</button>
        </div>
      </div>
    </div>
  `
};
