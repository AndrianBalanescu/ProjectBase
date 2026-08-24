// pb_public/js/components/KanbanBoard.js

const KanbanBoardComponent = {
  props: ['issues', 'projects', 'currentProject', 'cycles', 'labels', 'filterQuery', 'filterPriority', 'filterCycle'],
  emits: ['open-issue', 'create-issue', 'update-issue', 'delete-issue', 'open-shortcuts-modal', 'update:filterQuery', 'update:filterPriority', 'update:filterCycle'],
  data() {
    return {
      columns: [
        { key: 'backlog', name: 'Backlog', color: '#6b7280', icon: 'circle-dot' },
        { key: 'todo', name: 'Todo', color: '#8b5cf6', icon: 'circle' },
        { key: 'in_progress', name: 'In Progress', color: '#3b82f6', icon: 'clock' },
        { key: 'in_review', name: 'In Review', color: '#eab308', icon: 'eye' },
        { key: 'done', name: 'Done', color: '#10b981', icon: 'check-circle-2' },
        { key: 'cancelled', name: 'Cancelled', color: '#ef4444', icon: 'x-circle' }
      ],
      quickAddColumn: null,
      quickAddTitle: '',
      sortables: []
    };
  },
  computed: {
    // Writable proxies over the filter props so the template keeps plain
    // v-model bindings while the state (and the URL query) lives in the root app.
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
      return count;
    },
    filteredIssues() {
      return this.issues.filter(issue => {
        // Text filter
        if (this.filterQuery) {
          const q = this.filterQuery.toLowerCase();
          const matchTitle = (issue.title || '').toLowerCase().includes(q);
          const matchId = (issue.identifier || '').toLowerCase().includes(q);
          const matchDesc = (issue.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchId && !matchDesc) return false;
        }

        // Priority filter
        if (this.filterPriority && issue.priority !== this.filterPriority) {
          return false;
        }

        // Cycle filter
        if (this.filterCycle && issue.cycle !== this.filterCycle) {
          return false;
        }

        return true;
      });
    },
    totalStoryPoints() {
      return this.filteredIssues.reduce((sum, i) => sum + (Number(i.estimate) || 0), 0);
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initSortable();
      if (window.lucide) window.lucide.createIcons();
    });
  },
  updated() {
    this.$nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  beforeUnmount() {
    this.destroySortable();
  },
  methods: {
    clearFilters() {
      this.$emit('update:filterQuery', '');
      this.$emit('update:filterPriority', '');
      this.$emit('update:filterCycle', '');
    },
    getIssuesForColumn(columnKey) {
      return this.filteredIssues
        .filter(i => (i.status || 'backlog') === columnKey)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
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
          animation: 180,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-drag',
          handle: '.kanban-card-drag-handle',
          onEnd: (evt) => {
            const issueId = evt.item.getAttribute('data-issue-id');
            const toColKey = evt.to.getAttribute('data-col-key');
            if (!issueId || !toColKey) return;

            const cardElements = Array.from(evt.to.querySelectorAll('[data-issue-id]'));
            const newIndex = cardElements.indexOf(evt.item);

            let newOrder = Date.now();
            if (cardElements.length > 1) {
              const prevCard = cardElements[newIndex - 1];
              const nextCard = cardElements[newIndex + 1];

              const prevOrder = prevCard ? Number(prevCard.getAttribute('data-order') || 0) : null;
              const nextOrder = nextCard ? Number(nextCard.getAttribute('data-order') || 0) : null;

              if (prevOrder !== null && nextOrder !== null) {
                newOrder = (prevOrder + nextOrder) / 2;
              } else if (prevOrder !== null) {
                newOrder = prevOrder + 1000;
              } else if (nextOrder !== null) {
                newOrder = nextOrder - 1000;
              }
            }

            evt.item.setAttribute('data-order', newOrder);

            this.$emit('update-issue', {
              id: issueId,
              status: toColKey,
              order: newOrder
            });

            if (toColKey === 'done' && window.confetti) {
              window.confetti({
                particleCount: 40,
                spread: 60,
                origin: { y: 0.85 }
              });
            }
          }
        });

        this.sortables.push(sortable);
      });
    },
    destroySortable() {
      this.sortables.forEach(s => s.destroy());
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
      if (!targetProjId) {
        alert('Please create a project first.');
        return;
      }

      await this.$emit('create-issue', {
        project: targetProjId,
        title: this.quickAddTitle.trim(),
        status: colKey,
        priority: 'none'
      });

      this.quickAddTitle = '';
      this.cancelQuickAdd();
    },
    getPriorityIcon(priority) {
      switch (priority) {
        case 'urgent': return { icon: 'alert-octagon', color: 'text-red-500 bg-red-950/40 border-red-800/40' };
        case 'high': return { icon: 'arrow-up', color: 'text-orange-500 bg-orange-950/40 border-orange-800/40' };
        case 'medium': return { icon: 'equal', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' };
        case 'low': return { icon: 'arrow-down', color: 'text-blue-400 bg-blue-950/40 border-blue-800/40' };
        default: return { icon: 'minus', color: 'text-gray-500 bg-gray-900 border-gray-800' };
      }
    },
    formatDueDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (diffDays < 0) {
        return { text: formatted, status: 'overdue' };
      } else if (diffDays === 0) {
        return { text: 'Today', status: 'today' };
      }
      return { text: formatted, status: 'upcoming' };
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
    <div class="h-[calc(100vh-3.5rem)] flex flex-col bg-[#0b0f19] overflow-hidden">
      
      <!-- Top Filter & Search Toolbar -->
      <div class="px-4 py-2.5 border-b border-gray-800/80 bg-gray-950/40 flex items-center justify-between flex-shrink-0 select-none">
        <div class="flex items-center space-x-3">
          <!-- Search input -->
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5"></i>
            <input 
              v-model="searchModel" 
              placeholder="Filter tasks..."
              class="pl-8 pr-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-60"
            />
          </div>

          <!-- Priority Filter -->
          <select 
            v-model="priorityModel"
            class="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            class="px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[160px] truncate"
          >
            <option value="">All Cycles</option>
            <option v-for="c in cycles" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>

          <!-- Clear Filters -->
          <button 
            v-if="activeFilterCount > 0"
            @click="clearFilters"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 flex items-center space-x-1 transition-colors"
          >
            <i data-lucide="x" class="w-3 h-3"></i>
            <span>Clear ({{ activeFilterCount }})</span>
          </button>
        </div>

        <div class="flex items-center space-x-3 text-xs text-gray-400 font-mono">
          <span>{{ filteredIssues.length }} items</span>
          <span v-if="totalStoryPoints > 0" class="text-indigo-400 font-semibold">• {{ totalStoryPoints }} pts</span>
          
          <!-- Shortcuts modal trigger -->
          <button 
            @click="$emit('open-shortcuts-modal')"
            class="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <kbd class="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400 font-mono">?</kbd>
          </button>
        </div>
      </div>

      <!-- Kanban Columns Horizontal Scroll Area -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div class="flex items-start space-x-4 h-full min-w-max pb-2">
          
          <!-- Column Loop -->
          <div 
            v-for="col in columns" 
            :key="col.key"
            class="w-80 flex-shrink-0 flex flex-col max-h-full rounded-xl bg-gray-900/60 border border-gray-800/80 shadow-lg"
          >
            <!-- Column Header -->
            <div class="p-3 border-b border-gray-800/60 flex items-center justify-between select-none">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: col.color }"></span>
                <h3 class="text-xs font-semibold text-gray-200 tracking-wide">{{ col.name }}</h3>
                <span class="px-1.5 py-0.5 rounded-md bg-gray-800 text-[11px] font-mono text-gray-400 font-medium">
                  {{ getIssuesForColumn(col.key).length }}
                </span>
              </div>

              <div class="flex items-center space-x-1.5">
                <span v-if="getColumnEstimateSum(col.key) > 0" class="text-[10px] text-gray-500 font-mono" title="Total Story Points">
                  {{ getColumnEstimateSum(col.key) }} pts
                </span>

                <button 
                  @click="startQuickAdd(col.key)"
                  class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                  title="Add task to column"
                >
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Quick Add Inline Box -->
            <div v-if="quickAddColumn === col.key" class="p-2 border-b border-gray-800/80 bg-gray-950/60">
              <input 
                :id="'quick-add-input-' + col.key"
                v-model="quickAddTitle"
                @keydown.enter="submitQuickAdd(col.key)"
                @keydown.esc="cancelQuickAdd"
                placeholder="What needs to be done? Press Enter..."
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-indigo-500/50 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div class="flex items-center justify-end space-x-1.5 mt-2">
                <button 
                  @click="cancelQuickAdd" 
                  class="px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button 
                  @click="submitQuickAdd(col.key)" 
                  class="px-2.5 py-1 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <!-- Draggable Cards Container -->
            <div 
              :id="'kanban-col-' + col.key"
              :data-col-key="col.key"
              class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]"
            >
              <!-- Card Item -->
              <div 
                v-for="issue in getIssuesForColumn(col.key)" 
                :key="issue.id"
                :data-issue-id="issue.id"
                :data-order="issue.order || 0"
                class="kanban-card-drag-handle group relative bg-gray-950/90 hover:bg-gray-800/70 border border-gray-800/90 hover:border-gray-700/80 rounded-xl p-3 shadow-md hover:shadow-xl transition-all cursor-pointer select-none"
                :class="{ 'border-red-900/70': isBlocked(issue) }"
                @click="$emit('open-issue', issue)"
              >
                <!-- Card Header -->
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <div class="flex items-center space-x-1.5">
                    <span v-if="!currentProject && issue.expand && issue.expand.project" class="text-xs" :title="issue.expand.project.name">
                      {{ issue.expand.project.icon || '📁' }}
                    </span>
                    <span class="font-mono text-[11px] text-gray-400 font-semibold tracking-wider">
                      {{ issue.identifier }}
                    </span>
                  </div>

                  <div class="flex items-center space-x-1.5">
                    <span v-if="issue.estimate" class="px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] font-mono text-gray-400 border border-gray-700/50">
                      {{ issue.estimate }}
                    </span>

                    <span 
                      class="p-1 rounded border flex items-center justify-center"
                      :class="getPriorityIcon(issue.priority).color"
                      :title="'Priority: ' + issue.priority"
                    >
                      <i :data-lucide="getPriorityIcon(issue.priority).icon" class="w-3 h-3"></i>
                    </span>

                    <span
                      v-if="isBlocked(issue)"
                      class="p-1 rounded border flex items-center justify-center bg-red-950/60 border-red-900/70 text-red-400"
                      title="Blocked by another issue"
                    >
                      <i data-lucide="lock" class="w-3 h-3"></i>
                    </span>
                  </div>
                </div>

                <!-- Card Title -->
                <h4 class="text-xs font-medium text-gray-100 group-hover:text-indigo-200 transition-colors line-clamp-2 leading-snug">
                  {{ issue.title }}
                </h4>

                <!-- Subtasks Progress Bar -->
                <div v-if="getSubtaskProgress(issue)" class="mt-2.5 pt-2 border-t border-gray-800/60">
                  <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-1">
                    <span class="flex items-center space-x-1">
                      <i data-lucide="check-square" class="w-2.5 h-2.5"></i>
                      <span>Subtasks</span>
                    </span>
                    <span>{{ getSubtaskProgress(issue).completed }}/{{ getSubtaskProgress(issue).total }}</span>
                  </div>
                  <div class="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                    <div 
                      class="bg-indigo-500 h-1 rounded-full transition-all" 
                      :style="{ width: getSubtaskProgress(issue).percent + '%' }"
                    ></div>
                  </div>
                </div>

                <!-- Card Footer -->
                <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-800/40 text-[11px]">
                  <div class="flex items-center space-x-1 overflow-hidden max-w-[140px]">
                    <span 
                      v-for="lbl in (issue.labels || []).slice(0, 2)" 
                      :key="lbl"
                      class="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[10px] truncate"
                    >
                      {{ lbl }}
                    </span>
                    <span v-if="(issue.labels || []).length > 2" class="text-[10px] text-gray-500 font-mono">
                      +{{ issue.labels.length - 2 }}
                    </span>
                  </div>

                  <div class="flex items-center space-x-2 ml-auto">
                    <span 
                      v-if="formatDueDate(issue.due_date)" 
                      class="flex items-center space-x-1 text-[10px] font-medium"
                      :class="{
                        'text-red-400': formatDueDate(issue.due_date).status === 'overdue',
                        'text-amber-400': formatDueDate(issue.due_date).status === 'today',
                        'text-gray-400': formatDueDate(issue.due_date).status === 'upcoming'
                      }"
                    >
                      <i data-lucide="calendar" class="w-2.5 h-2.5"></i>
                      <span>{{ formatDueDate(issue.due_date).text }}</span>
                    </span>

                    <div 
                      v-if="issue.assignee" 
                      class="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      :title="'Assignee: ' + issue.assignee"
                    >
                      {{ issue.assignee.charAt(0).toUpperCase() }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty Column State -->
              <div 
                v-if="getIssuesForColumn(col.key).length === 0" 
                class="h-24 flex flex-col items-center justify-center text-gray-600 border border-dashed border-gray-800/60 rounded-xl select-none"
              >
                <i :data-lucide="col.icon" class="w-4 h-4 mb-1 opacity-40"></i>
                <span class="text-[11px]">No items</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
};
