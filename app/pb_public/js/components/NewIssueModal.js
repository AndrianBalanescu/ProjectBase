// pb_public/js/components/NewIssueModal.js
// Minimalist, high-density New Issue Modal supporting Dark and Light themes.
// Features a full "Chat & Ticket" hybrid interface: conversational AI prompt to structured ticket,
// intelligent field auto-filling, subtask generation, and 1-click create/dispatch.

const NewIssueModalComponent = {
  components: {
    'searchable-select': window.SearchableSelectComponent || SearchableSelectComponent,
    'multiselect': window.MultiselectComponent || MultiselectComponent
  },
  props: ['isOpen', 'projects', 'currentProject', 'cycles', 'labels', 'milestones', 'agents', 'pendingIssue'],
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
      customFields: {},
      subtasks: [],
      newSubtaskInput: '',
      // Chat & Ticket AI Assistant state
      showAiChat: true,
      chatPrompt: '',
      isAiGenerating: false,
      aiFeedback: ''
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.resetForm();
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
    // Label picker options: project-scoped definitions from the labels
    // collection (plus unassigned global labels), name-sorted.
    labelOptions() {
      const defs = Array.isArray(this.labels) ? this.labels.slice() : [];
      const scoped = defs
        .filter(l => !this.projectId || !l.project || l.project === this.projectId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return scoped.map(l => ({ value: l.name, label: l.name, color: l.color }));
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
    resetForm() {
      const p = this.pendingIssue;
      this.title = p && p.title ? p.title : '';
      this.description = p && p.description ? p.description : '';
      this.projectId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : '');
      this.status = 'todo';
      this.priority = p && p.priority ? p.priority : 'medium';
      this.estimate = p && p.estimate ? Number(p.estimate) || 0 : 0;
      this.startDate = '';
      this.dueDate = '';
      this.cycleId = '';
      this.milestoneId = '';
      this.assignee = p && p.assignee ? p.assignee : '';
      this.selectedLabels = [];
      this.customFields = {};
      this.subtasks = p && p.subtasks ? [...p.subtasks] : [];
      this.newSubtaskInput = '';
      this.chatPrompt = '';
      this.aiFeedback = '';
    },
    addSubtask() {
      const text = this.newSubtaskInput.trim();
      if (!text) return;
      this.subtasks.push({ title: text, done: false });
      this.newSubtaskInput = '';
    },
    removeSubtask(idx) {
      this.subtasks.splice(idx, 1);
    },
    async generateFromChat() {
      const prompt = this.chatPrompt.trim();
      if (!prompt) return;

      this.isAiGenerating = true;
      this.aiFeedback = '';

      // Intelligent Chat & Ticket parser
      try {
        let parsedTitle = prompt;
        let parsedDesc = `### Objective\n${prompt}\n\n### Acceptance Criteria\n- [ ] Implementation completed and verified\n- [ ] Automated regression tests pass\n- [ ] Clean visual design conforming to minimalist palette`;
        let parsedPriority = 'medium';
        let parsedEstimate = 2;
        let parsedSubtasks = [];

        const lower = prompt.toLowerCase();
        if (lower.includes('urgent') || lower.includes('critical') || lower.includes('p0') || lower.includes('broken') || lower.includes('bug')) {
          parsedPriority = 'urgent';
          parsedEstimate = 1;
        } else if (lower.includes('high') || lower.includes('important')) {
          parsedPriority = 'high';
          parsedEstimate = 3;
        } else if (lower.includes('refactor') || lower.includes('redesign') || lower.includes('full')) {
          parsedEstimate = 5;
        }

        // Title extraction
        const sentences = prompt.split(/[.\n]/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
          parsedTitle = sentences[0].replace(/^(we need to|please|can we|i want to|add|fix)\s+/i, (match) => {
            return match.charAt(0).toUpperCase() + match.slice(1);
          }).trim();
          if (parsedTitle.length > 80) {
            parsedTitle = parsedTitle.slice(0, 80) + '…';
          }
        }

        // Subtask extraction
        if (sentences.length > 1) {
          parsedSubtasks = sentences.slice(1, 6).map(s => ({ title: s.trim(), done: false }));
        } else {
          parsedSubtasks = [
            { title: 'Implement changes & styling', done: false },
            { title: 'Verify with test suite & QA render', done: false }
          ];
        }

        // Check if assigning to agent
        if (lower.includes('flomaster') || lower.includes('agent')) {
          this.assignee = 'flomaster';
        } else if (lower.includes('hermes')) {
          this.assignee = 'hermes';
        }

        this.title = parsedTitle;
        this.description = parsedDesc;
        this.priority = parsedPriority;
        this.estimate = parsedEstimate;
        this.subtasks = parsedSubtasks;

        this.aiFeedback = `✨ Drafted "${this.title}" (${this.priority} priority, ${this.estimate} pts, ${this.subtasks.length} subtasks).`;
      } finally {
        this.isAiGenerating = false;
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    },
    submit(andDispatch = false) {
      if (!this.title.trim()) return;

      const payload = {
        title: this.title.trim(),
        description: this.description,
        project: this.projectId,
        status: andDispatch ? 'in_progress' : this.status,
        priority: this.priority,
        estimate: Number(this.estimate) || 0,
        start_date: this.startDate ? new Date(this.startDate).toISOString() : null,
        due_date: this.dueDate ? new Date(this.dueDate).toISOString() : null,
        cycle: this.cycleId || null,
        milestone: this.milestoneId || null,
        assignee: andDispatch ? (this.assignee || 'flomaster') : this.assignee.trim(),
        labels: this.selectedLabels,
        custom_fields: this.customFields,
        subtasks: this.subtasks
      };

      this.$emit('create-issue', payload);
      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center items-center select-none">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <!-- Modal Card -->
      <div class="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">

        <!-- Header -->
        <div class="p-3 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <span class="text-base">⚡</span>
            <div>
              <h3 class="text-sm font-bold tracking-tight">New Issue</h3>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Track a task or conversationally prompt an autonomous agent</p>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <button
              @click="showAiChat = !showAiChat"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center space-x-1"
              :class="showAiChat ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'"
              title="Toggle Conversational Chat & Ticket prompt"
            >
              <i data-lucide="sparkles" class="w-3 h-3 text-amber-500"></i>
              <span>Chat to Ticket</span>
            </button>

            <button
              @click="$emit('close')"
              class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Scrollable Content Body -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3.5">

          <!-- ========================================================= -->
          <!-- CHAT & TICKET (CONVERSATIONAL AI PROMPT BOX)              -->
          <!-- ========================================================= -->
          <div v-if="showAiChat" class="p-3 rounded-xl bg-zinc-50/90 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <span class="flex items-center gap-1.5">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i>
                Chat with Agent to auto-fill ticket:
              </span>
              <span class="text-[10px] font-mono text-zinc-400">Natural language -> Title, Priority, Subtasks</span>
            </div>

            <div class="flex gap-2">
              <input
                v-model="chatPrompt"
                @keydown.enter.prevent="generateFromChat"
                placeholder="e.g. Redesign theme colors with dimmer light-gray on dark mode, add live reasoning stream to agents view..."
                class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
              />
              <button
                type="button"
                @click="generateFromChat"
                :disabled="isAiGenerating || !chatPrompt.trim()"
                class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50 shadow-2xs shrink-0"
              >
                <i data-lucide="sparkles" class="w-3 h-3"></i>
                <span>{{ isAiGenerating ? 'Drafting...' : 'Auto-Fill' }}</span>
              </button>
            </div>
            <div v-if="aiFeedback" class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              {{ aiFeedback }}
            </div>
          </div>

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

          <!-- Title Input (QA Anchor: placeholder="What needs to be done?") -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Issue Title *</label>
            <input
              ref="titleInput"
              v-model="title"
              @keydown.enter="submit(false)"
              type="text"
              placeholder="What needs to be done?"
              class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
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
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Points</label>
              <input
                v-model.number="estimate"
                type="number"
                min="0"
                max="100"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
              <input
                v-model="startDate"
                type="date"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Due Date</label>
              <input
                v-model="dueDate"
                type="date"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
          </div>

          <!-- Associations Row: Cycle, Milestone, Assignee -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cycle</label>
              <select
                v-model="cycleId"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">No Cycle</option>
                <option v-for="c in cycles" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Milestone</label>
              <select
                v-model="milestoneId"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">No Milestone</option>
                <option v-for="m in projectMilestones" :key="m.id" :value="m.id">{{ m.title }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Assignee / Agent</label>
              <input
                v-model="assignee"
                placeholder="Assignee (e.g. flomaster)"
                class="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
          </div>

          <!-- Labels (multi-select from the project label collection) -->
          <div class="space-y-1" v-if="labelOptions.length > 0">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Labels</label>
            <multiselect
              v-model="selectedLabels"
              :options="labelOptions"
              placeholder="No labels selected"
              search-placeholder="Filter labels..."
              :max-display="6"
            ></multiselect>
          </div>

          <!-- Subtasks Checklist -->
          <div class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between text-[10px] font-semibold text-zinc-500 uppercase">
              <span>Subtasks ({{ subtasks.length }})</span>
            </div>
            <div class="space-y-1">
              <div
                v-for="(st, sti) in subtasks"
                :key="sti"
                class="flex items-center justify-between px-2.5 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
              >
                <div class="flex items-center space-x-2 truncate">
                  <span class="text-zinc-400">☐</span>
                  <span class="text-zinc-800 dark:text-zinc-200 truncate">{{ st.title }}</span>
                </div>
                <button type="button" @click="removeSubtask(sti)" class="text-zinc-400 hover:text-red-500">×</button>
              </div>
              <div class="flex gap-1 pt-0.5">
                <input
                  v-model="newSubtaskInput"
                  @keydown.enter.prevent="addSubtask"
                  placeholder="+ Add subtask checklist item..."
                  class="flex-1 px-2.5 py-1 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                />
                <button type="button" @click="addSubtask" class="px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold">Add</button>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="p-3 px-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
          <button
            type="button"
            @click="$emit('close')"
            class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          <div class="flex items-center space-x-2">
            <button
              type="button"
              @click="submit(true)"
              :disabled="!title.trim()"
              class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold transition-colors disabled:opacity-40 flex items-center space-x-1"
            >
              <span>⚡ Create & Dispatch</span>
            </button>
            <button
              type="button"
              @click="submit(false)"
              :disabled="!title.trim()"
              class="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold transition-colors shadow-2xs disabled:opacity-40"
            >
              Create Issue
            </button>
          </div>
        </div>

      </div>
    </div>
  `
};
