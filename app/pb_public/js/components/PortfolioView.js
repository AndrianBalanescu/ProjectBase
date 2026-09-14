// pb_public/js/components/PortfolioView.js
// Minimalist, high-density Portfolio Dashboard supporting Dark and Light themes.

const PortfolioViewComponent = {
  props: ['projects', 'issues', 'milestones', 'realtimeTick'],
  emits: ['select-project'],
  data() {
    return {
      allProjects: this.projects || [],
      allIssues: [],
      allMilestones: [],
      loaded: false,
      refreshTimer: null
    };
  },
  async mounted() {
    await this.refresh();
  },
  beforeUnmount() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  },
  watch: {
    projects(v) { this.allProjects = v || []; },
    realtimeTick() {
      this.scheduleRefresh();
    },
    issues() { this.scheduleRefresh(); },
    milestones() { this.scheduleRefresh(); }
  },
  methods: {
    scheduleRefresh() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.refresh(), 200);
    },
    async refresh() {
      try {
        const [projRes, issRes, msRes] = await Promise.all([
          API.getProjects().catch(() => this.projects || []),
          API.getIssues(null, 1, 500).catch(() => this.issues || []),
          API.getMilestones(null).catch(() => this.milestones || [])
        ]);
        this.allProjects = Array.isArray(projRes) ? projRes : (projRes?.items || this.projects || []);
        this.allIssues = Array.isArray(issRes) ? issRes : (issRes?.items || this.issues || []);
        this.allMilestones = Array.isArray(msRes) ? msRes : (msRes?.items || this.milestones || []);
      } catch (err) {
        console.error('PortfolioView refresh error:', err);
        this.allProjects = this.projects || [];
        this.allIssues = this.issues || [];
        this.allMilestones = this.milestones || [];
      } finally {
        this.loaded = true;
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    },
    mergeScopedIssues(projId, scoped) {
      const rest = this.allIssues.filter(i => i.project !== projId);
      this.allIssues = [...rest, ...scoped];
    },
    mergeScopedMilestones(projId, scoped) {
      const rest = this.allMilestones.filter(m => m.project && m.project !== projId);
      this.allMilestones = [...rest, ...scoped];
    },
    openProject(p) {
      if (p) this.$emit('select-project', p);
    },
    fmtTarget(t) {
      if (!t) return '—';
      const d = new Date(t);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    statusDot(m) {
      if (m.isDone) return 'bg-emerald-500';
      if (m.isOverdue) return 'bg-rose-500';
      return 'bg-zinc-400 dark:bg-zinc-600';
    }
  },
  computed: {
    totalIssues() {
      return this.allIssues.length;
    },
    doneCount() {
      return this.allIssues.filter(i => i.status === 'done').length;
    },
    inFlightCount() {
      return this.allIssues.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
    },
    openCount() {
      return this.allIssues.filter(i => i.status !== 'done' && i.status !== 'cancelled').length;
    },
    totalEstimate() {
      return this.allIssues
        .filter(i => i.status === 'in_progress' || i.status === 'in_review' || i.status === 'todo')
        .reduce((sum, i) => sum + (Number(i.estimate) || 0), 0);
    },
    completionPercent() {
      if (this.totalIssues === 0) return 0;
      return Math.round((this.doneCount / this.totalIssues) * 100);
    },
    projectRows() {
      return this.allProjects.map(p => {
        const pIssues = this.allIssues.filter(i => i.project === p.id);
        const total = pIssues.length;
        const done = pIssues.filter(i => i.status === 'done').length;
        const inFlight = pIssues.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return { ...p, total, done, inFlight, percent };
      }).sort((a, b) => b.total - a.total || b.percent - a.percent);
    },
    milestoneRows() {
      const now = Date.now();
      const mapped = this.allMilestones.map(m => {
        const p = this.allProjects.find(x => x.id === m.project);
        const target = m.target_date ? new Date(m.target_date).getTime() : null;
        const mIssues = this.allIssues.filter(i => i.milestone === m.id);
        const done = mIssues.filter(i => i.status === 'done').length;
        const percent = mIssues.length > 0
          ? Math.round((done / mIssues.length) * 100)
          : (m.status === 'achieved' ? 100 : 0);
        const isDone = m.status === 'done' || m.status === 'achieved';
        const isOverdue = target !== null && target < now && !isDone;
        return { ...m, project: p, target, done, total: mIssues.length, percent, isOverdue, isDone };
      });
      return mapped
        .filter(m => !m.isDone || m.total > 0)
        .sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
          return (a.target || Infinity) - (b.target || Infinity);
        });
    }
  },
  template: `
    <div class="pb-portfolio h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div v-if="!loaded" class="py-16 text-center text-zinc-400 text-xs">Loading workspace snapshot…</div>
      <div v-else class="w-full space-y-4">

        <!-- Header -->
        <div>
          <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Portfolio Dashboard</h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Cross-project progress, capacity and roadmap health at a glance</p>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Total Issues</span>
              <i data-lucide="layers" class="w-4 h-4 text-zinc-400"></i>
            </div>
            <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">{{ totalIssues }}</div>
            <div class="text-[10px] text-zinc-400 mt-0.5">Across {{ allProjects.length }} projects</div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Completion</span>
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>
            </div>
            <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{{ completionPercent }}%</div>
            <div class="text-[10px] text-zinc-400 mt-0.5">{{ doneCount }} of {{ totalIssues }} done</div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>In Flight</span>
              <i data-lucide="loader" class="w-4 h-4 text-sky-500"></i>
            </div>
            <div class="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">{{ inFlightCount }}</div>
            <div class="text-[10px] text-zinc-400 mt-0.5">{{ openCount }} total open</div>
          </div>

          <div class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Estimate Load</span>
              <i data-lucide="gauge" class="w-4 h-4 text-amber-500"></i>
            </div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">{{ totalEstimate }}</div>
            <div class="text-[10px] text-zinc-400 mt-0.5">points in flight</div>
          </div>
        </div>

        <!-- Per-project progress -->
        <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project Progress</h3>
            <span class="text-[10px] text-zinc-400">Click a project to open its board</span>
          </div>

          <div v-if="projectRows.length === 0" class="py-6 text-center text-zinc-400 text-xs">
            No projects yet. Create a project to start tracking work.
          </div>

          <div class="space-y-1.5">
            <div
              v-for="p in projectRows"
              :key="p.id"
              @click="openProject(p)"
              role="button"
              tabindex="0"
              @keydown.enter="openProject(p)"
              class="group flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            >
              <div class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 shadow-2xs shrink-0">
                {{ p.icon || '📁' }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{{ p.name }}</span>
                  <span class="text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 px-1 rounded bg-white dark:bg-zinc-800">{{ p.identifier }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <div class="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all bg-zinc-800 dark:bg-zinc-200"
                      :style="{ width: p.percent + '%' }"
                    ></div>
                  </div>
                  <span class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-8 text-right">{{ p.percent }}%</span>
                </div>
              </div>
              <div class="hidden sm:flex items-center gap-2 text-[10px] text-zinc-400 font-mono shrink-0">
                <span>{{ p.done }} done</span>
                <span>·</span>
                <span>{{ p.inFlight }} active</span>
                <span>·</span>
                <span>{{ p.total }} total</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Milestones panel -->
        <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
          <h3 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Milestones & Roadmap Health</h3>

          <div v-if="milestoneRows.length === 0" class="py-6 text-center text-zinc-400 text-xs">
            No milestones scheduled yet.
          </div>

          <div class="space-y-1.5">
            <div
              v-for="m in milestoneRows"
              :key="m.id"
              class="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs"
            >
              <span class="w-2 h-2 rounded-full shrink-0" :class="statusDot(m)"></span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{{ m.name }}</span>
                  <span
                    v-if="m.project"
                    class="text-[10px] font-mono px-1 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700/60"
                  >{{ m.project.identifier }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <div class="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="m.isOverdue ? 'bg-rose-500' : 'bg-zinc-800 dark:bg-zinc-200'"
                      :style="{ width: Math.max(m.percent, 3) + '%' }"
                    ></div>
                  </div>
                  <span class="text-[10px] font-mono text-zinc-400 w-8 text-right">{{ m.percent }}%</span>
                </div>
              </div>
              <div class="hidden sm:block shrink-0 text-[10px] font-mono">
                <span
                  :class="m.isOverdue ? 'text-rose-500' : 'text-zinc-400'"
                  v-if="!m.isDone"
                >{{ fmtTarget(m.target) }}</span>
                <span v-else class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Done</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
};
