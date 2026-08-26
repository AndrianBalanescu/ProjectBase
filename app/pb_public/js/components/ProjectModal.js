// pb_public/js/components/ProjectModal.js
// Minimalist Project Creation / Edit modal supporting Dark and Light themes.

const ProjectModalComponent = {
  props: ['isOpen', 'editProject'],
  emits: ['close', 'save-project'],
  data() {
    return {
      name: '',
      identifier: '',
      description: '',
      icon: '🚀',
      color: '#6366f1',
      repoUrl: '',
      lead: ''
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        if (this.editProject) {
          this.name = this.editProject.name || '';
          this.identifier = this.editProject.identifier || '';
          this.description = this.editProject.description || '';
          this.icon = this.editProject.icon || '🚀';
          this.color = this.editProject.color || '#6366f1';
          this.repoUrl = this.editProject.repo_url || '';
          this.lead = this.editProject.lead || '';
        } else {
          this.name = '';
          this.identifier = '';
          this.description = '';
          this.icon = '🚀';
          this.color = '#6366f1';
          this.repoUrl = '';
          this.lead = '';
        }

        this.$nextTick(() => {
          const inp = this.$refs.nameInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    },
    name(newVal) {
      if (!this.editProject && newVal && !this.identifier) {
        // Auto generate 3-4 letter uppercase identifier
        this.identifier = newVal.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      }
    }
  },
  methods: {
    submit() {
      if (!this.name.trim() || !this.identifier.trim()) {
        alert('Project name and key identifier are required.');
        return;
      }

      this.$emit('save-project', {
        id: this.editProject ? this.editProject.id : null,
        name: this.name.trim(),
        identifier: this.identifier.trim().toUpperCase(),
        description: this.description.trim(),
        icon: this.icon,
        color: this.color,
        repo_url: this.repoUrl.trim(),
        lead: this.lead.trim(),
        is_favorite: this.editProject ? this.editProject.is_favorite : true
      });

      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center select-none">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-lg bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{{ editProject ? 'Edit Project' : 'Create New Project' }}</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-3.5">

          <!-- Name & Key -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2 space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project Name</label>
              <input
                ref="nameInput"
                v-model="name"
                placeholder="e.g. Agent Hub"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Key / ID</label>
              <input
                v-model="identifier"
                placeholder="e.g. HUB"
                maxlength="6"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono uppercase placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
          </div>

          <!-- Icon & Color Palette -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Emoji Icon</label>
              <div class="flex items-center space-x-1.5">
                <input
                  v-model="icon"
                  maxlength="2"
                  class="w-10 text-center py-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
                <div class="flex items-center space-x-1">
                  <button
                    v-for="e in ['⚡', '🚀', '🏠', '📦', '🤖', '🔥', '💎', '🛡️']"
                    :key="e"
                    type="button"
                    @click="icon = e"
                    class="p-1 text-xs hover:scale-110 transition-transform"
                  >
                    {{ e }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Accent Color</label>
              <div class="flex items-center space-x-2">
                <input
                  type="color"
                  v-model="color"
                  class="w-7 h-7 rounded-md bg-transparent border-0 cursor-pointer"
                />
                <input
                  v-model="color"
                  class="flex-1 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="What is the goal of this project?"
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            ></textarea>
          </div>

          <!-- Repo URL -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">GitHub / Git Repository URL</label>
            <input
              v-model="repoUrl"
              placeholder="https://github.com/org/repo"
              class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end space-x-2">
          <button
            @click="$emit('close')"
            class="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="submit"
            class="px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {{ editProject ? 'Save Changes' : 'Create Project' }}
          </button>
        </div>

      </div>
    </div>
  `
};
