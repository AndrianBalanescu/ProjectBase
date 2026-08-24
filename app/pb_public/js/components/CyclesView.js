// pb_public/js/components/CyclesView.js

const CyclesViewComponent = {
  props: ['cycles', 'issues', 'projects', 'currentProject', 'selectedCycleId'],
  emits: ['open-issue', 'open-new-cycle', 'update-cycle', 'delete-cycle', 'update:selectedCycleId'],
  data() {
    return {};
  },
  computed: {
    activeCycle() {
      return this.cycles.find(c => c.status === 'active') || (this.cycles.length > 0 ? this.cycles[0] : null);
    },
    currentCycle() {
      if (this.selectedCycleId) {
        return this.cycles.find(c => c.id === this.selectedCycleId) || this.activeCycle;
      }
      return this.activeCycle;
    },
    cycleIssues() {
      if (!this.currentCycle) return [];
      return this.issues.filter(i => i.cycle === this.currentCycle.id);
    },
    cycleStats() {
      const list = this.cycleIssues;
      const total = list.length;
      const done = list.filter(i => i.status === 'done').length;
      const inProgress = list.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
      const todo = list.filter(i => i.status === 'todo' || i.status === 'backlog').length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      const totalPts = list.reduce((s, i) => s + (Number(i.estimate) || 0), 0);
      const donePts = list.filter(i => i.status === 'done').reduce((s, i) => s + (Number(i.estimate) || 0), 0);

      return { total, done, inProgress, todo, percent, totalPts, donePts };
    }
  },
  methods: {
    formatDateRange(start, end) {
      if (!start) return 'No dates set';
      const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing';
      return `${s} – ${e}`;
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight">Cycles & Sprints</h2>
            <p class="text-xs text-gray-400">Timeboxed execution cycles and sprint velocity</p>
          </div>

          <button 
            @click="$emit('open-new-cycle')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Create Cycle</span>
          </button>
        </div>

        <!-- No cycles state -->
        <div v-if="cycles.length === 0" class="p-12 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-900/40">
          <i data-lucide="refresh-cw" class="w-10 h-10 mx-auto text-gray-600 mb-3"></i>
          <h3 class="text-base font-semibold text-gray-200">No Cycles Configured</h3>
          <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Create timeboxed sprints to organize your team and agent execution milestones.</p>
          <button 
            @click="$emit('open-new-cycle')" 
            class="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            Create First Cycle
          </button>
        </div>

        <!-- Main Cycle Layout -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Left: Cycles List & Selector -->
          <div class="space-y-3">
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">All Cycles</h3>
            <div class="space-y-2">
              <div 
                v-for="c in cycles" 
                :key="c.id"
                @click="$emit('update:selectedCycleId', c.id)"
                class="p-3.5 rounded-xl border transition-all cursor-pointer select-none"
                :class="(currentCycle && currentCycle.id === c.id) ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10' : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-white truncate">{{ c.name }}</span>
                  <span 
                    class="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                    :class="{
                      'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40': c.status === 'active',
                      'bg-purple-950/60 text-purple-400 border border-purple-800/40': c.status === 'upcoming',
                      'bg-gray-800 text-gray-400 border border-gray-700': c.status === 'completed'
                    }"
                  >
                    {{ c.status }}
                  </span>
                </div>
                <div class="flex items-center space-x-1 text-[11px] text-gray-400 mt-2">
                  <i data-lucide="calendar" class="w-3 h-3"></i>
                  <span>{{ formatDateRange(c.start_date, c.end_date) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Selected Cycle Deep Dive & Issues -->
          <div class="lg:col-span-2 space-y-6">
            <div v-if="currentCycle" class="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6">
              
              <!-- Banner Info -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="flex items-center space-x-2">
                    <h3 class="text-lg font-bold text-white">{{ currentCycle.name }}</h3>
                    <span 
                      class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      :class="{
                        'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40': currentCycle.status === 'active',
                        'bg-purple-950/60 text-purple-400 border border-purple-800/40': currentCycle.status === 'upcoming',
                        'bg-gray-800 text-gray-400 border border-gray-700': currentCycle.status === 'completed'
                      }"
                    >
                      {{ currentCycle.status }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">{{ currentCycle.description || 'No description provided.' }}</p>
                  <p class="text-[11px] text-indigo-400 font-mono mt-1">{{ formatDateRange(currentCycle.start_date, currentCycle.end_date) }}</p>
                </div>

                <!-- Progress Ring / Stats Box -->
                <div class="flex items-center space-x-4 bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <div class="text-center">
                    <div class="text-lg font-bold text-white font-mono">{{ cycleStats.percent }}%</div>
                    <div class="text-[10px] text-gray-500 uppercase font-semibold">Done</div>
                  </div>
                  <div class="h-8 w-px bg-gray-800"></div>
                  <div class="text-center">
                    <div class="text-lg font-bold text-indigo-400 font-mono">{{ cycleStats.donePts }}/{{ cycleStats.totalPts }}</div>
                    <div class="text-[10px] text-gray-500 uppercase font-semibold">Points</div>
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
                  <span>Progress Breakdown</span>
                  <span>{{ cycleStats.done }} of {{ cycleStats.total }} completed</span>
                </div>
                <div class="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden flex">
                  <div class="bg-emerald-500 h-full transition-all" :style="{ width: cycleStats.percent + '%' }"></div>
                  <div class="bg-blue-500 h-full transition-all" :style="{ width: (cycleStats.total > 0 ? (cycleStats.inProgress/cycleStats.total)*100 : 0) + '%' }"></div>
                </div>
              </div>

              <!-- Cycle Issues List -->
              <div class="space-y-3 pt-4 border-t border-gray-800">
                <h4 class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Issues in this Cycle</h4>
                
                <div class="space-y-1.5">
                  <div 
                    v-for="issue in cycleIssues" 
                    :key="issue.id"
                    @click="$emit('open-issue', issue)"
                    class="p-2.5 rounded-lg bg-gray-950/60 hover:bg-gray-800/60 border border-gray-800/80 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div class="flex items-center space-x-2.5 min-w-0">
                      <span class="font-mono text-xs text-indigo-400 font-semibold">{{ issue.identifier }}</span>
                      <span class="text-xs text-gray-200 truncate">{{ issue.title }}</span>
                    </div>

                    <div class="flex items-center space-x-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-medium" :class="issue.status === 'done' ? 'bg-emerald-950 text-emerald-400' : 'bg-gray-800 text-gray-400'">
                        {{ issue.status }}
                      </span>
                      <span v-if="issue.estimate" class="text-[10px] font-mono text-gray-500">{{ issue.estimate }} pts</span>
                    </div>
                  </div>

                  <div v-if="cycleIssues.length === 0" class="py-8 text-center text-gray-500 text-xs">
                    No issues assigned to this cycle yet.
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  `
};
