// pb_public/js/components/NewIssueModal.js

const NewIssueModalComponent = {
  props: ['isOpen', 'projects', 'currentProject', 'cycles', 'labels', 'milestones'],
  emits: ['close', 'create-issue'],
  data() {
    return {
      title: '',
      description: '',
      projectId: '',
      status: 'todo',
      priority: 'medium',
      estimate: 0,
      dueDate: '',
      cycleId: '',
      milestoneId: '',
      assignee: '',
      selectedLabels: []
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.title = '';
        this.description = '';
        this.projectId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : '');
        this.status = 'todo';
        this.priority = 'medium';
        this.estimate = 0;
        this.dueDate = '';
        this.cycleId = '';
        this.milestoneId = '';
        this.assignee = '';
        this.selectedLabels = [];

        this.$nextTick(() => {
          const inp = this.$refs.titleInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  computed: {
    projectMilestones() {
      const list = Array.isArray(this.milestones) ? this.milestones : [];
      if (!this.projectId) return list;
      return list.filter(m => !m.project || m.project === this.projectId);
    }
  },
  methods: {
    toggleLabel(l) {
      if (this.selectedLabels.includes(l)) {
        this.selectedLabels = this.selectedLabels.filter(x => x !== l);
      } else {
        this.selectedLabels.push(l);
      }
    },
    async submit() {
      if (!this.title.trim()) {
        alert('Please enter an issue title.');
        return;
      }
      if (!this.projectId) {
        alert('Please select a project.');
        return;
      }

      await this.$emit('create-issue', {
        project: this.projectId,
        title: this.title.trim(),
        description: this.description.trim(),
        status: this.status,
        priority: this.priority,
        estimate: Number(this.estimate) || 0,
        due_date: this.dueDate ? new Date(this.dueDate).toISOString() : null,
        cycle: this.cycleId || null,
        milestone: this.milestoneId || null,
        assignee: this.assignee.trim(),
        labels: this.selectedLabels
      });

      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <!-- Modal Box -->
      <div class="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60 select-none">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm font-bold text-white">Create New Work Item</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Form Body -->
        <div class="p-6 space-y-4">
          
          <!-- Project & Status Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Project</label>
              <select 
                v-model="projectId" 
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.icon || '📁' }} {{ p.name }} [{{ p.identifier }}]
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Initial Status</label>
              <select 
                v-model="status" 
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <!-- Title Input -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Issue Title</label>
            <input 
              ref="titleInput"
              v-model="title"
              @keydown.enter="submit"
              placeholder="What needs to be done?"
              class="w-full px-3.5 py-2.5 rounded-xl bg-gray-950/80 border border-gray-800 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <!-- Description Input -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Description (Markdown)</label>
            <textarea 
              v-model="description"
              rows="4"
              placeholder="Detailed description, criteria, context..."
              class="w-full px-3.5 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            ></textarea>
          </div>

          <!-- Meta Row: Priority, Estimate, Due Date -->
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Priority</label>
              <select 
                v-model="priority" 
                class="w-full px-2.5 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="urgent">🔥 Urgent</option>
                <option value="high">🔺 High</option>
                <option value="medium">🔸 Medium</option>
                <option value="low">🔹 Low</option>
                <option value="none">⚪ None</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Estimate (Pts)</label>
              <input 
                type="number"
                v-model.number="estimate"
                min="0"
                max="50"
                class="w-full px-2.5 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Due Date</label>
              <input 
                type="date"
                v-model="dueDate"
                class="w-full px-2.5 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Assignee, Cycle & Milestone -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Assignee</label>
              <input 
                v-model="assignee"
                placeholder="Agent or team member..."
                class="w-full px-3 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sprint Cycle</label>
              <select 
                v-model="cycleId" 
                class="w-full px-3 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Cycle (Backlog)</option>
                <option v-for="c in cycles" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Milestone</label>
              <select
                v-model="milestoneId"
                class="w-full px-3 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Milestone</option>
                <option v-for="m in projectMilestones" :key="m.id" :value="m.id">{{ m.name }} ({{ m.status }})</option>
              </select>
            </div>
          </div>

          <!-- Quick Label Chips -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Labels</label>
            <div class="flex flex-wrap gap-1.5">
              <button 
                v-for="l in ['feature', 'bug', 'core', 'frontend', 'api', 'infra', 'agent']"
                :key="l"
                type="button"
                @click="toggleLabel(l)"
                class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                :class="selectedLabels.includes(l) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'"
              >
                {{ l }}
              </button>
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-3.5 border-t border-gray-800 bg-gray-950/60 flex items-center justify-end space-x-2">
          <button 
            @click="$emit('close')"
            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            @click="submit"
            class="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Create Work Item
          </button>
        </div>

      </div>
    </div>
  `
};
