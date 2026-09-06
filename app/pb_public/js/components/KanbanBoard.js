// pb_public/js/components/KanbanBoard.js
// Minimalist, high-density Kanban Board supporting Dark/Light themes, dual Task & Live Agent Session cards.

const KanbanBoardComponent = {
  props: ['issues', 'projects', 'currentProject', 'cycles', 'labels', 'filterQuery', 'filterPriority', 'filterCycle', 'selectedIssueIds', 'agents', 'sessions'],
  emits: ['open-issue', 'create-issue', 'update-issue', 'delete-issue', 'open-shortcuts-modal', 'toggle-issue-selection', 'range-select-issue', 'update:filterQuery', 'update:filterPriority', 'update:filterCycle', 'open-session', 'change-view'],
  data() {
    return {
      boardMode: 'all', // 'all' | 'issues' | 'sessions'
      agentFilter: '',
      columns: [
        { key: 'backlog', name: 'Backlog', color: '#71717a', icon: 'circle-dot' },
        { key: 'todo', name: 'Todo', color: '#a1a1aa', icon: 'circle' },
        { key: 'in_progress', name: 'In Progress', color: '#3b82f6', icon: 'clock' },
        { key: 'in_review', name: 'In Review', color: '#f59e0b', icon: 'eye' },
        { key: 'done', name: 'Done', color: '#10b981', icon: 'check-circle-2' },
        { key: 'cancelled', name: 'Cancelled', color: '#ef4444', icon: 'x-circle' }
      ],
      quickAddColumn: null,
      quickAddTitle: '',
      sortables: []
    };
  },
  computed: {
    searchModel: {
      get() { return this.filterQuery; },
      set(v) { this.$emit('update:filterQuery', v); }
    },
    priorityModel: {
      get() { return this.filterPriority; },
      set(v) { this.$emit('update:filterPriority', v); }
    },
    cycleModel: {
      get() { return this.filterCycle; },
      set(v) { this.$emit('update:filterCycle', v); }
    },
    activeFilterCount() {
      let count = 0;
      if (this.filterQuery) count++;
      if (this.filterPriority) count++;
      if (this.filterCycle) count++;
      if (this.agentFilter) count++;
      return count;
    },
    filteredIssues() {
      if (this.boardMode === 'sessions') return [];
      return (this.issues || []).filter(issue => {
        if (this.filterQuery) {
          const q = this.filterQuery.toLowerCase();
          const matchTitle = (issue.title || '').toLowerCase().includes(q);
          const matchId = (issue.identifier || '').toLowerCase().includes(q);
          const matchDesc = (issue.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchId && !matchDesc) return false;
        }
        if (this.filterPriority && issue.priority !== this.filterPriority) return false;
        if (this.filterCycle && issue.cycle !== this.filterCycle) return false;
        if (this.agentFilter && !(issue.assignee || '').toLowerCase().includes(this.agentFilter.toLowerCase())) return false;
        return true;
      });
    },
    totalSessionsCount() {
      return (this.sessions || []).length;
    },
    liveSessionsCount() {
      return (this.sessions || []).filter(s => s.status === 'running' || s.is_active).length;
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initSortable();
    });
  },
  updated() {
    this.$nextTick(() => {
      this.initSortable();
    });
  },
  beforeUnmount() {
    this.destroySortable();
  },
  methods: {
    clearFilters() {
      this.searchModel = '';
      this.priorityModel = '';
      this.cycleModel = '';
      this.agentFilter = '';
    },
    findAgent(name) {
      if (!name || !this.agents) return null;
      const clean = name.toLowerCase().trim();
      return this.agents.find(a => a.name.toLowerCase() === clean);
    },
    agentAvatar(name) {
      const a = this.findAgent(name);
      return a ? a.avatar : null;
    },
    fmtTokens(n) {
      if (!n) return '0';
      if (n < 1000) return String(n);
      if (n < 1000000) return (n / 1000).toFixed(1) + 'k';
      return (n / 1000000).toFixed(1) + 'M';
    },
    isSelected(issue) {
      return !!(this.selectedIssueIds && this.selectedIssueIds.has(issue.id));
    },
    toggleSelect(issue) {
      this.$emit('toggle-issue-selection', issue);
    },
    handleCardClick(event, issue) {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        this.$emit('range-select-issue', this.boardOrderedIssues(), issue);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleSelect(issue);
        return;
      }
      this.$emit('open-issue', issue);
    },
    handleSessionClick(session) {
      this.$emit('open-session', session);
    },
    boardOrderedIssues() {
      const seen = [];
      for (const col of this.columns) {
        for (const issue of this.getIssuesForColumn(col.key)) {
          seen.push(issue);
        }
      }
      return seen;
    },
    getIssuesForColumn(columnKey) {
      if (this.boardMode === 'sessions') return [];
      return this.filteredIssues
        .filter(i => (i.status || 'backlog') === columnKey)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    getSessionsForColumn(columnKey) {
      if (this.boardMode === 'issues') return [];
      const list = this.sessions || [];
      return list.filter(s => {
        let col = 'backlog';
        if (s.status === 'running' || s.status === 'spawning' || s.is_active) col = 'in_progress';
        else if (s.status === 'completed') col = 'done';
        else if (s.status === 'failed' || s.status === 'cancelled') col = 'cancelled';
        else if (s.status === 'idle') col = 'todo';
        if (col !== columnKey) return false;

        if (this.filterQuery) {
          const q = this.filterQuery.toLowerCase();
          const matchTitle = (s.title || '').toLowerCase().includes(q);
          const matchPrompt = (s.last_prompt || '').toLowerCase().includes(q);
          const matchAgent = (s.agent_name || s.short_name || '').toLowerCase().includes(q);
          const matchDir = (s.working_dir || '').toLowerCase().includes(q);
          if (!matchTitle && !matchPrompt && !matchAgent && !matchDir) return false;
        }
        return true;
      });
    },
    getColumnTotalCount(columnKey) {
      return this.getIssuesForColumn(columnKey).length + this.getSessionsForColumn(columnKey).length;
    },
    getColumnEstimateSum(columnKey) {
      return this.getIssuesForColumn(columnKey)
        .reduce((sum, i) => sum + (Number(i.estimate) || 0), 0);
    },
    initSortable() {
      this.destroySortable();
      this.columns.forEach(col => {
        const el = document.getElementById('kanban-col-' + col.key);
        if (!el) return;

        const sortable = new Sortable(el, {
          group: 'kanban-board',
          animation: 150,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-drag',
          handle: '.kanban-card-drag-handle',
          onEnd: (evt) => {
            const itemEl = evt.item;
            const issueId = itemEl.getAttribute('data-issue-id');
            const toColKey = evt.to.getAttribute('data-col-key');
            const newIndex = evt.newIndex;

            if (!issueId || !toColKey) return;

            const targetIssues = this.getIssuesForColumn(toColKey)
              .filter(i => i.id !== issueId);

            let newOrder = 0;
            if (targetIssues.length === 0) {
              newOrder = 0;
            } else if (newIndex === 0) {
              newOrder = (targetIssues[0].order || 0) - 1000;
            } else if (newIndex >= targetIssues.length) {
              newOrder = (targetIssues[targetIssues.length - 1].order || 0) + 1000;
            } else {
              const prevOrder = targetIssues[newIndex - 1].order || 0;
              const nextOrder = targetIssues[newIndex].order || 0;
              newOrder = Math.round((prevOrder + nextOrder) / 2);
            }

            const currentIssue = (this.issues || []).find(i => i.id === issueId);
            if (currentIssue) {
              const statusChanged = currentIssue.status !== toColKey;
              if (statusChanged && toColKey === 'done' && window.confetti) {
                window.confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
              }

              this.$emit('update-issue', {
                id: issueId,
                status: toColKey,
                order: newOrder
              });
            }
          }
        });

        this.sortables.push(sortable);
      });
    },
    destroySortable() {
      this.sortables.forEach((s) => { s.destroy(); });
      this.sortables = [];
    },
    startQuickAdd(colKey) {
      this.quickAddColumn = colKey;
      this.quickAddTitle = '';
      this.$nextTick(() => {
        const input = document.getElementById('quick-add-input-' + colKey);
        if (input) input.focus();
      });
    },
    cancelQuickAdd() {
      this.quickAddColumn = null;
      this.quickAddTitle = '';
    },
    async submitQuickAdd(colKey) {
      if (!this.quickAddTitle.trim()) {
        this.cancelQuickAdd();
        return;
      }
      const targetProjId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : null);
      this.$emit('create-issue', {
        title: this.quickAddTitle.trim(),
        status: colKey,
        project: targetProjId,
        priority: 'none'
      });
      this.cancelQuickAdd();
    },
    getPriorityIcon(priority) {
      switch (priority) {
        case 'urgent': return { icon: 'alert-circle', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40' };
        case 'high': return { icon: 'arrow-up', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' };
        case 'medium': return { icon: 'equal', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' };
        case 'low': return { icon: 'arrow-down', color: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' };
        default: return { icon: 'minus', color: 'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' };
      }
    },
    formatDueDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, status: 'overdue' };
      if (diffDays === 0) return { text: 'Today', status: 'today' };
      if (diffDays === 1) return { text: 'Tomorrow', status: 'upcoming' };
      return { text: `${diffDays}d left`, status: 'upcoming' };
    },
    isBlocked(issue) {
      if (!issue || !Array.isArray(issue.relations)) return false;
      return issue.relations.some(r => r && r.type === 'blocked_by');
    },
    getSubtaskProgress(issue) {
      if (!issue.subtasks || !Array.isArray(issue.subtasks) || issue.subtasks.length === 0) return null;
      const total = issue.subtasks.length;
      const completed = issue.subtasks.filter(s => s.done).length;
      return { completed, total, percent: Math.round((completed / total) * 100) };
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] flex flex-col bg-slate-50 dark:bg-[#09090b] overflow-hidden select-none">

      <!-- Top Filter & Search Toolbar (Minimalist Strip) -->
      <div class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#121215]/95 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div class="flex items-center space-x-2 flex-wrap gap-1">
          <!-- Search input -->
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-2 pointer-events-none z-10"></i>
            <input
              v-model="searchModel"
              placeholder="Filter tasks..."
              class="pl-7 pr-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 w-44 sm:w-56 relative z-20"
            />
          </div>

          <!-- Board Display Mode Toggle (Session-as-a-Card) -->
          <div class="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              @click="boardMode = 'all'"
              class="px-2 py-0.5 rounded-md font-medium transition-colors"
              :class="boardMode === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >
              All ({{ (issues || []).length + totalSessionsCount }})
            </button>
            <button
              @click="boardMode = 'issues'"
              class="px-2 py-0.5 rounded-md font-medium transition-colors"
              :class="boardMode === 'issues' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >
              📋 Tasks ({{ (issues || []).length }})
            </button>
            <button
              @click="boardMode = 'sessions'"
              class="px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1"
              :class="boardMode === 'sessions' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >
              <span>🤖 Agent Sessions</span>
              <span v-if="liveSessionsCount > 0" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-mono text-[10px]">({{ totalSessionsCount }})</span>
            </button>
          </div>

          <!-- Priority Filter -->
          <select
            v-model="priorityModel"
            class="px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          >
            <option value="">All Priorities</option>
            <option value="urgent">🔥 Urgent</option>
            <option value="high">🔺 High</option>
            <option value="medium">🔸 Medium</option>
            <option value="low">🔹 Low</option>
            <option value="none">⚪ None</option>
          </select>

          <!-- Cycle Filter -->
          <select
            v-if="cycles && cycles.length > 0"
            v-model="cycleModel"
            class="px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          >
            <option value="">All Cycles</option>
            <option v-for="c in cycles" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>

          <!-- Clear Filters -->
          <button
            v-if="activeFilterCount > 0"
            @click="clearFilters"
            class="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
          >
            <i data-lucide="x" class="w-3 h-3"></i>
            <span>Clear ({{ activeFilterCount }})</span>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Keyboard shortcut hint -->
          <button
            @click="$emit('open-shortcuts-modal')"
            class="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs"
            title="Keyboard shortcuts (?)"
          >
            <kbd class="font-mono text-[10px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">?</kbd>
          </button>
        </div>
      </div>

      <!-- Main Board Columns Container -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-3 flex space-x-3">

        <!-- Column Loop -->
        <div
          v-for="col in columns"
          :key="col.key"
          class="w-72 sm:w-80 flex-shrink-0 flex flex-col bg-zinc-100/60 dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-2xs"
        >
          <!-- Column Header -->
          <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-white/70 dark:bg-zinc-900/50">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: col.color }"></span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight">{{ col.name }}</span>
              <span class="px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                {{ getColumnTotalCount(col.key) }}
              </span>
            </div>

            <div class="flex items-center space-x-1">
              <span v-if="getColumnEstimateSum(col.key) > 0" class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mr-1" title="Total Story Points">
                {{ getColumnEstimateSum(col.key) }} pts
              </span>

              <button
                @click="startQuickAdd(col.key)"
                class="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Quick add task"
              >
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- Inline Quick Add Input -->
          <div v-if="quickAddColumn === col.key" class="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <input
              :id="'quick-add-input-' + col.key"
              v-model="quickAddTitle"
              @keydown.enter="submitQuickAdd(col.key)"
              @keydown.esc="cancelQuickAdd"
              placeholder="What needs to be done?"
              class="w-full px-2.5 py-1.5 text-xs rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
            <div class="flex items-center justify-end space-x-1.5 mt-1.5">
              <button
                @click="cancelQuickAdd"
                class="px-2 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded"
              >Cancel</button>
              <button
                @click="submitQuickAdd(col.key)"
                class="px-2.5 py-0.5 text-[11px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded font-medium"
              >Add</button>
            </div>
          </div>

          <!-- Draggable Cards Container -->
          <div
            :id="'kanban-col-' + col.key"
            :data-col-key="col.key"
            class="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-[100px]"
          >
            <!-- 1. LIVE AGENT SESSION CARDS (Session-as-a-Card) -->
            <div
              v-for="session in getSessionsForColumn(col.key)"
              :key="'sess-' + session.id"
              @click="handleSessionClick(session)"
              class="relative bg-gradient-to-br from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 hover:from-indigo-100/80 hover:to-purple-100/60 dark:hover:from-indigo-950/50 dark:hover:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-lg p-2.5 shadow-2xs transition-all cursor-pointer select-none group"
            >
              <!-- Session Header -->
              <div class="flex items-center justify-between text-xs mb-1">
                <div class="flex items-center space-x-1.5 min-w-0">
                  <span class="text-sm shrink-0">{{ session.avatar || '🧠' }}</span>
                  <span class="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 truncate">
                    {{ session.agent_name || session.short_name || 'Agent Run' }}
                  </span>
                </div>

                <div class="flex items-center space-x-1">
                  <!-- Live Running Pulse Badge -->
                  <span
                    v-if="session.status === 'running' || session.is_active"
                    class="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold flex items-center gap-1"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    LIVE RUN
                  </span>
                  <span
                    v-else-if="session.status === 'completed'"
                    class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-mono font-semibold"
                  >
                    ✓ DONE
                  </span>
                  <span
                    v-else-if="session.status === 'failed'"
                    class="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 text-[9px] font-mono font-semibold"
                  >
                    ✕ FAILED
                  </span>
                </div>
              </div>

              <!-- Session Title / Prompt Goal -->
              <div class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 mb-1.5">
                {{ session.title || session.last_prompt || ('Autonomous Session ' + session.session_id) }}
              </div>

              <!-- Session Telemetry Footer -->
              <div class="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/40 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                <div class="flex items-center space-x-1 truncate max-w-[170px]" :title="session.working_dir">
                  <span>📁</span>
                  <span class="truncate">{{ session.working_dir ? session.working_dir.split('/').slice(-2).join('/') : 'workspace' }}</span>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                  <span v-if="session.git_commit" class="px-1 rounded bg-white/60 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    🌿 {{ session.git_commit.slice(0, 7) }}
                  </span>
                  <span v-if="session.tokens">
                    ⚡ {{ fmtTokens(session.tokens) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 2. REGULAR ISSUE TASK CARDS -->
            <div
              v-for="issue in getIssuesForColumn(col.key)"
              :key="issue.id"
              :data-issue-id="issue.id"
              :data-order="issue.order || 0"
              class="kanban-card-drag-handle group relative bg-white hover:bg-zinc-50/90 dark:bg-[#18181b] dark:hover:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/60 rounded-lg p-2.5 shadow-2xs transition-all cursor-pointer select-none"
              :class="{ 'border-red-400 dark:border-red-800/70': isBlocked(issue), 'ring-2 ring-zinc-500/80 border-zinc-500 bg-zinc-100/90 dark:bg-zinc-800': isSelected(issue) }"
              @click="handleCardClick($event, issue)"
            >
              <!-- Card Header -->
              <div class="flex items-center justify-between text-xs mb-1">
                <div class="flex items-center space-x-1.5 min-w-0">
                  <!-- Multi-select checkbox -->
                  <button
                    type="button"
                    class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0"
                    :class="isSelected(issue) ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-transparent hover:border-zinc-400 dark:hover:border-zinc-400'"
                    @click.stop="toggleSelect(issue)"
                    :title="isSelected(issue) ? 'Deselect (Esc)' : 'Select for bulk actions'"
                  >
                    <i data-lucide="check" class="w-2.5 h-2.5 stroke-[3]"></i>
                  </button>

                  <span class="font-mono text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold truncate">{{ issue.identifier }}</span>
                </div>

                <div class="flex items-center space-x-1">
                  <!-- Blocked Badge -->
                  <span
                    v-if="isBlocked(issue)"
                    class="px-1 py-0.5 rounded border text-[9px] font-semibold bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 shrink-0 flex items-center gap-0.5"
                    title="Blocked by another issue"
                  >
                    <i data-lucide="lock" class="w-2.5 h-2.5 inline-block"></i>
                    Blocked
                  </span>

                  <!-- Estimate Points Pill -->
                  <span
                    v-if="issue.estimate"
                    class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-600 dark:text-zinc-400"
                    title="Story Points"
                  >
                    {{ issue.estimate }}
                  </span>

                  <!-- Priority Icon -->
                  <div
                    v-if="issue.priority && issue.priority !== 'none'"
                    class="p-0.5 rounded border flex items-center justify-center"
                    :class="getPriorityIcon(issue.priority).color"
                    :title="'Priority: ' + issue.priority"
                  >
                    <i :data-lucide="getPriorityIcon(issue.priority).icon" class="w-2.5 h-2.5"></i>
                  </div>
                </div>
              </div>

              <!-- Card Title -->
              <div class="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 mb-1.5 group-hover:text-zinc-950 dark:group-hover:text-white">
                {{ issue.title }}
              </div>

              <!-- Subtasks Progress Bar -->
              <div v-if="getSubtaskProgress(issue)" class="mb-1.5 space-y-0.5">
                <div class="flex items-center justify-between text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                  <span>{{ getSubtaskProgress(issue).completed }}/{{ getSubtaskProgress(issue).total }} subtasks</span>
                  <span>{{ getSubtaskProgress(issue).percent }}%</span>
                </div>
                <div class="w-full h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    class="h-full bg-zinc-700 dark:bg-zinc-300 rounded-full transition-all"
                    :style="{ width: getSubtaskProgress(issue).percent + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Card Footer (Labels, Due Date, Assignee) -->
              <div class="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                <!-- Labels & Git -->
                <div class="flex items-center space-x-1 overflow-hidden max-w-[140px]">
                  <span
                    v-if="issue.pr_url || issue.git_branch"
                    class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 text-[9px] font-mono flex items-center gap-0.5 truncate max-w-[70px]"
                    :title="issue.pr_url || issue.git_branch"
                  >
                    <span>{{ issue.pr_url ? '🔀' : '🌿' }}</span>
                    <span class="truncate">{{ issue.pr_status || (issue.git_branch ? issue.git_branch.split('/')[issue.git_branch.split('/').length - 1] : '') }}</span>
                  </span>
                  <span
                    v-for="lbl in (issue.labels || []).slice(0, 2)"
                    :key="lbl"
                    class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 text-[9px] truncate max-w-[60px]"
                  >{{ lbl }}</span>
                </div>

                <!-- Right Meta (Due date & Assignee) -->
                <div class="flex items-center space-x-1.5">
                  <span
                    v-if="formatDueDate(issue.due_date)"
                    class="text-[10px] font-mono"
                    :class="{
                      'text-rose-600 dark:text-rose-400 font-semibold': formatDueDate(issue.due_date).status === 'overdue',
                      'text-amber-600 dark:text-amber-400': formatDueDate(issue.due_date).status === 'today',
                      'text-zinc-400 dark:text-zinc-500': formatDueDate(issue.due_date).status === 'upcoming'
                    }"
                    :title="'Due: ' + issue.due_date"
                  >
                    {{ formatDueDate(issue.due_date).text }}
                  </span>

                  <!-- Assignee Avatar -->
                  <div
                    v-if="issue.assignee"
                    class="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-700 dark:text-zinc-300"
                    :title="'Assigned to: ' + issue.assignee"
                  >
                    <span>{{ agentAvatar(issue.assignee) || issue.assignee.charAt(0).toUpperCase() }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty column state -->
            <div
              v-if="getColumnTotalCount(col.key) === 0 && quickAddColumn !== col.key"
              class="h-24 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-xs italic"
            >
              No items
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

window.KanbanBoardComponent = KanbanBoardComponent;
