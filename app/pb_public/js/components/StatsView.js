// pb_public/js/components/StatsView.js

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
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div>
          <h2 class="text-xl font-bold text-white tracking-tight">System & Velocity Analytics</h2>
          <p class="text-xs text-gray-400">Workspace health, task distribution, and agent activity stream</p>
        </div>

        <!-- Metric KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Total Issues</span>
              <i data-lucide="layers" class="w-4 h-4 text-indigo-400"></i>
            </div>
            <div class="text-2xl font-bold text-white mt-2 font-mono">{{ issues.length }}</div>
            <div class="text-[11px] text-gray-500 mt-1">Across {{ projects.length }} active projects</div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Completion Rate</span>
              <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
            </div>
            <div class="text-2xl font-bold text-emerald-400 mt-2 font-mono">
              {{ stats ? stats.completion_rate_percent : 0 }}%
            </div>
            <div class="text-[11px] text-gray-500 mt-1">
              {{ issues.filter(i => i.status === 'done').length }} resolved
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Velocity (Points)</span>
              <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
            </div>
            <div class="text-2xl font-bold text-amber-400 mt-2 font-mono">
              {{ stats ? stats.completed_estimate : 0 }} / {{ stats ? stats.total_estimate : 0 }}
            </div>
            <div class="text-[11px] text-gray-500 mt-1">Story points delivered</div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Active Sprints</span>
              <i data-lucide="refresh-cw" class="w-4 h-4 text-purple-400"></i>
            </div>
            <div class="text-2xl font-bold text-purple-400 mt-2 font-mono">
              {{ cycles.filter(c => c.status === 'active').length }}
            </div>
            <div class="text-[11px] text-gray-500 mt-1">{{ cycles.length }} total cycles</div>
          </div>
        </div>

        <!-- Breakdown & Activity Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Status Distribution Card -->
          <div class="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-4">
            <h3 class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Status Distribution</h3>
            
            <div class="space-y-2.5">
              <div v-for="(count, status) in (stats ? stats.status_breakdown : {})" :key="status" class="space-y-1">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-gray-300 capitalize">{{ status.replace('_', ' ') }}</span>
                  <span class="text-gray-400">{{ count }} ({{ issues.length > 0 ? Math.round((count/issues.length)*100) : 0 }}%)</span>
                </div>
                <div class="w-full bg-gray-950 rounded-full h-2 overflow-hidden">
                  <div 
                    class="h-full rounded-full transition-all"
                    :class="{
                      'bg-gray-500': status === 'backlog',
                      'bg-purple-500': status === 'todo',
                      'bg-blue-500': status === 'in_progress',
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
          <div class="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-4">
            <h3 class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Priority Distribution</h3>
            
            <div class="grid grid-cols-2 gap-3">
              <div v-for="(count, prio) in (stats ? stats.priority_breakdown : {})" :key="prio" class="p-3 rounded-xl bg-gray-950/60 border border-gray-800/80">
                <div class="text-[11px] font-medium text-gray-400 capitalize">{{ prio }}</div>
                <div class="text-xl font-bold text-white font-mono mt-1">{{ count }}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Activity Audit Stream -->
        <div class="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Live Activity Stream</h3>
            <button @click="loadAnalytics" class="text-xs text-indigo-400 hover:underline">Refresh</button>
          </div>

          <div class="space-y-2">
            <div 
              v-for="act in activity" 
              :key="act.id"
              class="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800/60 flex items-center justify-between text-xs"
            >
              <div class="flex items-center space-x-2">
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 font-mono">{{ act.actor_type }}</span>
                <span class="text-gray-300 font-medium">{{ act.actor }}</span>
                <span class="text-gray-500">{{ act.action }} issue</span>
              </div>
              <span class="text-gray-500 font-mono text-[11px]">{{ formatTime(act.created) }}</span>
            </div>

            <div v-if="activity.length === 0" class="py-6 text-center text-gray-500 text-xs">
              No recent activity recorded yet.
            </div>
          </div>
        </div>

      </div>
    </div>
  `
};
