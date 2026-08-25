// pb_public/js/components/ProjectsView.js

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
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight">Projects</h2>
            <p class="text-xs text-gray-400">All managed repositories and workspace domains</p>
          </div>

          <button 
            @click="$emit('open-new-project')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Create Project</span>
          </button>
        </div>

        <!-- Projects Grid -->
        <div v-if="projects.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div 
            v-for="p in projects" 
            :key="p.id"
            @click="$emit('select-project', p)"
            role="button"
            tabindex="0"
            @keydown.enter="$emit('select-project', p)"
            class="p-5 rounded-2xl bg-gray-900/70 hover:bg-gray-900/95 border border-gray-800 hover:border-gray-700 transition-all shadow-xl hover:shadow-2xl flex flex-col justify-between group cursor-pointer"
          >
            <!-- Card Top: Icon, Name, Star, Key -->
            <div>
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gray-800/80 border border-gray-700/50 shadow-inner">
                    {{ p.icon || '📁' }}
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center space-x-2">
                      <span>{{ p.name }}</span>
                    </h3>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono font-medium">
                      {{ p.identifier }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center space-x-1">
                  <!-- Star / Favorite -->
                  <button 
                    @click.stop="$emit('toggle-favorite', p)"
                    class="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 transition-colors"
                    :class="{ 'text-amber-400': p.is_favorite }"
                    title="Toggle Favorite"
                  >
                    <i data-lucide="star" class="w-4 h-4" :class="{ 'fill-amber-400': p.is_favorite }"></i>
                  </button>

                  <!-- Delete -->
                  <button 
                    @click.stop="$emit('delete-project', p.id)"
                    class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Project"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>

              <!-- Description -->
              <p class="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed">
                {{ p.description || 'No description provided.' }}
              </p>

              <!-- Repo URL if available -->
              <div v-if="p.repo_url" class="mt-2.5 flex items-center space-x-1.5 text-[11px] text-gray-500">
                <i data-lucide="github" class="w-3.5 h-3.5 text-gray-400"></i>
                <a :href="p.repo_url" target="_blank" rel="noopener" class="text-gray-400 hover:text-indigo-300 truncate underline" @click.stop>
                  {{ p.repo_url.replace('https://github.com/', '') }}
                </a>
              </div>
            </div>

            <!-- Card Bottom: Health Bar & Button -->
            <div class="mt-6 pt-4 border-t border-gray-800/80 space-y-3">
              <div class="flex items-center justify-between text-xs font-mono text-gray-400">
                <span>Completion</span>
                <span class="text-white font-semibold">{{ getProjectStats(p.id).percent }}%</span>
              </div>
              <div class="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden">
                <div class="bg-indigo-500 h-full rounded-full transition-all" :style="{ width: getProjectStats(p.id).percent + '%' }"></div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center space-x-3 text-[11px] text-gray-400 font-mono">
                  <span>{{ getProjectStats(p.id).done }} done</span>
                  <span>{{ getProjectStats(p.id).total }} total</span>
                </div>

                <button 
                  @click="$emit('select-project', p)"
                  class="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-200 transition-all flex items-center space-x-1"
                >
                  <span>Open Board</span>
                  <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- First-run empty state (fresh self-host install / no projects yet) -->
        <div v-else class="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <i data-lucide="folder-plus" class="w-8 h-8 text-white"></i>
          </div>

          <div class="space-y-1.5">
            <h3 class="text-lg font-bold text-white tracking-tight">Welcome to ProjectBase</h3>
            <p class="text-xs text-gray-400 max-w-md mx-auto">
              Your workspace is empty. Create your first project to start tracking issues, sprints, and milestones.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
            <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-left space-y-2">
              <div class="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
              </div>
              <p class="text-xs font-semibold text-white">1. Create a project</p>
              <p class="text-[11px] text-gray-400 leading-relaxed">Name it and give it a short identifier like PB or DEV.</p>
            </div>
            <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-left space-y-2">
              <div class="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              </div>
              <p class="text-xs font-semibold text-white">2. Add your first issue</p>
              <p class="text-[11px] text-gray-400 leading-relaxed">Press C anywhere to open the quick-create modal.</p>
            </div>
            <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-left space-y-2">
              <div class="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center">
                <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
              </div>
              <p class="text-xs font-semibold text-white">3. Drag it to done</p>
              <p class="text-[11px] text-gray-400 leading-relaxed">Move cards between lanes on the Kanban board.</p>
            </div>
          </div>

          <button
            @click="$emit('open-new-project')"
            class="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Create your first project</span>
          </button>
        </div>

      </div>
    </div>
  `
};
