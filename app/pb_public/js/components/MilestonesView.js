// pb_public/js/components/MilestonesView.js
// Milestones & North Star Strategic Roadmap Component

const MilestonesViewComponent = {
  props: ['milestones', 'issues', 'projects', 'currentProject'],
  emits: ['open-issue', 'create-milestone', 'update-milestone', 'delete-milestone', 'update-project'],
  data() {
    return {
      isNewMilestoneOpen: false,
      isEditNorthStarOpen: false,
      newMilestone: {
        name: '',
        description: '',
        target_date: '',
        status: 'planned'
      },
      northStarForm: {
        vision: '',
        objective: '',
        target_quarter: 'Q3 2026'
      }
    };
  },
  computed: {
    activeProject() {
      if (this.currentProject) return this.currentProject;
      return this.projects.find(p => p.identifier === 'PB') || this.projects[0] || null;
    },
    northStar() {
      if (!this.activeProject) return null;
      let settings = this.activeProject.settings || {};
      if (typeof settings === 'string') {
        try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
      }
      return settings.north_star || {
        vision: 'Build the fastest, zero-friction open-source Linear alternative backed by PocketBase & SQLite.',
        objective: 'Achieve 100% feature parity with Linear/Plane for agentic teams with sub-20ms latency.',
        target_quarter: 'Q3-Q4 2026'
      };
    },
    filteredMilestones() {
      if (!this.activeProject) return this.milestones;
      return this.milestones.filter(m => m.project === this.activeProject.id || !m.project);
    },
    milestonesWithProgress() {
      return this.filteredMilestones.map(m => {
        const linkedIssues = this.issues.filter(i => i.milestone === m.id);
        const total = linkedIssues.length;
        const done = linkedIssues.filter(i => i.status === 'done').length;
        const inProgress = linkedIssues.filter(i => i.status === 'in_progress').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : (m.status === 'achieved' ? 100 : 0);
        return {
          ...m,
          linkedIssues,
          totalCount: total,
          doneCount: done,
          inProgressCount: inProgress,
          progressPercent: percent
        };
      });
    },
    groupedMilestones() {
      return {
        in_progress: this.milestonesWithProgress.filter(m => m.status === 'in_progress'),
        planned: this.milestonesWithProgress.filter(m => m.status === 'planned' || !m.status),
        achieved: this.milestonesWithProgress.filter(m => m.status === 'achieved')
      };
    }
  },
  mounted() {
    this.$nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  updated() {
    this.$nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  methods: {
    formatDate(d) {
      if (!d) return 'No target date';
      return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    },
    openEditNorthStar() {
      this.northStarForm = { ...this.northStar };
      this.isEditNorthStarOpen = true;
    },
    saveNorthStar() {
      if (!this.activeProject) return;
      let settings = this.activeProject.settings || {};
      if (typeof settings === 'string') {
        try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
      }
      settings.north_star = { ...this.northStarForm };
      this.$emit('update-project', this.activeProject.id, { settings });
      this.isEditNorthStarOpen = false;
    },
    handleCreateMilestone() {
      if (!this.newMilestone.name || !this.activeProject) return;
      this.$emit('create-milestone', {
        name: this.newMilestone.name,
        description: this.newMilestone.description,
        target_date: this.newMilestone.target_date,
        status: this.newMilestone.status,
        project: this.activeProject.id
      });
      this.newMilestone = { name: '', description: '', target_date: '', status: 'planned' };
      this.isNewMilestoneOpen = false;
    },
    updateStatus(m, newStatus) {
      this.$emit('update-milestone', m.id, { status: newStatus });
    }
  },
  template: `
    <div class="h-full overflow-y-auto bg-gray-950 p-2.5 space-y-3">
      <!-- 1. North Star Banner -->
      <div class="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-gray-900 border border-indigo-500/20 p-3 shadow-xl">
        <div class="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
          <i data-lucide="compass" class="w-48 h-48 text-indigo-300"></i>
        </div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-3xl">
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                <i data-lucide="sparkles" class="w-3 h-3 text-indigo-400"></i>
                <span>North Star Objective</span>
              </span>
              <span v-if="activeProject" class="text-xs text-gray-400 font-medium">[{{ activeProject.identifier }}] {{ activeProject.name }}</span>
            </div>
            <h2 class="text-xl md:text-2xl font-bold text-white tracking-tight">
              {{ northStar ? northStar.vision : 'Define your project vision & strategic trajectory.' }}
            </h2>
            <p class="text-sm text-gray-300">
              {{ northStar ? northStar.objective : 'Add target milestones, architecture goals, and success criteria.' }}
            </p>
          </div>

          <div class="flex items-center space-x-3 flex-shrink-0">
            <button
              @click="openEditNorthStar"
              class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-200 transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-gray-400"></i>
              <span>Edit North Star</span>
            </button>
            <button
              @click="isNewMilestoneOpen = true"
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Milestone</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Roadmap Grid by Status -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- In Progress Milestones -->
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/10"></span>
              <h3 class="text-sm font-semibold text-white">In Progress</h3>
            </div>
            <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {{ groupedMilestones.in_progress.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.in_progress.length === 0" class="p-6 rounded-xl border border-dashed border-gray-800 text-center text-xs text-gray-500">
            No active milestones in progress.
          </div>

          <div
            v-for="m in groupedMilestones.in_progress"
            :key="m.id"
            class="p-5 rounded-xl bg-gray-900/70 border border-amber-500/30 shadow-lg space-y-4 transition-all hover:border-amber-500/50"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1">
                <h4 class="text-sm font-bold text-white tracking-tight">{{ m.name }}</h4>
                <p class="text-xs text-gray-400 line-clamp-2">{{ m.description }}</p>
              </div>
              <div class="flex items-center space-x-1">
                <button
                  @click="updateStatus(m, 'achieved')"
                  title="Mark as achieved"
                  class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                >
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-medium">
                <span class="text-gray-400">Progress</span>
                <span class="text-amber-300 font-mono">{{ m.progressPercent }}% ({{ m.doneCount }}/{{ m.totalCount }} tasks)</span>
              </div>
              <div class="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300" :style="{ width: m.progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/60">
              <span class="flex items-center space-x-1">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-gray-500"></i>
                <span>{{ formatDate(m.target_date) }}</span>
              </span>
              <button
                @click="$emit('delete-milestone', m.id)"
                class="text-gray-500 hover:text-red-400 transition-colors"
                title="Delete milestone"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- Linked Tasks Preview -->
            <div v-if="m.linkedIssues.length > 0" class="space-y-1.5 pt-2">
              <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Linked Tasks</div>
              <div class="space-y-1 max-h-40 overflow-y-auto">
                <div
                  v-for="iss in m.linkedIssues"
                  :key="iss.id"
                  @click="$emit('open-issue', iss)"
                  class="p-2 rounded-lg bg-gray-950/60 border border-gray-800/60 hover:border-gray-700 cursor-pointer flex items-center justify-between text-xs transition-all"
                >
                  <div class="flex items-center space-x-2 truncate">
                    <span class="font-mono text-gray-400 font-medium">{{ iss.identifier }}</span>
                    <span class="text-gray-200 truncate">{{ iss.title }}</span>
                  </div>
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold flex-shrink-0"
                    :class="{
                      'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20': iss.status === 'done',
                      'bg-amber-500/10 text-amber-300 border border-amber-500/20': iss.status === 'in_progress',
                      'bg-gray-800 text-gray-400': iss.status === 'todo' || iss.status === 'backlog'
                    }"
                  >
                    {{ iss.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Planned Milestones -->
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 ring-4 ring-indigo-400/10"></span>
              <h3 class="text-sm font-semibold text-white">Planned</h3>
            </div>
            <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {{ groupedMilestones.planned.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.planned.length === 0" class="p-6 rounded-xl border border-dashed border-gray-800 text-center text-xs text-gray-500">
            No planned milestones.
          </div>

          <div
            v-for="m in groupedMilestones.planned"
            :key="m.id"
            class="p-5 rounded-xl bg-gray-900/50 border border-gray-800 shadow-md space-y-4 transition-all hover:border-gray-700"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1">
                <h4 class="text-sm font-bold text-white tracking-tight">{{ m.name }}</h4>
                <p class="text-xs text-gray-400 line-clamp-2">{{ m.description }}</p>
              </div>
              <div class="flex items-center space-x-1">
                <button
                  @click="updateStatus(m, 'in_progress')"
                  title="Start milestone"
                  class="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all"
                >
                  <i data-lucide="play" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-medium">
                <span class="text-gray-400">Progress</span>
                <span class="text-gray-400 font-mono">{{ m.progressPercent }}% ({{ m.doneCount }}/{{ m.totalCount }} tasks)</span>
              </div>
              <div class="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: m.progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/60">
              <span class="flex items-center space-x-1">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-gray-500"></i>
                <span>{{ formatDate(m.target_date) }}</span>
              </span>
              <button
                @click="$emit('delete-milestone', m.id)"
                class="text-gray-500 hover:text-red-400 transition-colors"
                title="Delete milestone"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Achieved Milestones -->
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10"></span>
              <h3 class="text-sm font-semibold text-white">Achieved</h3>
            </div>
            <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {{ groupedMilestones.achieved.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.achieved.length === 0" class="p-6 rounded-xl border border-dashed border-gray-800 text-center text-xs text-gray-500">
            No achieved milestones yet.
          </div>

          <div
            v-for="m in groupedMilestones.achieved"
            :key="m.id"
            class="p-5 rounded-xl bg-gray-900/30 border border-emerald-500/20 opacity-90 shadow-md space-y-4 transition-all hover:opacity-100"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1">
                <div class="flex items-center space-x-1.5">
                  <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
                  <h4 class="text-sm font-bold text-white tracking-tight">{{ m.name }}</h4>
                </div>
                <p class="text-xs text-gray-400 line-clamp-2">{{ m.description }}</p>
              </div>
            </div>

            <div class="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <div class="h-full bg-emerald-500 w-full"></div>
            </div>

            <div class="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/60">
              <span class="text-emerald-400 font-medium">Completed</span>
              <button
                @click="$emit('delete-milestone', m.id)"
                class="text-gray-500 hover:text-red-400 transition-colors"
                title="Delete milestone"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Milestone Modal -->
      <div v-if="isNewMilestoneOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-white">Create New Milestone</h3>
            <button @click="isNewMilestoneOpen = false" class="text-gray-400 hover:text-white">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Milestone Name</label>
              <input v-model="newMilestone.name" type="text" placeholder="e.g. M2: Zero-Build Fast View Parity" class="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Description & Scope</label>
              <textarea v-model="newMilestone.description" rows="3" placeholder="Target features, architecture gates, and deliverables..." class="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-gray-300 mb-1.5">Target Date</label>
                <input v-model="newMilestone.target_date" type="date" class="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-300 mb-1.5">Status</label>
                <select v-model="newMilestone.status" class="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="achieved">Achieved</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-2">
            <button @click="isNewMilestoneOpen = false" class="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-gray-800">Cancel</button>
            <button @click="handleCreateMilestone" class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500">Create Milestone</button>
          </div>
        </div>
      </div>

      <!-- Edit North Star Modal -->
      <div v-if="isEditNorthStarOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-white">Edit North Star Objective</h3>
            <button @click="isEditNorthStarOpen = false" class="text-gray-400 hover:text-white">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">North Star Vision</label>
              <textarea v-model="northStarForm.vision" rows="2" placeholder="High level strategic purpose..." class="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Concrete Objective & Metrics</label>
              <textarea v-model="northStarForm.objective" rows="3" placeholder="Measurable targets..." class="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Target Horizon</label>
              <input v-model="northStarForm.target_quarter" type="text" placeholder="e.g. Q4 2026" class="w-full px-3.5 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-2">
            <button @click="isEditNorthStarOpen = false" class="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-gray-800">Cancel</button>
            <button @click="saveNorthStar" class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500">Save North Star</button>
          </div>
        </div>
      </div>
    </div>
  `
};
