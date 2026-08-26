// pb_public/js/components/StatsView.js
// Minimalist, high-density Analytics and Stats View supporting Dark and Light themes.

const StatsViewComponent = {
  props: ['issues', 'projects', 'cycles'],
  data() {
    return {
      stats: null,
      activity: []
    };
  },
  async mounted() {
    await this.loadAnalytics();
  },
  methods: {
    async loadAnalytics() {
      try {
        this.stats = await API.getStats();
        const actRes = await API.getActivity();
        this.activity = actRes ? actRes.items : [];
      } catch (err) {
        console.error('Analytics load error:', err);
      }
    },
    formatTime(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">System Analytics & Velocity</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Workspace health, task distribution, and agent audit trail</p>
          </div>
          <button
            @click="loadAnalytics"
            class="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 transition-colors shadow-2xs"
          >
            Refresh
          </button>
        </div>

        <!-- Metric KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Total Issues</span>
              <i data-lucide="layers" class="w-4 h-4 text-zinc-400"></i>
            </div>
            <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              {{ stats ? stats.total_issues : issues.length }}
            </div>
            <div class="text-[10px] text-zinc-400 mt-0.5">{{ projects.length }} active projects</div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Completion Rate</span>
              <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i>
            </div>
            <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {{ stats ? stats.completion_rate_percent : 0 }}%
            </div>
            <div class="text-[10px] text-zinc-400 mt-0.5">
              {{ issues.filter(i => i.status === 'done').length }} resolved
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Velocity (Points)</span>
              <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
            </div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {{ stats ? stats.completed_estimate : 0 }} / {{ stats ? stats.total_estimate : 0 }}
            </div>
            <div class="text-[10px] text-zinc-400 mt-0.5">Story points delivered</div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Active Sprints</span>
              <i data-lucide="refresh-cw" class="w-4 h-4 text-zinc-400"></i>
            </div>
            <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              {{ cycles.filter(c => c.status === 'active').length }}
            </div>
            <div class="text-[10px] text-zinc-400 mt-0.5">{{ cycles.length }} total cycles</div>
          </div>
        </div>

        <!-- Breakdown & Activity Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

          <!-- Status Distribution Card -->
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
            <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status Distribution</h3>

            <div class="space-y-2">
              <div v-for="(count, status) in (stats ? stats.status_breakdown : {})" :key="status" class="space-y-1">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-zinc-700 dark:text-zinc-300 capitalize">{{ status.replace('_', ' ') }}</span>
                  <span class="text-zinc-400">{{ count }} ({{ issues.length > 0 ? Math.round((count/issues.length)*100) : 0 }}%)</span>
                </div>
                <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="{
                      'bg-zinc-400': status === 'backlog',
                      'bg-zinc-600 dark:bg-zinc-300': status === 'todo',
                      'bg-sky-500': status === 'in_progress',
                      'bg-amber-500': status === 'in_review',
                      'bg-emerald-500': status === 'done',
                      'bg-red-500': status === 'cancelled'
                    }"
                    :style="{ width: (issues.length > 0 ? (count/issues.length)*100 : 0) + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Priority Distribution Card -->
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
            <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Priority Distribution</h3>

            <div class="grid grid-cols-2 gap-2.5">
              <div v-for="(count, prio) in (stats ? stats.priority_breakdown : {})" :key="prio" class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] font-medium text-zinc-500 capitalize">{{ prio }}</div>
                <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">{{ count }}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Activity Audit Stream -->
        <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Live Activity Stream</h3>
            <span class="text-[10px] font-mono text-zinc-400">{{ activity.length }} events</span>
          </div>

          <div class="space-y-1.5 select-text">
            <div
              v-for="act in activity"
              :key="act.id"
              class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
            >
              <div class="flex items-center space-x-2">
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700/60">{{ act.actor_type }}</span>
                <span class="text-zinc-900 dark:text-zinc-100 font-medium">{{ act.actor }}</span>
                <span class="text-zinc-500">{{ act.action }} issue</span>
              </div>
              <span class="text-zinc-400 font-mono text-[10px]">{{ formatTime(act.created) }}</span>
            </div>

            <div v-if="activity.length === 0" class="py-6 text-center text-zinc-400 text-xs">
              No recent activity recorded yet.
            </div>
          </div>
        </div>

      </div>
    </div>
  `
};
