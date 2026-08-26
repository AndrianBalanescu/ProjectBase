// pb_public/js/components/CyclesView.js
// Minimalist, high-density Cycles/Sprints View supporting Dark and Light themes.

const CyclesViewComponent = {
  props: ['cycles', 'issues', 'projects', 'currentProject', 'selectedCycleId'],
  emits: ['open-issue', 'open-new-cycle', 'update-cycle', 'delete-cycle', 'update:selectedCycleId'],
  data() {
    return {
      aiSummary: '',
      aiSummaryLoading: false,
      aiSummaryError: ''
    };
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
    },
    renderCycleSummary() {
      if (!this.aiSummary) return '<p class="text-zinc-400 italic text-xs">No summary yet. Generate one to see sprint insights.</p>';
      if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(this.aiSummary));
      }
      return this.aiSummary.replace(/\n/g, '<br>');
    },
    async generateCycleSummary() {
      if (!this.currentCycle) return;
      if (this.aiSummaryLoading) return;
      const list = this.cycleIssues;
      this.aiSummary = '';
      this.aiSummaryError = '';
      this.aiSummaryLoading = true;
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof pb !== 'undefined' && pb.authStore && pb.authStore.token) {
          headers['Authorization'] = pb.authStore.token;
        }
        const issuesPayload = list.map(i => ({
          identifier: i.identifier || '',
          title: i.title || '',
          status: i.status || '',
          priority: i.priority || '',
          estimate: i.estimate || null
        }));
        const res = await fetch('/api/projectbase/ai-assist', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'summarize_cycle',
            title: this.currentCycle.name,
            description: this.currentCycle.description || '',
            issues: issuesPayload
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate cycle summary');
        }
        this.aiSummary = data.summary || 'No summary returned.';
      } catch (err) {
        console.error('Cycle summary error:', err);
        this.aiSummaryError = err.message || 'Failed to generate summary.';
      } finally {
        this.aiSummaryLoading = false;
      }
    }
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

              <!-- AI Cycle Summary -->
              <div class="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5 text-zinc-500"></i>
                    <span>AI Sprint Summary</span>
                  </h4>
                  <button
                    @click="generateCycleSummary"
                    :disabled="aiSummaryLoading"
                    class="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700/60 transition-colors disabled:opacity-40"
                  >
                    <i data-lucide="wand-2" class="w-3 h-3"></i>
                    <span>{{ aiSummaryLoading ? 'Generating…' : 'Generate' }}</span>
                  </button>
                </div>

                <div v-if="aiSummaryLoading" class="flex items-center space-x-2 text-xs text-zinc-400 py-2">
                  <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
                  <span>Analyzing sprint issues…</span>
                </div>

                <div v-else-if="aiSummaryError" class="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs">
                  {{ aiSummaryError }}
                </div>

                <div v-else class="text-xs text-zinc-800 dark:text-zinc-200 markdown-body select-text" v-html="renderCycleSummary()"></div>
              </div>

              <!-- Cycle Issues List -->
              <div class="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800 select-text">
                <h4 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Issues in this Cycle</h4>

                <div class="space-y-1">
                  <div
                    v-for="issue in cycleIssues"
                    :key="issue.id"
                    @click="$emit('open-issue', issue)"
                    class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div class="flex items-center space-x-2 min-w-0">
                      <span class="font-mono text-xs text-zinc-500 font-semibold">{{ issue.identifier }}</span>
                      <span class="text-xs text-zinc-800 dark:text-zinc-200 truncate font-medium">{{ issue.title }}</span>
                    </div>

                    <div class="flex items-center space-x-2 shrink-0">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-medium" :class="issue.status === 'done' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'">
                        {{ issue.status }}
                      </span>
                      <span v-if="issue.estimate" class="text-[10px] font-mono text-zinc-400">{{ issue.estimate }} pts</span>
                    </div>
                  </div>

                  <div v-if="cycleIssues.length === 0" class="py-6 text-center text-zinc-400 text-xs">
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
