// pb_public/js/components/MilestonesView.js
// Minimalist Milestones & North Star Strategic Roadmap Component supporting Dark and Light themes.

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
      return (this.filteredMilestones || []).map(m => {
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
      this.$emit('update-project', {
        id: this.activeProject.id,
        settings: settings
      });
      this.isEditNorthStarOpen = false;
    },
    handleCreateMilestone() {
      if (!this.newMilestone.name) return;
      this.$emit('create-milestone', {
        ...this.newMilestone,
        project: this.activeProject ? this.activeProject.id : null
      });
      this.newMilestone = { name: '', description: '', target_date: '', status: 'planned' };
      this.isNewMilestoneOpen = false;
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] space-y-4 select-none">
      <!-- 1. North Star Banner -->
      <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div class="space-y-1 max-w-3xl">
            <div class="flex items-center space-x-2">
              <span class="text-base">🧭</span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">North Star Roadmap</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                {{ northStar.target_quarter }}
              </span>
            </div>
            <h2 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{{ northStar.vision }}</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{{ northStar.objective }}</p>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <button
              @click="openEditNorthStar"
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 transition-colors"
            >
              Edit Vision
            </button>
            <button
              @click="isNewMilestoneOpen = true"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-2xs transition-colors flex items-center space-x-1.5"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Milestone</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Roadmap Grid by Status -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <!-- In Progress Milestones -->
        <div class="space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">In Progress</h3>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
              {{ groupedMilestones.in_progress.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.in_progress.length === 0" class="p-5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
            No active milestones in progress.
          </div>

          <div
            v-for="m in groupedMilestones.in_progress"
            :key="m.id"
            class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 shadow-2xs space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-0.5">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{{ m.name }}</h4>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{{ m.description }}</p>
              </div>
              <button @click="$emit('delete-milestone', m.id)" class="text-zinc-400 hover:text-red-500 p-0.5">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>Progress</span>
                <span class="text-zinc-900 dark:text-zinc-100 font-semibold">{{ m.progressPercent }}%</span>
              </div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-zinc-800 dark:bg-zinc-200 h-full rounded-full transition-all" :style="{ width: m.progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 font-mono">
              <span>{{ formatDate(m.target_date) }}</span>
              <span>{{ m.doneCount }}/{{ m.totalCount }} issues</span>
            </div>

            <!-- Linked issues mini list -->
            <div v-if="m.linkedIssues && m.linkedIssues.length" class="space-y-1 pt-1">
              <div
                v-for="iss in m.linkedIssues"
                :key="iss.id"
                @click="$emit('open-issue', iss)"
                class="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between text-xs cursor-pointer border border-zinc-200 dark:border-zinc-800"
              >
                <div class="flex items-center space-x-1.5 truncate">
                  <span class="font-mono text-[11px] text-zinc-500">{{ iss.identifier }}</span>
                  <span class="text-zinc-800 dark:text-zinc-200 truncate font-medium">{{ iss.title }}</span>
                </div>
                <span
                  class="text-[9px] px-1 py-0.5 rounded font-mono shrink-0"
                  :class="iss.status === 'done' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'"
                >
                  {{ iss.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Planned Milestones -->
        <div class="space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-zinc-400"></span>
              <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Planned</h3>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
              {{ groupedMilestones.planned.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.planned.length === 0" class="p-5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
            No planned milestones.
          </div>

          <div
            v-for="m in groupedMilestones.planned"
            :key="m.id"
            class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 shadow-2xs space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-0.5">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{{ m.name }}</h4>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{{ m.description }}</p>
              </div>
              <button @click="$emit('delete-milestone', m.id)" class="text-zinc-400 hover:text-red-500 p-0.5">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>Progress</span>
                <span class="text-zinc-900 dark:text-zinc-100 font-semibold">{{ m.progressPercent }}%</span>
              </div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-zinc-800 dark:bg-zinc-200 h-full rounded-full transition-all" :style="{ width: m.progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 font-mono">
              <span>{{ formatDate(m.target_date) }}</span>
              <span>{{ m.doneCount }}/{{ m.totalCount }} issues</span>
            </div>
          </div>
        </div>

        <!-- Achieved Milestones -->
        <div class="space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Achieved</h3>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
              {{ groupedMilestones.achieved.length }}
            </span>
          </div>

          <div v-if="groupedMilestones.achieved.length === 0" class="p-5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
            No achieved milestones yet.
          </div>

          <div
            v-for="m in groupedMilestones.achieved"
            :key="m.id"
            class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 shadow-2xs space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-0.5">
                <div class="flex items-center space-x-1.5">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-500"></i>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{{ m.name }}</h4>
                </div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{{ m.description }}</p>
              </div>
            </div>

            <div class="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div class="h-full bg-emerald-500 w-full"></div>
            </div>

            <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 font-mono">
              <span>{{ formatDate(m.target_date) }}</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-semibold">100% complete</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Milestone Modal -->
      <div v-if="isNewMilestoneOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
        <div class="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Create New Milestone</h3>
            <button @click="isNewMilestoneOpen = false" class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="space-y-3 text-xs select-text">
            <div>
              <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Milestone Name</label>
              <input v-model="newMilestone.name" type="text" placeholder="e.g. M2: Zero-Build Fast View Parity" class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400" />
            </div>

            <div>
              <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description & Scope</label>
              <textarea v-model="newMilestone.description" rows="2" placeholder="Target features and deliverables..." class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Target Date</label>
                <input v-model="newMilestone.target_date" type="date" class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400" />
              </div>
              <div>
                <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Status</label>
                <select v-model="newMilestone.status" class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="achieved">Achieved</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button @click="isNewMilestoneOpen = false" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
            <button @click="handleCreateMilestone" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-2xs">Create Milestone</button>
          </div>
        </div>
      </div>

      <!-- Edit North Star Modal -->
      <div v-if="isEditNorthStarOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
        <div class="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Edit North Star Objective</h3>
            <button @click="isEditNorthStarOpen = false" class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="space-y-3 text-xs select-text">
            <div>
              <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">North Star Vision</label>
              <textarea v-model="northStarForm.vision" rows="2" placeholder="High level strategic purpose..." class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"></textarea>
            </div>

            <div>
              <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Concrete Objective</label>
              <textarea v-model="northStarForm.objective" rows="2" placeholder="Measurable targets..." class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"></textarea>
            </div>

            <div>
              <label class="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Target Horizon</label>
              <input v-model="northStarForm.target_quarter" type="text" placeholder="e.g. Q4 2026" class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400" />
            </div>
          </div>

          <div class="flex justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button @click="isEditNorthStarOpen = false" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
            <button @click="saveNorthStar" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-2xs">Save North Star</button>
          </div>
        </div>
      </div>
    </div>
  `
};
