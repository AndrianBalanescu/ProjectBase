// pb_public/js/components/CycleModal.js

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
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60 select-none">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm font-bold text-white">Create Sprint Cycle</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          
          <!-- Project & Status -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Project</label>
              <select 
                v-model="projectId" 
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.icon || '📁' }} {{ p.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cycle Status</label>
              <select 
                v-model="status" 
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <!-- Name -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sprint Name</label>
            <input 
              ref="cycleNameInput"
              v-model="name"
              placeholder="e.g. Sprint 1 - Core MVP"
              class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Start Date</label>
              <input 
                type="date"
                v-model="startDate"
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">End Date</label>
              <input 
                type="date"
                v-model="endDate"
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Goals & Scope</label>
            <textarea 
              v-model="description"
              rows="3"
              placeholder="Key deliverable goals for this sprint..."
              class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            ></textarea>
          </div>

        </div>

        <!-- Footer -->
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
            Create Cycle
          </button>
        </div>

      </div>
    </div>
  `
};
