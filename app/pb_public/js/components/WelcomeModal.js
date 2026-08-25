// pb_public/js/components/WelcomeModal.js
// First-run onboarding checklist (cycle 26): shown once after sign-up so a
// fresh member knows the 60-second path to value — create a project, add an
// issue, drag it on the Kanban. Actionable: each row performs the real UI
// action instead of just telling the user about it.
//
// Triggered from app.js signUp() (localStorage "pb_welcome_seen" guard) and
// re-openable from the command palette action. Steps 2-3 need at least one
// project to be useful, so they are disabled when the workspace is empty
// (fresh self-host install); step 1 is always available.

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
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <!-- Backdrop: click to skip -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative w-full max-w-md rounded-2xl bg-[#0d1220] border border-gray-800 shadow-2xl p-6 space-y-5">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg shrink-0">⚡</div>
            <div>
              <h2 class="text-base font-bold text-white">Welcome to ProjectBase</h2>
              <p class="text-xs text-gray-400">You are one project away from tracking real work.</p>
            </div>
          </div>
          <button type="button" @click="$emit('close')" class="text-gray-500 hover:text-gray-300" aria-label="Dismiss">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Actionable checklist -->
        <div class="space-y-2.5">
          <button
            type="button"
            @click="$emit('create-project')"
            class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-indigo-500/60 hover:bg-gray-900 transition-colors text-left"
          >
            <div class="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
              <i data-lucide="folder-plus" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white">Create your first project</p>
              <p class="text-[11px] text-gray-400">Name it, pick an identifier, and you are in.</p>
            </div>
            <span class="text-indigo-400 text-xs font-semibold shrink-0">Start</span>
          </button>

          <button
            type="button"
            :disabled="!hasProjects"
            @click="$emit('create-issue')"
            class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-emerald-500/60 hover:bg-gray-900 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div class="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white">Create an issue</p>
              <p class="text-[11px] text-gray-400">Describe a task, then watch it flow across the board.</p>
            </div>
            <span class="text-emerald-400 text-xs font-semibold shrink-0">New issue</span>
          </button>

          <button
            type="button"
            :disabled="!hasProjects"
            @click="$emit('go-board')"
            class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-purple-500/60 hover:bg-gray-900 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div class="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
              <i data-lucide="kanban" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white">Explore the Kanban board</p>
              <p class="text-[11px] text-gray-400">Drag cards between lanes with live sync.</p>
            </div>
            <span class="text-purple-400 text-xs font-semibold shrink-0">Open board</span>
          </button>
        </div>

        <p v-if="!hasProjects" class="text-[11px] text-gray-500 text-center">
          Tip: create a project first, then add issues and drag them to done.
        </p>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-1">
          <button type="button" @click="$emit('close')" class="text-xs text-gray-500 hover:text-gray-300">Skip for now</button>
          <button type="button" @click="$emit('close')" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">Get started</button>
        </div>
      </div>
    </div>
  `
};
