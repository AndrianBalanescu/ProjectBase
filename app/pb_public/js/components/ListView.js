// pb_public/js/components/ListView.js

const ListViewComponent = {
  props: ['issues', 'projects', 'currentProject', 'cycles', 'labels', 'filterQuery', 'filterPriority', 'filterCycle'],
  emits: ['open-issue', 'update-issue', 'delete-issue', 'open-new-issue'],
  data() {
    return {
      sortBy: 'created',
      sortDesc: true,
      selectedIssues: new Set()
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
    toggleSort(col) {
      if (this.sortBy === col) {
        this.sortDesc = !this.sortDesc;
      } else {
        this.sortBy = col;
        this.sortDesc = false;
      }
    },
    updateStatus(issue, newStatus) {
      this.$emit('update-issue', {
        id: issue.id,
        status: newStatus
      });
    },
    updatePriority(issue, newPriority) {
      this.$emit('update-issue', {
        id: issue.id,
        priority: newPriority
      });
    },
    getStatusBadge(status) {
      switch (status) {
        case 'backlog': return { name: 'Backlog', color: 'bg-gray-800 text-gray-300 border-gray-700' };
        case 'todo': return { name: 'Todo', color: 'bg-purple-950/60 text-purple-300 border-purple-800/40' };
        case 'in_progress': return { name: 'In Progress', color: 'bg-blue-950/60 text-blue-300 border-blue-800/40' };
        case 'in_review': return { name: 'In Review', color: 'bg-amber-950/60 text-amber-300 border-amber-800/40' };
        case 'done': return { name: 'Done', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' };
        case 'cancelled': return { name: 'Cancelled', color: 'bg-red-950/60 text-red-300 border-red-800/40' };
        default: return { name: status, color: 'bg-gray-800 text-gray-400 border-gray-700' };
      }
    },
    getPriorityBadge(priority) {
      switch (priority) {
        case 'urgent': return { name: 'Urgent', color: 'text-red-400 bg-red-950/40 border-red-800/40' };
        case 'high': return { name: 'High', color: 'text-orange-400 bg-orange-950/40 border-orange-800/40' };
        case 'medium': return { name: 'Medium', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' };
        case 'low': return { name: 'Low', color: 'text-blue-400 bg-blue-950/40 border-blue-800/40' };
        default: return { name: 'None', color: 'text-gray-400 bg-gray-900 border-gray-800' };
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '—';
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-4">
        
        <!-- Action Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <h2 class="text-lg font-semibold text-white">Work Items</h2>
            <span class="px-2 py-0.5 rounded-full bg-gray-800 text-xs font-mono text-gray-400">
              {{ processedIssues.length }} items
            </span>
          </div>

          <button 
            @click="$emit('open-new-issue')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Add Task</span>
          </button>
        </div>

        <!-- Table Container -->
        <div class="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden shadow-xl">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-gray-800 bg-gray-950/80 text-gray-400 uppercase tracking-wider font-semibold select-none">
                <th class="py-3 px-4 w-28 cursor-pointer hover:text-white" @click="toggleSort('identifier')">
                  <div class="flex items-center space-x-1">
                    <span>ID</span>
                    <i v-if="sortBy === 'identifier'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 cursor-pointer hover:text-white" @click="toggleSort('title')">
                  <div class="flex items-center space-x-1">
                    <span>Title</span>
                    <i v-if="sortBy === 'title'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 w-32 cursor-pointer hover:text-white" @click="toggleSort('status')">
                  <div class="flex items-center space-x-1">
                    <span>Status</span>
                    <i v-if="sortBy === 'status'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 w-28 cursor-pointer hover:text-white" @click="toggleSort('priority')">
                  <div class="flex items-center space-x-1">
                    <span>Priority</span>
                    <i v-if="sortBy === 'priority'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 w-20 cursor-pointer hover:text-white" @click="toggleSort('estimate')">
                  <div class="flex items-center space-x-1">
                    <span>Pts</span>
                    <i v-if="sortBy === 'estimate'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 w-28 cursor-pointer hover:text-white" @click="toggleSort('due_date')">
                  <div class="flex items-center space-x-1">
                    <span>Due Date</span>
                    <i v-if="sortBy === 'due_date'" :data-lucide="sortDesc ? 'chevron-down' : 'chevron-up'" class="w-3.5 h-3.5"></i>
                  </div>
                </th>
                <th class="py-3 px-4 w-32">Assignee</th>
                <th class="py-3 px-4 w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60">
              <tr 
                v-for="issue in processedIssues" 
                :key="issue.id"
                class="hover:bg-gray-800/40 transition-colors group cursor-pointer"
                @click="$emit('open-issue', issue)"
              >
                <!-- ID -->
                <td class="py-3 px-4 font-mono font-medium text-gray-400 whitespace-nowrap">
                  <span class="flex items-center space-x-1.5">
                    <span v-if="!currentProject && issue.expand && issue.expand.project" class="text-xs">
                      {{ issue.expand.project.icon || '📁' }}
                    </span>
                    <span class="text-indigo-400 group-hover:underline">{{ issue.identifier }}</span>
                  </span>
                </td>

                <!-- Title -->
                <td class="py-3 px-4 font-medium text-gray-100 max-w-md">
                  <div class="flex items-center space-x-2">
                    <span class="truncate">{{ issue.title }}</span>
                    <!-- Subtask count badge -->
                    <span v-if="issue.subtasks && issue.subtasks.length > 0" class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 font-mono flex-shrink-0">
                      {{ issue.subtasks.filter(s => s.done).length }}/{{ issue.subtasks.length }}
                    </span>
                  </div>
                </td>

                <!-- Status Select -->
                <td class="py-3 px-4 whitespace-nowrap" @click.stop>
                  <select 
                    :value="issue.status || 'backlog'"
                    @change="updateStatus(issue, $event.target.value)"
                    class="px-2 py-1 rounded-md border text-[11px] font-medium bg-transparent focus:bg-gray-900 focus:outline-none cursor-pointer"
                    :class="getStatusBadge(issue.status).color"
                  >
                    <option value="backlog" class="bg-gray-900 text-gray-300">Backlog</option>
                    <option value="todo" class="bg-gray-900 text-purple-300">Todo</option>
                    <option value="in_progress" class="bg-gray-900 text-blue-300">In Progress</option>
                    <option value="in_review" class="bg-gray-900 text-amber-300">In Review</option>
                    <option value="done" class="bg-gray-900 text-emerald-300">Done</option>
                    <option value="cancelled" class="bg-gray-900 text-red-300">Cancelled</option>
                  </select>
                </td>

                <!-- Priority Select -->
                <td class="py-3 px-4 whitespace-nowrap" @click.stop>
                  <select 
                    :value="issue.priority || 'none'"
                    @change="updatePriority(issue, $event.target.value)"
                    class="px-2 py-1 rounded-md border text-[11px] font-medium bg-transparent focus:bg-gray-900 focus:outline-none cursor-pointer"
                    :class="getPriorityBadge(issue.priority).color"
                  >
                    <option value="urgent" class="bg-gray-900 text-red-400">Urgent</option>
                    <option value="high" class="bg-gray-900 text-orange-400">High</option>
                    <option value="medium" class="bg-gray-900 text-amber-400">Medium</option>
                    <option value="low" class="bg-gray-900 text-blue-400">Low</option>
                    <option value="none" class="bg-gray-900 text-gray-400">None</option>
                  </select>
                </td>

                <!-- Estimate -->
                <td class="py-3 px-4 font-mono text-gray-400">
                  {{ issue.estimate ? issue.estimate + ' pts' : '—' }}
                </td>

                <!-- Due Date -->
                <td class="py-3 px-4 text-gray-400 whitespace-nowrap">
                  {{ formatDate(issue.due_date) }}
                </td>

                <!-- Assignee -->
                <td class="py-3 px-4 text-gray-300 truncate">
                  <div v-if="issue.assignee" class="flex items-center space-x-1.5">
                    <div class="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white">
                      {{ issue.assignee.charAt(0).toUpperCase() }}
                    </div>
                    <span class="truncate">{{ issue.assignee }}</span>
                  </div>
                  <span v-else class="text-gray-600">—</span>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right" @click.stop>
                  <button 
                    @click="$emit('delete-issue', issue.id)"
                    class="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete item"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </td>
              </tr>

              <!-- Empty state -->
              <tr v-if="processedIssues.length === 0">
                <td colspan="8" class="py-12 text-center text-gray-500">
                  <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                  <p class="text-sm">No work items matching the current filter</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  `
};
