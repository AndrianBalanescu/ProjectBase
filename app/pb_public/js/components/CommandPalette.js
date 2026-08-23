// pb_public/js/components/CommandPalette.js

const CommandPaletteComponent = {
  props: ['isOpen', 'issues', 'projects'],
  emits: ['close', 'select-issue', 'select-project', 'change-view', 'open-new-issue', 'open-import'],
  data() {
    return {
      query: '',
      selectedIndex: 0
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
        { type: 'action', id: 'act_board', title: 'Switch to Board View', subtitle: 'View Kanban Board', action: () => this.$emit('change-view', 'board'), icon: 'kanban' },
        { type: 'action', id: 'act_list', title: 'Switch to List View', subtitle: 'View tabular task list', action: () => this.$emit('change-view', 'list'), icon: 'list-todo' },
        { type: 'action', id: 'act_cycles', title: 'Switch to Cycles View', subtitle: 'View Sprints & Velocity', action: () => this.$emit('change-view', 'cycles'), icon: 'refresh-cw' },
        { type: 'action', id: 'act_stats', title: 'View Analytics & Activity', subtitle: 'System statistics', action: () => this.$emit('change-view', 'stats'), icon: 'bar-chart-2' }
      ];

      for (const act of actions) {
        if (!q || act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
          items.push(act);
        }
      }

      // Projects
      for (const p of this.projects) {
        if (!q || p.name.toLowerCase().includes(q) || p.identifier.toLowerCase().includes(q)) {
          items.push({
            type: 'project',
            id: p.id,
            title: p.name,
            subtitle: `Project [${p.identifier}]`,
            icon: 'folder',
            data: p,
            action: () => this.$emit('select-project', p)
          });
        }
      }

      // Issues
      for (const issue of this.issues) {
        if (!q || issue.title.toLowerCase().includes(q) || (issue.identifier || '').toLowerCase().includes(q)) {
          items.push({
            type: 'issue',
            id: issue.id,
            title: issue.title,
            subtitle: `${issue.identifier} • ${issue.status} • ${issue.priority}`,
            icon: 'check-square',
            data: issue,
            action: () => this.$emit('select-issue', issue)
          });
        }
      }

      return items.slice(0, 20);
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.query = '';
        this.selectedIndex = 0;
        this.$nextTick(() => {
          const inp = this.$refs.searchInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    },
    results() {
      this.selectedIndex = 0;
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    }
  },
  methods: {
    handleKey(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.results[this.selectedIndex]) {
          this.results[this.selectedIndex].action();
          this.$emit('close');
        }
      } else if (e.key === 'Escape') {
        this.$emit('close');
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center items-start">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <!-- Omnibar Box -->
      <div class="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Search Input Header -->
        <div class="flex items-center px-4 border-b border-gray-800 bg-gray-950/60">
          <i data-lucide="search" class="w-5 h-5 text-gray-400 mr-3"></i>
          <input 
            ref="searchInput"
            v-model="query"
            @keydown="handleKey"
            placeholder="Type a command, project, or issue name..."
            class="w-full py-3.5 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <kbd class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 font-mono border border-gray-700">ESC</kbd>
        </div>

        <!-- Results List -->
        <div class="max-h-96 overflow-y-auto p-2 space-y-1">
          <div 
            v-for="(item, idx) in results" 
            :key="item.id"
            @click="item.action(); $emit('close');"
            @mouseenter="selectedIndex = idx"
            class="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors"
            :class="selectedIndex === idx ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'text-gray-300 hover:bg-gray-800/60 border border-transparent'"
          >
            <div class="flex items-center space-x-3 min-w-0">
              <div 
                class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                :class="selectedIndex === idx ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'"
              >
                <i :data-lucide="item.icon" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ item.title }}</div>
                <div class="text-[10px] text-gray-400 truncate">{{ item.subtitle }}</div>
              </div>
            </div>

            <div class="flex items-center space-x-1.5 text-xs text-gray-500 flex-shrink-0">
              <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-800/80">{{ item.type }}</span>
            </div>
          </div>

          <div v-if="results.length === 0" class="py-10 text-center text-gray-500 text-xs">
            No matching actions, projects, or issues found.
          </div>
        </div>

        <!-- Footer Help -->
        <div class="px-4 py-2 border-t border-gray-800/80 bg-gray-950/60 flex items-center justify-between text-[11px] text-gray-500 select-none">
          <div class="flex items-center space-x-3">
            <span><kbd class="text-[10px] font-mono bg-gray-800 px-1 rounded">↑↓</kbd> to navigate</span>
            <span><kbd class="text-[10px] font-mono bg-gray-800 px-1 rounded">↵</kbd> to select</span>
          </div>
          <span>ProjectBase Fast Command</span>
        </div>

      </div>
    </div>
  `
};
