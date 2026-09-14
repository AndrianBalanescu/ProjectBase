// pb_public/js/components/CyclesView.js
// Minimalist, high-density Cycles/Sprints View supporting Dark and Light themes.

const CyclesViewComponent = {
  props: ['cycles', 'issues', 'projects', 'currentProject', 'selectedCycleId'],
  emits: ['open-issue', 'open-new-cycle', 'update-cycle', 'delete-cycle', 'update:selectedCycleId'],
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
    // Burndown is a reactive COMPUTED (not a data prop + watcher): it
    // recomputes automatically whenever currentCycle, issues, or their
    // completion timestamps change — so the chart is correct on first paint
    // even when the parent loads cycles/issues asynchronously after mount.
    burndownChart() {
      const cycle = this.currentCycle;
      if (!cycle) return null;
      const c0 = cycle.start_date ? new Date(cycle.start_date) : null;
      const c1 = cycle.end_date ? new Date(cycle.end_date) : null;
      if (!c0 || !c1 || isNaN(c0) || isNaN(c1)) {
        return { supported: false, reason: 'This cycle needs start and end dates to compute a burndown.' };
      }
      const list = this.cycleIssues;
      const totalDuration = Math.max((c1 - c0) / 86400000, 1);
      const totalDays = Math.ceil(totalDuration);
      const nowMs = Date.now();
      const totalPts = list.reduce((s, i) => s + (Number(i.estimate) || 0), 0);
      if (totalPts <= 0) {
        return { supported: false, reason: 'Add story-point estimates to issues in this cycle to see a burndown.' };
      }
      const doneTime = (i) => {
        if (i.status === 'done' && i.done_at) return new Date(i.done_at).getTime();
        if (i.status === 'done' && i.updated) return new Date(i.updated).getTime();
        return null;
      };
      const idealAt = (d) => totalPts * (1 - d / totalDuration);
      const days = [];
      for (let d = 0; d <= totalDays; d++) {
        const dayMs = c0.getTime() + d * 86400000;
        const ideal = idealAt(d);
        let remaining = totalPts;
        if (dayMs < nowMs || dayMs === c1.getTime()) {
          remaining = list.reduce((s, i) => {
            const dt = doneTime(i);
            return (dt === null || dt > dayMs) ? s + (Number(i.estimate) || 0) : s;
          }, 0);
        }
        days.push({
          label: new Date(dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ideal: Math.round(ideal * 10) / 10,
          actual: (dayMs < nowMs || dayMs === c1.getTime()) ? remaining : null
        });
      }
      const avgDaily = totalPts / totalDays;
      return { supported: true, totalDays, totalPts, avgDaily: Math.round(avgDaily * 10) / 10, days };
    },
    // Velocity = story points delivered by COMPLETED cycles, oldest first.
    velocityData() {
      const done = this.cycles
        .filter(c => c.status === 'completed')
        .map(c => {
          const list = this.issues.filter(i => i.cycle === c.id);
          const pts = list.filter(i => i.status === 'done').reduce((s, i) => s + (Number(i.estimate) || 0), 0);
          const count = list.filter(i => i.status === 'done').length;
          return { id: c.id, name: c.name, end: c.end_date || c.updated || c.created, pts, count };
        })
        .sort((a, b) => new Date(a.end) - new Date(b.end));
      return done.slice(-6);
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
    burndownSvg() {
      if (!this.burndownChart || !this.burndownChart.supported) return '';
      const W = 560, H = 150, P = 24;
      const pts = this.burndownChart.days;
      const n = pts.length;
      const maxY = Math.max(this.burndownChart.totalPts, 1);
      const x = d => P + (n > 1 ? (d / (n - 1)) * (W - 2 * P) : 0);
      const y = v => H - P - (Math.min(v, maxY) / maxY) * (H - 2 * P);
      const idealPts = pts.map((p, d) => `${x(d)},${y(p.ideal)}`).join(' ');
      const actualPts = pts.map((p, d) => p.actual === null ? null : `${x(d)},${y(p.actual)}`).filter(Boolean).join(' ');
      const grid = [0.25, 0.5, 0.75].map(f => {
        const gy = H - P - f * (H - 2 * P);
        return `<line x1="${P}" y1="${gy}" x2="${W - P}" y2="${gy}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3 3"/>`;
      }).join('');
      const labels = n > 1 ? `<text x="${P}" y="${H - 6}" font-size="9" fill="currentColor" opacity="0.5">${pts[0].label}</text><text x="${W - P}" y="${H - 6}" font-size="9" fill="currentColor" opacity="0.5" text-anchor="end">${pts[n - 1].label}</text>` : '';
      return `<svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="Cycle burndown chart">
${grid}<polyline points="${idealPts}" fill="none" stroke="#a1a1aa" stroke-width="1.5" stroke-dasharray="4 4"/><polyline points="${actualPts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>${labels}</svg>`;
    },
    formatDateRange(start, end) {
      if (!start) return 'No dates set';
      const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing';
      return `${s} – ${e}`;
    },

  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Sprint Cycles</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Time-boxed iterations, burndown velocity, and sprint goals</p>
          </div>

          <button
            @click="$emit('open-new-cycle')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>New Cycle</span>
          </button>
        </div>

        <!-- Main Layout: Sprints List (Left) + Detail & Burndown (Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

          <!-- Left: Cycles List -->
          <div class="space-y-2">
            <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">All Cycles</h3>

            <div class="space-y-2">
              <div
                v-for="c in cycles"
                :key="c.id"
                @click="$emit('update:selectedCycleId', c.id)"
                class="p-3.5 rounded-xl border transition-all cursor-pointer"
                :class="currentCycle && currentCycle.id === c.id ? 'bg-white dark:bg-[#121215] border-zinc-400 dark:border-zinc-600 shadow-sm' : 'bg-white/70 dark:bg-[#121215]/60 hover:bg-white dark:hover:bg-[#121215] border-zinc-200 dark:border-zinc-800'"
              >
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ c.name }}</h4>
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    :class="{
                      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40': c.status === 'active',
                      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60': c.status === 'upcoming',
                      'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800': c.status === 'completed'
                    }"
                  >
                    {{ c.status }}
                  </span>
                </div>
                <div class="flex items-center space-x-1 text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                  <i data-lucide="calendar" class="w-3 h-3"></i>
                  <span>{{ formatDateRange(c.start_date, c.end_date) }}</span>
                </div>
              </div>

              <div v-if="cycles.length === 0" class="py-8 text-center text-zinc-400 text-xs">
                No cycles created yet.
              </div>
            </div>
          </div>

          <!-- Right: Selected Cycle Deep Dive & Issues -->
          <div class="lg:col-span-2 space-y-4">
            <div v-if="currentCycle" class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">

              <!-- Banner Info -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center space-x-2">
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ currentCycle.name }}</h3>
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      :class="{
                        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40': currentCycle.status === 'active',
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60': currentCycle.status === 'upcoming',
                        'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800': currentCycle.status === 'completed'
                      }"
                    >
                      {{ currentCycle.status }}
                    </span>
                  </div>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{{ currentCycle.description || 'No description provided.' }}</p>
                  <p class="text-[11px] text-zinc-400 mt-1 font-mono">
                    {{ formatDateRange(currentCycle.start_date, currentCycle.end_date) }}
                  </p>
                </div>

                <div class="flex items-center space-x-1.5">
                  <button
                    @click="$emit('delete-cycle', currentCycle.id)"
                    class="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Delete Cycle"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>

              <!-- Metrics Row -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Issues</span>
                  <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">{{ cycleStats.total }}</div>
                </div>

                <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Completed</span>
                  <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{{ cycleStats.done }}</div>
                </div>

                <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Story Points</span>
                  <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">{{ cycleStats.donePts }} / {{ cycleStats.totalPts }}</div>
                </div>

                <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Completion</span>
                  <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">{{ cycleStats.percent }}%</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="space-y-1">
                <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div class="bg-zinc-800 dark:bg-zinc-200 h-full rounded-full transition-all" :style="{ width: cycleStats.percent + '%' }"></div>
                </div>
              </div>

              <!-- Burndown & Velocity -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div class="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <div class="flex items-center justify-between mb-1.5">
                    <h4 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <i data-lucide="trending-down" class="w-3.5 h-3.5"></i>
                      <span>Burndown</span>
                    </h4>
                    <div v-if="burndownChart && burndownChart.supported" class="flex items-center space-x-2 text-[10px] text-zinc-400">
                      <span class="flex items-center space-x-1"><span class="w-3 h-0.5 bg-zinc-400 inline-block" style="border-top:1px dashed currentColor"></span>ideal</span>
                      <span class="flex items-center space-x-1"><span class="w-3 h-0.5 bg-blue-500 inline-block"></span>actual</span>
                    </div>
                  </div>
                  <div v-if="burndownChart && burndownChart.supported" class="text-blue-500" v-html="burndownSvg"></div>
                  <div v-else class="py-4 text-center text-xs text-zinc-400">
                    {{ (burndownChart && burndownChart.reason) || 'Add start/end dates and story-point estimates to see the burndown.' }}
                  </div>
                  <div v-if="burndownChart && burndownChart.supported" class="mt-1.5 text-[10px] text-zinc-400 font-mono">
                    {{ burndownChart.totalPts }} pts over {{ burndownChart.totalDays }} days (~{{ burndownChart.avgDaily }} pts/day)
                  </div>
                </div>

                <div class="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <h4 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                    <i data-lucide="activity" class="w-3.5 h-3.5"></i>
                    <span>Velocity Trend</span>
                  </h4>
                  <div v-if="velocityData.length === 0" class="py-4 text-center text-xs text-zinc-400">
                    No completed cycles yet — velocity appears once a cycle is marked completed.
                  </div>
                  <div v-else class="flex items-end justify-around gap-2 h-20 pb-4 relative">
                    <div v-for="v in velocityData" :key="v.id" class="flex flex-col items-center flex-1 min-w-0" :title="v.name + ': ' + v.pts + ' pts (' + v.count + ' issues)'">
                      <div class="w-full max-w-[36px] bg-blue-500/80 dark:bg-blue-400/70 rounded-t transition-all" :style="{ height: (v.pts / Math.max(...velocityData.map(x => x.pts), 1)) * 100 + '%' }"></div>
                      <span class="text-[9px] font-mono text-zinc-500 mt-1 truncate w-full text-center">{{ v.pts }}p</span>
                      <span class="text-[9px] text-zinc-400 truncate w-full text-center">{{ v.name }}</span>
                    </div>
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
