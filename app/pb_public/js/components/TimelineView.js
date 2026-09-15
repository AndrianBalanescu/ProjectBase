// pb_public/js/components/TimelineView.js
// Minimalist, high-density Timeline / Gantt component supporting Dark and Light themes.

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
      (this.projectCycles || []).forEach(c => { consider(c.start_date); consider(c.end_date); });
      (this.projectMilestones || []).forEach(m => { consider(m.target_date); });
      (this.projectIssues || []).forEach(i => { consider(this.issueStart(i)); consider(this.issueEnd(i)); });

      const now = Date.now();
      if (min === null) min = now - 7 * 86400000;
      if (max === null) max = now + 21 * 86400000;
      min -= 3 * 86400000;
      max += 7 * 86400000;
      return { start: min, end: max };
    },
    totalDays() {
      const { start, end } = this.chartRange;
      return Math.max(14, Math.ceil((end - start) / 86400000));
    },
    chartWidth() {
      return this.totalDays * this.dayWidth;
    },
    monthTicks() {
      const ticks = [];
      const { start, end } = this.chartRange;
      let cur = new Date(start);
      cur.setDate(1);
      if (cur.getTime() < start) cur.setMonth(cur.getMonth() + 1);

      while (cur.getTime() <= end) {
        const offset = Math.round((cur.getTime() - start) / 86400000) * this.dayWidth;
        const label = cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        ticks.push({ offset, label });
        cur.setMonth(cur.getMonth() + 1);
      }
      if (ticks.length === 0) {
        ticks.push({ offset: 0, label: new Date(start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
      }
      return ticks;
    },
    rows() {
      const out = [];
      const cycles = (this.projectCycles || []).filter(c => c.start_date || c.end_date);
      if (cycles.length > 0) {
        out.push({ type: 'header', label: 'Cycles', icon: 'refresh-cw' });
        cycles.forEach(c => {
          const s = c.start_date || c.end_date;
          const e = c.end_date || c.start_date;
          out.push({
            type: 'cycle',
            id: c.id,
            label: c.name,
            sublabel: c.status,
            start: s,
            end: e,
            color: 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-300'
          });
        });
      }

      const milestones = (this.projectMilestones || []).filter(m => m.target_date);
      if (milestones.length > 0) {
        out.push({ type: 'header', label: 'Milestones', icon: 'milestone' });
        milestones.forEach(m => {
          out.push({
            type: 'milestone',
            id: m.id,
            label: m.name || m.title,
            sublabel: m.status,
            start: m.target_date,
            end: m.target_date,
            color: 'bg-amber-500 text-zinc-950 border-amber-400'
          });
        });
      }

      const issues = (this.projectIssues || []).filter(i => i.start_date || i.due_date || i.cycle);
      if (issues.length > 0) {
        out.push({ type: 'header', label: 'Issues', icon: 'check-square' });
        issues.forEach(i => {
          out.push({
            type: 'issue',
            id: i.id,
            issue: i,
            label: `${i.identifier || 'PB'}: ${i.title}`,
            sublabel: i.status,
            start: this.issueStart(i),
            end: this.issueEnd(i),
            color: this.issueColor(i.status)
          });
        });
      }

      return out;
    },
    hasSchedule() {
      return this.rows.some(r => r.type !== 'header');
    },
    issueCount() {
      return (this.projectIssues || []).length;
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
        done: 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-500 dark:border-emerald-400',
        in_progress: 'bg-sky-600 dark:bg-sky-500 text-white border-sky-500 dark:border-sky-400',
        in_review: 'bg-amber-600 dark:bg-amber-500 text-white border-amber-500 dark:border-amber-400',
        todo: 'bg-zinc-600 dark:bg-zinc-400 text-white dark:text-zinc-950 border-zinc-500 dark:border-zinc-300',
        backlog: 'bg-zinc-400 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-500',
        cancelled: 'bg-rose-600 text-white border-rose-500'
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
      if (!startStr && !endStr) return '';
      if (!startStr) return this.fmtDate(endStr);
      if (!endStr) return this.fmtDate(startStr);
      const s = this.fmtShort(startStr);
      const e = this.fmtDate(endStr);
      return startStr === endStr ? e : `${s} – ${e}`;
    },
    gridLines() {
      const lines = [];
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
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-4">

        <!-- Header -->
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Timeline</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Schedule view: cycles, milestones and issues on a day grid</p>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-zinc-800 dark:bg-zinc-200"></span>Cycle</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-amber-500"></span>Milestone</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-sky-500"></span>Issue</span>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!hasSchedule" class="p-10 rounded-xl bg-white dark:bg-[#121215] border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
          <i data-lucide="calendar" class="w-8 h-8 text-zinc-400 mx-auto mb-2"></i>
          <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No scheduled items yet.</p>
          <p class="text-[11px] text-zinc-400 mt-1">Set a start or due date on an issue, or add dates to a cycle or milestone, and it will appear here.</p>
        </div>

        <!-- Gantt chart -->
        <div v-else class="rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
          <div class="overflow-x-auto">
            <div class="min-w-[900px]">
              <!-- Time ruler -->
              <div class="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60">
                <div class="w-64 shrink-0 px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-800">Item</div>
                <div class="relative flex-1 h-8">
                  <div v-for="tick in monthTicks" :key="'m'+tick.label" class="absolute top-0 h-full flex items-center"
                    :style="{ left: tick.offset + 'px' }">
                    <div class="pl-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 font-mono">{{ tick.label }}</div>
                  </div>
                </div>
              </div>

              <!-- Rows -->
              <div v-for="(row, ri) in rows" :key="row.type + '-' + row.id + '-' + ri">
                <!-- Section header -->
                <div v-if="row.type === 'header'" class="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30">
                  <div class="w-64 shrink-0 px-3 py-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
                    <i :data-lucide="row.icon" class="w-3 h-3 text-zinc-400"></i>{{ row.label }}
                  </div>
                  <div class="flex-1 h-6"></div>
                </div>

                <!-- Schedule row -->
                <div v-else class="flex items-center border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                  :class="{ 'cursor-pointer': row.type === 'issue' }"
                  @click="row.type === 'issue' && openIssue(row.issue)">
                  <div class="w-64 shrink-0 px-3 py-1.5 border-r border-zinc-200 dark:border-zinc-800 min-h-[2.4rem] flex flex-col justify-center overflow-hidden">
                    <div class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{{ row.label }}</div>
                    <div class="text-[10px] text-zinc-400 truncate font-mono">{{ row.sublabel || rangeLabel(row.start, row.end) }}</div>
                  </div>
                  <div class="relative flex-1 h-10" :style="{ minWidth: chartWidth + 'px' }">
                    <!-- week gridlines -->
                    <div v-for="line in gridLines()" :key="'g'+line.offset" class="absolute top-0 bottom-0 w-px bg-zinc-200/60 dark:bg-zinc-800/40" :style="{ left: line.offset + 'px' }"></div>
                    <!-- bar -->
                    <div class="absolute top-1/2 -translate-y-1/2 h-5 rounded-md border flex items-center px-1.5 shadow-2xs overflow-hidden"
                      :class="row.color"
                      :style="{ left: barLeft(row.start) + 'px', width: barWidth(row.start, row.end) + 'px' }"
                      :title="row.label + ' — ' + rangeLabel(row.start, row.end)">
                      <span v-if="barWidth(row.start, row.end) > 40" class="text-[10px] font-medium truncate">{{ row.label }}</span>
                      <span v-else class="w-full text-center text-[10px] font-bold">•</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="px-3 py-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between font-mono">
            <span>Scroll horizontally to see the full schedule.</span>
            <span>{{ issueCount }} issues in {{ activeProject ? activeProject.name : 'workspace' }}</span>
          </div>
        </div>

      </div>
    </div>
  `
};
