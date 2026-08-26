// pb_public/js/components/WelcomeModal.js
// Minimalist first-run onboarding checklist supporting Dark and Light themes.

const WelcomeModalComponent = {
  props: ['isOpen', 'hasProjects'],
  emits: ['close', 'create-project', 'create-issue', 'go-board'],
  watch: {
    isOpen(newVal) {
      if (newVal && window.lucide) {
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <!-- Backdrop: click to skip -->
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative w-full max-w-md rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 space-y-4 z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-base shrink-0">⚡</div>
            <div>
              <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Welcome to ProjectBase</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Get started in 3 quick steps.</p>
            </div>
          </div>
          <button type="button" @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Dismiss">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Actionable checklist -->
        <div class="space-y-2">
          <button
            type="button"
            @click="$emit('create-project')"
            class="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left cursor-pointer"
          >
            <div class="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Create your first project</p>
              <p class="text-[10px] text-zinc-400">Name it, pick an identifier, and get set up.</p>
            </div>
            <span class="text-zinc-700 dark:text-zinc-300 text-xs font-medium shrink-0">Start →</span>
          </button>

          <button
            type="button"
            :disabled="!hasProjects"
            @click="$emit('create-issue')"
            class="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <div class="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Create an issue</p>
              <p class="text-[10px] text-zinc-400">Describe a task and assign it to a teammate or agent.</p>
            </div>
            <span class="text-zinc-700 dark:text-zinc-300 text-xs font-medium shrink-0">New issue →</span>
          </button>

          <button
            type="button"
            :disabled="!hasProjects"
            @click="$emit('go-board')"
            class="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <div class="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Explore the Kanban board</p>
              <p class="text-[10px] text-zinc-400">Drag cards between lanes with real-time updates.</p>
            </div>
            <span class="text-zinc-700 dark:text-zinc-300 text-xs font-medium shrink-0">Open board →</span>
          </button>
        </div>

        <p v-if="!hasProjects" class="text-[10px] text-zinc-400 text-center">
          Tip: create a project first, then add issues and track work on the board.
        </p>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <button type="button" @click="$emit('close')" class="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Skip for now</button>
          <button type="button" @click="$emit('close')" class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium shadow-2xs transition-colors cursor-pointer">Get started</button>
        </div>
      </div>
    </div>
  `
};
