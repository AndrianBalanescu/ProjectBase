// pb_public/js/components/ListView.js
// Minimalist, high-density List View supporting Dark and Light themes with subtle, low-contrast accents.

const ListViewComponent = {
  props: ['issues', 'projects', 'currentProject', 'cycles', 'labels', 'filterQuery', 'filterPriority', 'filterCycle', 'selectedIssueIds', 'agents'],
  emits: ['open-issue', 'update-issue', 'delete-issue', 'open-new-issue', 'toggle-issue-selection', 'range-select-issue', 'select-all-visible'],
  data() {
    return {
      sortBy: 'created',
      sortDesc: true,
      agentFilter: ''
    };
  },
  computed: {
    processedIssues() {
      let list = this.issues.filter(issue => {
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

      list.sort((a, b) => {
        let valA = a[this.sortBy];
        let valB = b[this.sortBy];

        if (this.sortBy === 'estimate') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        if (valA < valB) return this.sortDesc ? 1 : -1;
        if (valA > valB) return this.sortDesc ? -1 : 1;
        return 0;
      });

      return list;
    }
  },
  methods: {
    toggleSort(field) {
      if (this.sortBy === field) {
        this.sortDesc = !this.sortDesc;
      } else {
        this.sortBy = field;
        this.sortDesc = true;
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    async updateStatus(issue, newStatus) {
      if (issue.status === newStatus) return;
      await this.$emit('update-issue', {
        id: issue.id,
        status: newStatus
      });
    },
    async updatePriority(issue, newPriority) {
      if (issue.priority === newPriority) return;
      await this.$emit('update-issue', {
        id: issue.id,
        priority: newPriority
      });
    },
    isBlocked(issue) {
      if (!issue || !Array.isArray(issue.relations)) return false;
      return issue.relations.some(r => r && r.type === 'blocked_by');
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

    // --- Batch multi-select ---
    isSelected(issue) {
      return !!(this.selectedIssueIds && this.selectedIssueIds.has(issue.id));
    },

    toggleSelect(issue) {
      this.$emit('toggle-issue-selection', issue);
    },

    allVisibleSelected() {
      return this.processedIssues.length > 0 &&
        this.processedIssues.every(i => this.isSelected(i));
    },

    toggleSelectAll() {
      if (this.allVisibleSelected()) {
        for (const issue of this.processedIssues) {
          if (this.isSelected(issue)) this.$emit('toggle-issue-selection', issue);
        }
      } else {
        this.$emit('select-all-visible', this.processedIssues);
      }
    },

    handleRowClick(event, issue) {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        this.$emit('range-select-issue', this.processedIssues, issue);
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
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-2 bg-slate-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-2">

        <!-- Action Header -->
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center space-x-2">
            <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Work Items</h2>
            <span class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              {{ processedIssues.length }} items
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <select
              v-if="agents && agents.length > 0"
              v-model="agentFilter"
              class="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 max-w-[150px]"
            >
              <option value="">All Agents</option>
              <option v-for="a in agents" :key="a.name" :value="a.name">{{ a.avatar }} {{ a.name }}</option>
            </select>
            <button
              @click="$emit('open-new-issue')"
              class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Task</span>
            </button>
          </div>
        </div>

        <!-- Table Container -->
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] overflow-hidden shadow-2xs">
          <table class="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
            <thead class="border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider select-none">
              <tr>
                <!-- Master select-all checkbox -->
                <th class="py-2.5 px-3 w-8">
                  <button
                    type="button"
                    class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
                    :class="allVisibleSelected() ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-transparent hover:border-zinc-400 dark:hover:border-zinc-400'"
                    :title="allVisibleSelected() ? 'Clear visible selection' : 'Select all visible'"
                    @click.stop="toggleSelectAll"
                  >
                    <i data-lucide="check" class="w-2.5 h-2.5"></i>
                  </button>
                </th>
                <th class="py-2.5 px-3 w-28 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('identifier')">
                  <div class="flex items-center space-x-1">
                    <span>ID</span>
                    <i v-if="sortBy === 'identifier'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('title')">
                  <div class="flex items-center space-x-1">
                    <span>Title</span>
                    <i v-if="sortBy === 'title'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 w-32 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('status')">
                  <div class="flex items-center space-x-1">
                    <span>Status</span>
                    <i v-if="sortBy === 'status'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 w-28 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('priority')">
                  <div class="flex items-center space-x-1">
                    <span>Priority</span>
                    <i v-if="sortBy === 'priority'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 w-20 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('estimate')">
                  <div class="flex items-center space-x-1">
                    <span>Pts</span>
                    <i v-if="sortBy === 'estimate'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 w-28 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" @click="toggleSort('due_date')">
                  <div class="flex items-center space-x-1">
                    <span>Due Date</span>
                    <i v-if="sortBy === 'due_date'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3 h-3"></i>
                  </div>
                </th>
                <th class="py-2.5 px-3 w-32">Assignee</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-normal">
              <tr
                v-for="issue in processedIssues"
                :key="issue.id"
                class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                :class="{ 'bg-zinc-100/80 dark:bg-zinc-800/60 ring-1 ring-inset ring-zinc-400 dark:ring-zinc-600': isSelected(issue) }"
                @click="handleRowClick($event, issue)"
              >
                <!-- Row selection checkbox -->
                <td class="py-2 px-3" @click.stop>
                  <button
                    type="button"
                    class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
                    :class="isSelected(issue) ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-transparent hover:border-zinc-400 dark:hover:border-zinc-400'"
                    :title="isSelected(issue) ? 'Deselect (Esc)' : 'Select for bulk actions'"
                    @click="toggleSelect(issue)"
                  >
                    <i data-lucide="check" class="w-2.5 h-2.5"></i>
                  </button>
                </td>
                <!-- ID -->
                <td class="py-2 px-3 font-mono font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  <span class="flex items-center space-x-1.5">
                    <span v-if="!currentProject && issue.expand && issue.expand.project" class="text-xs">
                      {{ issue.expand.project.icon || '📁' }}
                    </span>
                    <span class="text-zinc-800 dark:text-zinc-200 group-hover:underline font-semibold">{{ issue.identifier }}</span>
                  </span>
                </td>

                <!-- Title -->
                <td class="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100 max-w-md">
                  <div class="flex items-center space-x-2">
                    <span class="truncate">{{ issue.title }}</span>
                    <!-- Blocked badge -->
                    <span
                      v-if="isBlocked(issue)"
                      class="px-1 py-0.5 rounded border text-[9px] font-semibold bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/70 text-red-600 dark:text-red-400 shrink-0"
                      title="Blocked by another issue"
                    >
                      <i data-lucide="lock" class="w-2.5 h-2.5"></i>
                      Blocked
                    </span>
                    <!-- Git Branch / PR badge -->
                    <span v-if="issue.pr_url || issue.git_branch" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[10px] text-zinc-600 dark:text-zinc-400 font-mono shrink-0 flex items-center gap-1" :title="issue.pr_url || issue.git_branch">
                      <span>{{ issue.pr_url ? '🔀' : '🌿' }}</span>
                      <span class="truncate max-w-[80px]">{{ issue.pr_status || (issue.git_branch ? issue.git_branch.split('/')[issue.git_branch.split('/').length - 1] : '') }}</span>
                    </span>

                    <!-- Subtask count badge -->
                    <span v-if="issue.subtasks && issue.subtasks.length > 0" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[10px] text-zinc-500 font-mono shrink-0">
                      {{ issue.subtasks.filter(s => s.done).length }}/{{ issue.subtasks.length }}
                    </span>
                  </div>
                </td>

                <!-- Status Select -->
                <td class="py-2 px-3" @click.stop>
                  <select
                    :value="issue.status || 'backlog'"
                    @change="updateStatus(issue, $event.target.value)"
                    class="w-full py-1 px-1.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  >
                    <option value="backlog" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Backlog</option>
                    <option value="todo" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Todo</option>
                    <option value="in_progress" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">In Progress</option>
                    <option value="in_review" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">In Review</option>
                    <option value="done" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Done</option>
                    <option value="cancelled" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Cancelled</option>
                  </select>
                </td>

                <!-- Priority Select -->
                <td class="py-2 px-3" @click.stop>
                  <select
                    :value="issue.priority || 'none'"
                    @change="updatePriority(issue, $event.target.value)"
                    class="w-full py-1 px-1.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  >
                    <option value="none" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">None</option>
                    <option value="low" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Low</option>
                    <option value="medium" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Medium</option>
                    <option value="high" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">High</option>
                    <option value="urgent" class="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">Urgent</option>
                  </select>
                </td>

                <!-- Points -->
                <td class="py-2 px-3 font-mono text-zinc-500">
                  {{ issue.estimate || '—' }}
                </td>

                <!-- Due Date -->
                <td class="py-2 px-3 text-zinc-500 whitespace-nowrap">
                  {{ formatDate(issue.due_date) }}
                </td>

                <!-- Assignee -->
                <td class="py-2 px-3">
                  <div v-if="issue.assignee" class="flex items-center space-x-1.5">
                    <span class="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-[9px] font-bold text-zinc-800 dark:text-zinc-200">
                      {{ agentAvatar(issue.assignee) || issue.assignee.charAt(0).toUpperCase() }}
                    </span>
                    <span class="text-zinc-700 dark:text-zinc-300 truncate max-w-[80px]">{{ issue.assignee }}</span>
                  </div>
                  <span v-else class="text-zinc-400 dark:text-zinc-600 text-[11px]">—</span>
                </td>
              </tr>

              <tr v-if="processedIssues.length === 0">
                <td colspan="8" class="py-8 text-center text-zinc-400">
                  <i data-lucide="inbox" class="w-7 h-7 mx-auto mb-1.5 opacity-40"></i>
                  <p class="text-xs">No work items matching the current filter</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  `
};
