// pb_public/js/components/CycleModal.js
// Minimalist Sprint Cycle modal supporting Dark and Light themes.

const CycleModalComponent = {
  props: ['isOpen', 'projects', 'currentProject'],
  emits: ['close', 'create-cycle'],
  data() {
    return {
      name: '',
      projectId: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'active'
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.name = 'Sprint ' + (new Date().getMonth() + 1) + '.' + (new Date().getDate());
        this.projectId = this.currentProject ? this.currentProject.id : (this.projects[0] ? this.projects[0].id : '');
        this.description = '';

        const now = new Date();
        this.startDate = now.toISOString().substring(0, 10);
        const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        this.endDate = inTwoWeeks.toISOString().substring(0, 10);
        this.status = 'active';

        this.$nextTick(() => {
          const inp = this.$refs.cycleNameInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    submit() {
      if (!this.name.trim() || !this.projectId) {
        alert('Please provide cycle name and target project.');
        return;
      }

      this.$emit('create-cycle', {
        name: this.name.trim(),
        project: this.projectId,
        description: this.description.trim(),
        start_date: this.startDate ? new Date(this.startDate).toISOString() : null,
        end_date: this.endDate ? new Date(this.endDate).toISOString() : null,
        status: this.status
      });

      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center select-none">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-lg bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Create Sprint Cycle</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-3.5">

          <!-- Project & Status -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project</label>
              <select
                v-model="projectId"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer"
              >
                <option
                  v-for="p in projects"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.icon || '📁' }} {{ p.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cycle Status</label>
              <select
                v-model="status"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <!-- Name -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Sprint Name</label>
            <input
              ref="cycleNameInput"
              v-model="name"
              placeholder="e.g. Sprint 1 - Core MVP"
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                v-model="startDate"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                v-model="endDate"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Goals & Scope</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Key deliverable goals for this sprint..."
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            ></textarea>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end space-x-2">
          <button
            @click="$emit('close')"
            class="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="submit"
            class="px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Create Cycle
          </button>
        </div>

      </div>
    </div>
  `
};
