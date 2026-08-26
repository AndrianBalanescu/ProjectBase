// pb_public/js/components/TimelineView.js
// ProjectBase — Timeline / Gantt component (v1.1 roadmap "Next" after cycle-18)
//
// Zero-build Vue 3 view. Renders a scrollable Gantt chart on a day grid:
//   - Cycles  -> wide bars spanning start_date → end_date (indigo)
//   - Milestones -> flag markers at target_date (amber)
//   - Issues  -> bars spanning start_date → due_date (status-colored)
// Issues without a start date fall back to their cycle's start_date (or
// created date); issues without an end render as single-day markers.
// Clicking an issue bar opens the issue drawer via the `open-issue` event.

const TimelineViewComponent = {
  props: ['issues', 'cycles', 'milestones', 'projects', 'currentProject'],
  emits: ['open-issue'],
  data() {
    return { dayWidth: 34 }; // px per day
  },
  computed: {
    activeProject() {
      if (this.currentProject) return this.currentProject;
      return this.projects.find(p => p.identifier === 'PB') || this.projects[0] || null;
    },
    projectIssues() {
      if (!this.activeProject) return this.issues;
      return this.issues.filter(i => i.project === this.activeProject.id);
    },
    projectCycles() {
      if (!this.activeProject) return this.cycles;
      return this.cycles.filter(c => c.project === this.activeProject.id);
    },
    projectMilestones() {
      if (!this.activeProject) return this.milestones;
      return this.milestones.filter(m => m.project === this.activeProject.id || !m.project);
    },
    // Earliest start and latest end across all scheduled rows.
    chartRange() {
      let min = null;
      let max = null;
      const consider = (d) => {
        if (!d) return;
        const t = new Date(d).getTime();
        if (isNaN(t)) return;
        if (min === null || t < min) min = t;
        if (max === null || t > max) max = t;
      };
      this.projectCycles.forEach(c => { consider(c.start_date); consider(c.end_date); });
      this.projectMilestones.forEach(m => consider(m.target_date));
      this.projectIssues.forEach(i => {
        consider(this.issueStart(i));
        consider(this.issueEnd(i));
      });
      if (min === null) {
        const now = Date.now();
        min = now - 7 * 86400000;
        max = now + 7 * 86400000;
      }
      // Pad the chart by 4 days on each side so bars never hug the edge.
      return { start: new Date(min - 4 * 86400000), end: new Date(max + 4 * 86400000) };
    },
    totalDays() {
      const { start, end } = this.chartRange;
      return Math.max(1, Math.round((end - start) / 86400000));
    },
    chartWidth() {
      return this.totalDays * this.dayWidth;
    },
    monthTicks() {
      const ticks = [];
      const { start, end } = this.chartRange;
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        ticks.push({
          date: new Date(cur),
          label: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          offset: Math.round((cur - start) / 86400000) * this.dayWidth
        });
        cur.setMonth(cur.getMonth() + 1);
      }
      return ticks;
    },
    // Row model: cycles, milestones, then issues grouped under section headers.
    rows() {
      const rows = [];
      const cycles = this.projectCycles
        .filter(c => c.start_date || c.end_date)
        .map(c => ({
          type: 'cycle', id: c.id, label: c.name,
          sublabel: c.status || '', start: c.start_date, end: c.end_date,
          color: 'bg-indigo-500/80 border-indigo-300/40', marker: false
        }));
      const milestones = this.projectMilestones
        .filter(m => m.target_date)
        .map(m => ({
          type: 'milestone', id: m.id, label: m.name,
          sublabel: m.status || '', start: m.target_date, end: m.target_date,
          color: 'bg-amber-400 border-amber-200', marker: true
        }));
      const issues = this.projectIssues
        .map(i => ({
          type: 'issue', id: i.id, label: (i.identifier || '') + ' ' + i.title,
          sublabel: i.status + (i.assignee ? ' · ' + i.assignee : ''),
          start: this.issueStart(i), end: this.issueEnd(i),
          color: this.issueColor(i.status), marker: !i.due_date && !i.start_date,
          issue: i
        }))
        .filter(r => r.start)
        .sort((a, b) => (a.start - b.start) || (a.end - b.end));
      if (cycles.length) rows.push({ type: 'header', label: 'Cycles', icon: 'refresh-cw' }, ...cycles);
      if (milestones.length) rows.push({ type: 'header', label: 'Milestones', icon: 'flag' }, ...milestones);
      if (issues.length) rows.push({ type: 'header', label: 'Issues', icon: 'list-todo' }, ...issues);
      return rows;
    },
    issueCount() {
      return this.projectIssues.length;
    },
    hasSchedule() {
      return this.projectCycles.some(c => c.start_date || c.end_date) ||
             this.projectMilestones.some(m => m.target_date) ||
             this.projectIssues.some(i => this.issueStart(i));
    }
  },
  methods: {
    issueStart(i) {
      if (i.start_date) return i.start_date;
      if (i.cycle) {
        const c = this.cycles.find(x => x.id === i.cycle);
        if (c && c.start_date) return c.start_date;
      }
      return i.created || null;
    },
    issueEnd(i) {
      return i.due_date || i.start_date || i.created || null;
    },
    issueColor(status) {
      const map = {
        done: 'bg-emerald-500/80 border-emerald-300/40',
        in_progress: 'bg-sky-500/80 border-sky-300/40',
        in_review: 'bg-violet-500/80 border-violet-300/40',
        todo: 'bg-blue-500/80 border-blue-300/40',
        backlog: 'bg-gray-600/70 border-gray-400/40',
        cancelled: 'bg-rose-900/60 border-rose-700/50'
      };
      return map[status] || map.backlog;
    },
    dayOffset(dateStr) {
      const t = new Date(dateStr).getTime();
      const { start } = this.chartRange;
      return Math.max(0, Math.round((t - start) / 86400000));
    },
    barLeft(dateStr) {
      return this.dayOffset(dateStr) * this.dayWidth + 2;
    },
    barWidth(startStr, endStr) {
      const start = this.dayOffset(startStr);
      const end = Math.max(this.dayOffset(endStr), start + 1);
      return Math.max(8, (end - start) * this.dayWidth - 4);
    },
    fmtDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    fmtShort(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    rangeLabel(startStr, endStr) {
      const s = this.fmtShort(startStr);
      const e = this.fmtDate(endStr);
      return startStr === endStr ? e : `${s} – ${e}`;
    },
    gridLines() {
      // One faint vertical line per 7 days (weekly rhythm).
      const lines = [];
      const { start } = this.chartRange;
      const total = this.totalDays;
      for (let d = 0; d <= total; d += 7) {
        lines.push({ offset: d * this.dayWidth, isMonth: false });
      }
      return lines;
    },
    openIssue(issue) {
      if (issue) this.$emit('open-issue', issue);
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-2.5 bg-[#0b0f19]">
      <div class="w-full space-y-3">

        <!-- Header -->
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight">Timeline</h2>
            <p class="text-xs text-gray-400 mt-0.5">Schedule view: cycles, milestones and issues on a day grid.</p>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-gray-400">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-indigo-500/80"></span>Cycle</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>Milestone</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-sky-500/80"></span>Issue</span>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!hasSchedule" class="p-10 rounded-2xl bg-gray-900/40 border border-dashed border-gray-800 text-center">
          <i data-lucide="calendar" class="w-8 h-8 text-gray-600 mx-auto mb-2"></i>
          <p class="text-sm text-gray-400">No scheduled items yet.</p>
          <p class="text-xs text-gray-600 mt-1">Set a start or due date on an issue, or add dates to a cycle or milestone, and it will appear here.</p>
        </div>

        <!-- Gantt chart -->
        <div v-else class="rounded-2xl bg-gray-900/40 border border-gray-800/80 shadow-lg overflow-hidden">
          <div class="overflow-x-auto">
            <div class="min-w-[900px]">
              <!-- Time ruler -->
              <div class="flex border-b border-gray-800/80 bg-gray-950/40">
                <div class="w-64 flex-shrink-0 px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-800/60">Item</div>
                <div class="relative flex-1 h-10">
                  <div v-for="tick in monthTicks" :key="'m'+tick.label" class="absolute top-0 h-full flex items-start"
                    :style="{ left: tick.offset + 'px' }">
                    <div class="pl-2 text-[11px] font-medium text-gray-400">{{ tick.label }}</div>
                  </div>
                </div>
              </div>

              <!-- Rows -->
              <div v-for="(row, ri) in rows" :key="row.type + '-' + row.id + '-' + ri">
                <!-- Section header -->
                <div v-if="row.type === 'header'" class="flex items-center border-b border-gray-800/40 bg-gray-950/30">
                  <div class="w-64 flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-300 uppercase tracking-wider border-r border-gray-800/60 flex items-center gap-2">
                    <i :data-lucide="row.icon" class="w-3.5 h-3.5 text-gray-500"></i>{{ row.label }}
                  </div>
                  <div class="flex-1 h-6"></div>
                </div>

                <!-- Schedule row -->
                <div v-else class="flex items-center border-b border-gray-800/30 hover:bg-gray-800/10 transition-colors"
                  :class="{ 'cursor-pointer': row.type === 'issue' }"
                  @click="row.type === 'issue' && openIssue(row.issue)">
                  <div class="w-64 flex-shrink-0 px-4 py-2 border-r border-gray-800/60 min-h-[2.6rem] flex flex-col justify-center overflow-hidden">
                    <div class="text-xs font-medium text-gray-200 truncate" :class="row.type === 'issue' ? 'group-hover:text-white' : ''">{{ row.label }}</div>
                    <div class="text-[10px] text-gray-500 mt-0.5 truncate">{{ row.sublabel || rangeLabel(row.start, row.end) }}</div>
                  </div>
                  <div class="relative flex-1 h-12" :style="{ minWidth: chartWidth + 'px' }">
                    <!-- week gridlines -->
                    <div v-for="line in gridLines()" :key="'g'+line.offset" class="absolute top-0 bottom-0 w-px bg-gray-800/20" :style="{ left: line.offset + 'px' }"></div>
                    <!-- bar -->
                    <div class="absolute top-1/2 -translate-y-1/2 h-6 rounded-md border flex items-center px-2 shadow-sm overflow-hidden"
                      :class="row.color"
                      :style="{ left: barLeft(row.start) + 'px', width: barWidth(row.start, row.end) + 'px' }"
                      :title="row.label + ' — ' + rangeLabel(row.start, row.end)">
                      <span v-if="barWidth(row.start, row.end) > 40" class="text-[10px] font-medium text-white truncate">{{ row.label }}</span>
                      <span v-else class="w-full text-center text-white text-[10px] font-bold">•</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="px-4 py-2 text-[10px] text-gray-600 border-t border-gray-800/60 flex items-center justify-between">
            <span>Scroll horizontally to see the full schedule.</span>
            <span class="font-mono">{{ issueCount }} issues in {{ activeProject ? activeProject.name : 'this workspace' }}</span>
          </div>
        </div>

      </div>
    </div>
  `
};
