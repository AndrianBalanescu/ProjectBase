// pb_public/js/components/ProjectsView.js
// Minimalist, high-density Projects View supporting Dark and Light themes.

const ProjectsViewComponent = {
  props: ['projects', 'issues'],
  emits: ['select-project', 'open-new-project', 'edit-project', 'delete-project', 'toggle-favorite'],
  methods: {
    getProjectStats(projectId) {
      const pIssues = this.issues.filter(i => i.project === projectId);
      const total = pIssues.length;
      const done = pIssues.filter(i => i.status === 'done').length;
      const inProgress = pIssues.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { total, done, inProgress, percent };
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Projects</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">All managed repositories and workspace domains</p>
          </div>

          <button
            @click="$emit('open-new-project')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Create Project</span>
          </button>
        </div>

        <!-- Projects Grid -->
        <div v-if="projects.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div
            v-for="p in projects"
            :key="p.id"
            @click="$emit('select-project', p)"
            role="button"
            tabindex="0"
            @keydown.enter="$emit('select-project', p)"
            class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs hover:shadow-sm flex flex-col justify-between group cursor-pointer"
          >
            <!-- Card Top: Icon, Name, Star, Key -->
            <div>
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 shadow-2xs">
                    {{ p.icon || '📁' }}
                  </div>
                  <div>
                    <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors flex items-center space-x-1.5">
                      <span>{{ p.name }}</span>
                    </h3>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono font-medium border border-zinc-200 dark:border-zinc-700/60">
                      {{ p.identifier }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center space-x-1">
                  <!-- Star / Favorite -->
                  <button
                    @click.stop="$emit('toggle-favorite', p)"
                    class="p-1 rounded-md text-zinc-400 hover:text-amber-500 transition-colors"
                    :class="{ 'text-amber-500': p.is_favorite }"
                    title="Toggle Favorite"
                  >
                    <i data-lucide="star" class="w-3.5 h-3.5" :class="{ 'fill-amber-500': p.is_favorite }"></i>
                  </button>

                  <!-- Delete -->
                  <button
                    @click.stop="$emit('delete-project', p.id)"
                    class="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Project"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>

              <!-- Description -->
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">
                {{ p.description || 'No description provided.' }}
              </p>

              <!-- Repo URL if available -->
              <div v-if="p.repo_url" class="mt-2 flex items-center space-x-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <i data-lucide="github" class="w-3.5 h-3.5 text-zinc-400"></i>
                <a :href="p.repo_url" target="_blank" rel="noopener" class="text-zinc-600 dark:text-zinc-400 hover:underline truncate" @click.stop>
                  {{ p.repo_url.replace('https://github.com/', '') }}
                </a>
              </div>
            </div>

            <!-- Card Bottom: Health Bar & Button -->
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
              <div class="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                <span>Progress</span>
                <span class="text-zinc-900 dark:text-zinc-100 font-semibold">{{ getProjectStats(p.id).percent }}%</span>
              </div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                <div class="bg-zinc-800 dark:bg-zinc-200 h-full rounded-full transition-all" :style="{ width: getProjectStats(p.id).percent + '%' }"></div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center space-x-2 text-[10px] text-zinc-400 font-mono">
                  <span>{{ getProjectStats(p.id).done }} done</span>
                  <span>·</span>
                  <span>{{ getProjectStats(p.id).total }} total</span>
                </div>

                <button
                  @click="$emit('select-project', p)"
                  class="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center space-x-1"
                >
                  <span>Open Board</span>
                  <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- First-run empty state (fresh self-host install / no projects yet) -->
        <div v-else class="flex flex-col items-center justify-center py-16 text-center space-y-5">
          <div class="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
            <i data-lucide="folder-plus" class="w-6 h-6 text-zinc-700 dark:text-zinc-300"></i>
          </div>

          <div class="space-y-1">
            <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Welcome to ProjectBase</h3>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Your workspace is empty. Create your first project to start tracking issues, sprints, and milestones.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl w-full">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left space-y-1">
              <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <i data-lucide="folder-plus" class="w-3 h-3"></i>
              </div>
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">1. Create a project</p>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Name it and give it a short identifier like PB or DEV.</p>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left space-y-1">
              <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <i data-lucide="sparkles" class="w-3 h-3"></i>
              </div>
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">2. Add your first issue</p>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Press C anywhere to open the quick-create modal.</p>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left space-y-1">
              <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <i data-lucide="kanban" class="w-3 h-3"></i>
              </div>
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">3. Drag it to done</p>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Move cards between lanes on the Kanban board.</p>
            </div>
          </div>

          <button
            @click="$emit('open-new-project')"
            class="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Create your first project</span>
          </button>
        </div>

      </div>
    </div>
  `
};
