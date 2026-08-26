// pb_public/js/components/NewIssueModal.js
// Minimalist, high-density New Issue Modal supporting Dark and Light themes.

const NewIssueModalComponent = {
  components: {
    'searchable-select': window.SearchableSelectComponent || SearchableSelectComponent,
    'multiselect': window.MultiselectComponent || MultiselectComponent
  },
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
      startDate: '',
      dueDate: '',
      cycleId: '',
      milestoneId: '',
      assignee: '',
      selectedLabels: [],
      customFields: {}
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
        this.startDate = '';
        this.dueDate = '';
        this.cycleId = '';
        this.milestoneId = '';
        this.assignee = '';
        this.selectedLabels = [];
        this.customFields = {};

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
      return list.filter(m => m.project === this.projectId);
    },
    selectedProjectFieldDefs() {
      if (!this.projectId || !this.projects) return [];
      const p = this.projects.find(x => x.id === this.projectId);
      if (!p || !p.custom_field_defs) return [];
      if (Array.isArray(p.custom_field_defs)) return p.custom_field_defs;
      try {
        return typeof p.custom_field_defs === 'string' ? JSON.parse(p.custom_field_defs) : [];
      } catch (e) {
        return [];
      }
    }
  },
  methods: {
    submit() {
      if (!this.title.trim()) return;

      const payload = {
        title: this.title.trim(),
        description: this.description,
        project: this.projectId,
        status: this.status,
        priority: this.priority,
        estimate: Number(this.estimate) || 0,
        start_date: this.startDate ? new Date(this.startDate).toISOString() : null,
        due_date: this.dueDate ? new Date(this.dueDate).toISOString() : null,
        cycle: this.cycleId || null,
        milestone: this.milestoneId || null,
        assignee: this.assignee.trim(),
        labels: this.selectedLabels,
        custom_fields: this.customFields
      };

      this.$emit('create-issue', payload);
      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center select-none">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <!-- Modal Box -->
      <div class="relative w-full max-w-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">

        <!-- Header -->
        <div class="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/60 select-none">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Create Work Item</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Form Body -->
        <div class="p-5 space-y-3.5 select-text text-xs">

          <!-- Project & Status Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project</label>
              <select
                v-model="projectId"
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.icon || '📁' }} {{ p.name }} [{{ p.identifier }}]
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Initial Status</label>
              <select
                v-model="status"
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
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
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Issue Title</label>
            <input
              ref="titleInput"
              v-model="title"
              @keydown.enter="submit"
              placeholder="What needs to be done?"
              class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          <!-- Description Input -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description (Markdown)</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Detailed description, criteria, context..."
              class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-mono"
            ></textarea>
          </div>

          <!-- Meta Row: Priority, Estimate, Start & Due Dates -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Priority</label>
              <select
                v-model="priority"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Estimate (Pts)</label>
              <input
                type="number"
                v-model.number="estimate"
                min="0"
                max="50"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                v-model="startDate"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                v-model="dueDate"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
          </div>

          <!-- Assignee, Cycle & Milestone -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Assignee</label>
              <input
                v-model="assignee"
                placeholder="Agent or user..."
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Sprint Cycle</label>
              <select
                v-model="cycleId"
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">No Cycle (Backlog)</option>
                <option v-for="c in cycles" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Milestone</label>
              <select
                v-model="milestoneId"
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">No Milestone</option>
                <option v-for="m in projectMilestones" :key="m.id" :value="m.id">{{ m.name || m.title }} ({{ m.status }})</option>
              </select>
            </div>
          </div>

          <!-- Labels Multiselect -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Labels</label>
            <multiselect
              v-model="selectedLabels"
              :options="['feature', 'bug', 'core', 'frontend', 'api', 'infra', 'agent']"
              placeholder="Select labels..."
              search-placeholder="Filter labels..."
            ></multiselect>
          </div>

          <!-- Custom Fields (Dynamic from selected project) -->
          <div v-if="selectedProjectFieldDefs.length" class="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project Custom Fields</label>
            <div class="grid grid-cols-2 gap-2.5">
              <div v-for="f in selectedProjectFieldDefs" :key="f.key" class="space-y-1">
                <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                  {{ f.label }} <span v-if="f.required" class="text-red-500">*</span>
                </label>
                <input
                  v-if="f.type === 'text'"
                  v-model="customFields[f.key]"
                  placeholder="—"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
                <input
                  v-else-if="f.type === 'number'"
                  v-model.number="customFields[f.key]"
                  type="number"
                  placeholder="0"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
                <select
                  v-else-if="f.type === 'select'"
                  v-model="customFields[f.key]"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                >
                  <option value="">Select...</option>
                  <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <div v-else-if="f.type === 'checkbox'" class="pt-2">
                  <label class="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="customFields[f.key]"
                      class="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-0"
                    />
                    <span class="text-xs text-zinc-700 dark:text-zinc-300">{{ f.label }}</span>
                  </label>
                </div>
                <input
                  v-else-if="f.type === 'date'"
                  v-model="customFields[f.key]"
                  type="date"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
              </div>
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-end space-x-2 select-none">
          <button
            @click="$emit('close')"
            class="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="submit"
            class="px-4 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-2xs transition-colors"
          >
            Create Work Item
          </button>
        </div>

      </div>
    </div>
  `
};
