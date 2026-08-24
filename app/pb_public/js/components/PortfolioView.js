// pb_public/js/components/PortfolioView.js
// ProjectBase — Portfolio Dashboard component (v1.1 "Next" after the Timeline view)
//
// Zero-build Vue 3 cross-project overview. Aggregates every project, issue,
// cycle and milestone into one at-a-glance dashboard:
//   - KPI cards: total issues, overall completion, open work, project count.
//   - A per-project progress list (done / in-progress / open) with a color
//     completion bar; clicking a row opens that project's board.
//   - A milestones panel that surfaces upcoming target dates and overdue
//     targets before they slip.
// All analytics are derived client-side from the same props the other views
// already receive (no extra backend round-trip), matching ProjectsView.

const PortfolioViewComponent = {
  props: ['projects', 'issues', 'milestones'],
  emits: ['select-project'],
  data() {
    return {
      allProjects: this.projects || [],
      allIssues: [],
      allMilestones: [],
      loaded: false
    };
  },
  async mounted() {
    await this.refresh();
  },
  watch: {
    projects(v) { this.allProjects = v || []; },
  },
  methods: {
    async refresh() {
      try {
        // Portfolio aggregates across every project, regardless of the active
        // project the shell scopes its `issues`/`milestones` to. Fetch a fresh
        // workspace snapshot (null project = all projects).
        const [issues, milestones] = await Promise.all([
          API.getIssues(null),
          API.getMilestones(null)
        ]);
        this.allIssues = issues;
        this.allMilestones = milestones;
        this.loaded = true;
      } catch (err) {
        console.error('Portfolio load error:', err);
      }
    },
    openProject(p) {
      this.$emit('select-project', p);
    },
    projectColor(p) {
      return p && p.color ? p.color : '#6366f1';
    },
    statusDot(m) {
      if (m.isDone) return 'bg-emerald-500';
      if (m.isOverdue) return 'bg-red-500';
      if (m.percent >= 100) return 'bg-emerald-500';
      if (m.percent >= 60) return 'bg-indigo-500';
      if (m.percent > 0) return 'bg-amber-500';
      return 'bg-gray-500';
    },
    fmtTarget(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / 86400000);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      if (diff < 0) return `${Math.abs(diff)}d overdue`;
      return `in ${diff}d · ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    },
  },
  computed: {
    // ---- Workspace-wide KPIs ------------------------------------------------
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
    completionPercent() {
      return this.totalIssues > 0 ? Math.round((this.doneCount / this.totalIssues) * 100) : 0;
    },
    totalEstimate() {
      return this.allIssues.reduce((s, i) => s + (Number(i.estimate) || 0), 0);
    },
    // ---- Per-project rows ----
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
    // ---- Milestones: upcoming & overdue, sorted by target date ----------
    milestoneRows() {
      const now = Date.now();
      const mapped = this.allMilestones.map(m => {
        const p = this.allProjects.find(x => x.id === m.project);
        const target = m.target_date ? new Date(m.target_date).getTime() : null;
        // count issues across all projects assigned to this milestone
        const mIssues = this.allIssues.filter(i => i.milestone === m.id);
        const done = mIssues.filter(i => i.status === 'done').length;
        // Achieved milestones are complete even when nothing is linked to them
        // (matches MilestonesView: `achieved` => 100% when no issues).
        const percent = mIssues.length > 0
          ? Math.round((done / mIssues.length) * 100)
          : (m.status === 'achieved' ? 100 : 0);
        const isDone = m.status === 'done' || m.status === 'achieved';
        const isOverdue = target !== null && target < now && !isDone;
        return { ...m, project: p, target, done, total: mIssues.length, percent, isOverdue, isDone };
      });
      // show overdue first, then upcoming (soonest target first), then done at the end
      return mapped
        .filter(m => !m.isDone || m.total > 0)
        .sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
          return (a.target || Infinity) - (b.target || Infinity);
        });
    },
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">

        <!-- Header -->
        <div>
          <h2 class="text-xl font-bold text-white tracking-tight">Portfolio Dashboard</h2>
          <p class="text-xs text-gray-400">Cross-project progress, capacity and roadmap health at a glance</p>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Total Issues</span>
              <i data-lucide="layers" class="w-4 h-4 text-indigo-400"></i>
            </div>
            <div class="text-2xl font-bold text-white mt-2 font-mono">{{ totalIssues }}</div>
            <div class="text-[11px] text-gray-500 mt-1">Across {{ allProjects.length }} projects</div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Completion</span>
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
            </div>
            <div class="text-2xl font-bold text-white mt-2 font-mono">{{ completionPercent }}%</div>
            <div class="text-[11px] text-gray-500 mt-1">{{ doneCount }} of {{ totalIssues }} done</div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>In Flight</span>
              <i data-lucide="loader" class="w-4 h-4 text-sky-400"></i>
            </div>
            <div class="text-2xl font-bold text-white mt-2 font-mono">{{ inFlightCount }}</div>
            <div class="text-[11px] text-gray-500 mt-1">{{ openCount }} total open</div>
          </div>

          <div class="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
            <div class="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Estimate Load</span>
              <i data-lucide="gauge" class="w-4 h-4 text-amber-400"></i>
            </div>
            <div class="text-2xl font-bold text-white mt-2 font-mono">{{ totalEstimate }}</div>
            <div class="text-[11px] text-gray-500 mt-1">story points in flight</div>
          </div>
        </div>

        <!-- Per-project progress -->
        <div class="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-white tracking-tight">Project Progress</h3>
            <span class="text-[11px] text-gray-500">Click a project to open its board</span>
          </div>

          <div v-if="projectRows.length === 0" class="py-8 text-center text-gray-500 text-xs">
            No projects yet. Create a project to start tracking work.
          </div>

          <div
            v-for="p in projectRows"
            :key="p.id"
            @click="openProject(p)"
            role="button"
            tabindex="0"
            @keydown.enter="openProject(p)"
            class="group flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: projectColor(p) }"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-200 truncate">{{ p.name }}</span>
                <span class="text-[10px] font-mono text-gray-500">{{ p.identifier }}</span>
              </div>
              <div class="flex items-center gap-3 mt-1.5">
                <div class="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{ width: p.percent + '%', backgroundColor: projectColor(p) }"
                  ></div>
                </div>
                <span class="text-[11px] font-mono text-gray-400 w-9 text-right">{{ p.percent }}%</span>
              </div>
            </div>
            <div class="hidden sm:flex items-center gap-3 text-[11px] text-gray-500 font-mono shrink-0">
              <span class="flex items-center gap-1"><i data-lucide="circle" class="w-3 h-3 text-emerald-400"></i>{{ p.done }}</span>
              <span class="flex items-center gap-1"><i data-lucide="loader" class="w-3 h-3 text-sky-400"></i>{{ p.inFlight }}</span>
              <span class="flex items-center gap-1"><i data-lucide="square" class="w-3 h-3 text-gray-400"></i>{{ p.total }}</span>
            </div>
          </div>
        </div>

        <!-- Milestones panel -->
        <div class="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-lg">
          <h3 class="text-sm font-semibold text-white tracking-tight mb-4">Milestones & Roadmap Health</h3>

          <div v-if="milestoneRows.length === 0" class="py-6 text-center text-gray-500 text-xs">
            No milestones scheduled yet.
          </div>

          <div
            v-for="m in milestoneRows"
            :key="m.id"
            class="flex items-center gap-4 px-1 py-2.5 border-b border-gray-800/50 last:border-0"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="statusDot(m)"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-200 truncate">{{ m.name }}</span>
                <span
                  v-if="m.project"
                  class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
                >{{ m.project.identifier }}</span>
              </div>
              <div class="flex items-center gap-3 mt-1.5">
                <div class="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="m.isOverdue ? 'bg-red-500' : (m.percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')"
                    :style="{ width: Math.max(m.percent, 3) + '%' }"
                  ></div>
                </div>
                <span class="text-[11px] font-mono text-gray-400 w-9 text-right">{{ m.percent }}%</span>
              </div>
            </div>
            <div class="hidden sm:block shrink-0 text-[11px] font-mono">
              <span
                :class="m.isOverdue ? 'text-red-400' : 'text-gray-400'"
                v-if="!m.isDone"
              >{{ fmtTarget(m.target) }}</span>
              <span v-else class="text-emerald-400 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Done</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
};
