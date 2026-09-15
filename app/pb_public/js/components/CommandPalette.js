// pb_public/js/components/CommandPalette.js
// Minimalist, high-density Command Palette supporting Dark and Light themes.

const CommandPaletteComponent = {
  props: ['isOpen', 'issues', 'projects'],
  emits: ['close', 'select-issue', 'select-global-issue', 'select-project', 'change-view', 'open-new-issue', 'open-import', 'open-export', 'open-welcome', 'open-shortcuts'],
  data() {
    return {
      query: '',
      selectedIndex: 0,
      globalResults: [],
      globalLoading: false,
      globalError: '',
      _searchTimer: null
    };
  },
  computed: {
    results() {
      const q = this.query.toLowerCase().trim();
      const items = [];

      // Action Commands
      const actions = [
        { type: 'action', id: 'act_new', title: 'Create New Issue', subtitle: 'Shortcut: C', action: () => this.$emit('open-new-issue'), icon: 'plus-circle' },
        { type: 'action', id: 'act_import', title: 'Import Issues (CSV or GitHub)', subtitle: 'Shortcut: I · migrate from Linear or GitHub', action: () => this.$emit('open-import'), icon: 'upload' },
        { type: 'action', id: 'act_export', title: 'Export Issues (CSV or JSON)', subtitle: 'Shortcut: E · back up or migrate your issues', action: () => this.$emit('open-export'), icon: 'download' },
        { type: 'action', id: 'act_board', title: 'Switch to Board View', subtitle: 'View Kanban Board', action: () => this.$emit('change-view', 'board'), icon: 'kanban' },
        { type: 'action', id: 'act_list', title: 'Switch to List View', subtitle: 'View tabular task list', action: () => this.$emit('change-view', 'list'), icon: 'list-todo' },
        { type: 'action', id: 'act_cycles', title: 'Switch to Cycles View', subtitle: 'View Sprints & Velocity', action: () => this.$emit('change-view', 'cycles'), icon: 'refresh-cw' },
        { type: 'action', id: 'act_timeline', title: 'Open Timeline', subtitle: 'Gantt schedule of cycles, milestones and issues', action: () => this.$emit('change-view', 'timeline'), icon: 'calendar' },
        { type: 'action', id: 'act_milestones', title: 'Open Roadmap', subtitle: 'View milestones and outcomes', action: () => this.$emit('change-view', 'milestones'), icon: 'flag' },
        { type: 'action', id: 'act_projects', title: 'Switch to Projects View', subtitle: 'All projects and portfolios', action: () => this.$emit('change-view', 'projects'), icon: 'folder-kanban' },
        { type: 'action', id: 'act_agents', title: 'Open Sessions', subtitle: 'Live execution runs', action: () => this.$emit('change-view', 'agents'), icon: 'activity' },
        { type: 'action', id: 'act_welcome', title: 'Open Welcome Guide', subtitle: 'Get started checklist', action: () => this.$emit('open-welcome'), icon: 'help-circle' },
        { type: 'action', id: 'act_shortcuts', title: 'Keyboard Shortcuts', subtitle: 'Shortcut: ? · all key bindings', action: () => this.$emit('open-shortcuts'), icon: 'keyboard' }
      ];

      actions.forEach(a => {
        if (!q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) {
          items.push(a);
        }
      });

      // Projects
      (this.projects || []).forEach(p => {
        if (!q || p.name.toLowerCase().includes(q) || p.identifier.toLowerCase().includes(q)) {
          items.push({
            type: 'project',
            id: 'proj_' + p.id,
            title: p.name,
            subtitle: `Project [${p.identifier}]`,
            icon: 'folder',
            action: () => this.$emit('select-project', p)
          });
        }
      });

      // Issues (scoped to current view)
      (this.issues || []).forEach(i => {
        if (!q || (i.title && i.title.toLowerCase().includes(q)) || (i.identifier && i.identifier.toLowerCase().includes(q))) {
          items.push({
            type: 'issue',
            id: 'iss_' + i.id,
            title: i.title,
            subtitle: `${i.identifier || 'Issue'} · ${i.status} · ${i.priority}`,
            icon: 'check-square',
            action: () => this.$emit('select-issue', i)
          });
        }
      });

      // Cross-project Global Search Results
      if (q && Array.isArray(this.globalResults) && this.globalResults.length > 0) {
        const localIssueIds = new Set((this.issues || []).map(x => x.id));
        this.globalResults.forEach(r => {
          if (localIssueIds.has(r.id)) return;
          const projTag = r.project_identifier ? `[${r.project_identifier}] ` : '';
          items.push({
            type: 'global-issue',
            id: 'global_' + r.id,
            title: `${r.identifier || 'PB'}: ${r.title}`,
            subtitle: `${projTag}${r.project_name || 'Other project'} · ${r.status || 'todo'} · ${r.priority || 'medium'}`,
            icon: 'search',
            action: () => this.$emit('select-global-issue', r)
          });
        });
      }

      return items;
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.query = '';
        this.selectedIndex = 0;
        this.globalResults = [];
        this.globalLoading = false;
        this.globalError = '';
        this.$nextTick(() => {
          const inp = this.$refs.searchInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    },
    query(newVal) {
      this.selectedIndex = 0;
      this.scheduleGlobalSearch(newVal);
    },
    results() {
      this.selectedIndex = 0;
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    }
  },
  methods: {
    scheduleGlobalSearch(raw) {
      const q = (raw || '').trim();
      if (this._searchTimer) { clearTimeout(this._searchTimer); this._searchTimer = null; }
      this._searchTimer = setTimeout(() => this.runGlobalSearch(q), 250);
    },
    async runGlobalSearch(q) {
      this._searchTimer = null;
      if (!q || (typeof API === 'undefined' || !API.searchIssues)) {
        this.globalResults = [];
        this.globalLoading = false;
        return;
      }
      this.globalLoading = true;
      this.globalError = '';
      try {
        const data = await API.searchIssues(q, 30);
        this.globalResults = (data && data.results) || [];
      } catch (err) {
        this.globalError = (err && err.message) || 'Search failed';
        this.globalResults = [];
      } finally {
        this.globalLoading = false;
      }
    },
    handleKey(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % (this.results.length || 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % (this.results.length || 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.results[this.selectedIndex]) {
          this.results[this.selectedIndex].action();
          this.$emit('close');
        }
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center items-start select-none">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <!-- Modal Card -->
      <div class="relative w-full max-w-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">

        <!-- Search Input Header -->
        <div class="flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60">
          <i data-lucide="search" class="w-4 h-4 text-zinc-400 mr-3 shrink-0"></i>
          <input
            ref="searchInput"
            v-model="query"
            @keydown="handleKey"
            placeholder="Type a command, project, or issue name..."
            class="w-full py-3 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-mono border border-zinc-200 dark:border-zinc-700 shrink-0">ESC</kbd>
        </div>

        <!-- Results List -->
        <div class="max-h-96 overflow-y-auto p-1.5 space-y-0.5">
          <div
            v-for="(item, idx) in results"
            :key="item.id"
            @click="item.action(); $emit('close');"
            @mouseenter="selectedIndex = idx"
            class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors"
            :class="selectedIndex === idx ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'"
          >
            <div class="flex items-center space-x-2.5 min-w-0">
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border"
                :class="selectedIndex === idx ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/60'"
              >
                <i :data-lucide="item.icon" class="w-3.5 h-3.5"></i>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-medium truncate">{{ item.title }}</div>
                <div class="text-[10px] text-zinc-400 truncate">{{ item.subtitle }}</div>
              </div>
            </div>

            <div class="flex items-center space-x-1.5 text-xs text-zinc-400 shrink-0 ml-2">
              <span class="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60">{{ item.type }}</span>
            </div>
          </div>

          <div v-if="results.length === 0" class="py-8 text-center text-zinc-400 text-xs">
            No matching actions, projects, or issues found.
          </div>
        </div>

        <!-- Footer Help -->
        <div class="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between text-[10px] text-zinc-400 select-none">
          <div class="flex items-center space-x-3">
            <span><kbd class="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700">↑↓</kbd> navigate</span>
            <span><kbd class="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700">↵</kbd> select</span>
          </div>
          <span>ProjectBase Command</span>
        </div>

      </div>
    </div>
  `
};
