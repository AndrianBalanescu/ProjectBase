// pb_public/js/components/ProjectModal.js

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
        alert('Please enter project name and short identifier key.');
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
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60 select-none">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <i data-lucide="folder-plus" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm font-bold text-white">{{ editProject ? 'Edit Project' : 'Create New Project' }}</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          
          <!-- Name & Key -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2 space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Project Name</label>
              <input 
                ref="nameInput"
                v-model="name"
                placeholder="e.g. Agent Hub"
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Key / ID</label>
              <input 
                v-model="identifier"
                placeholder="e.g. HUB"
                maxlength="6"
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Icon & Color Palette -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Emoji Icon</label>
              <div class="flex items-center space-x-1.5">
                <input 
                  v-model="icon"
                  maxlength="2"
                  class="w-12 text-center py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-base focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div class="flex items-center space-x-1">
                  <button 
                    v-for="e in ['⚡', '🚀', '🏠', '📦', '🤖', '🔥', '💎', '🛡️']"
                    :key="e"
                    type="button"
                    @click="icon = e"
                    class="p-1 text-xs hover:scale-125 transition-transform"
                  >
                    {{ e }}
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Accent Color</label>
              <div class="flex items-center space-x-2">
                <input 
                  type="color"
                  v-model="color"
                  class="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input 
                  v-model="color"
                  class="flex-1 px-2.5 py-1.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs font-mono text-gray-200"
                />
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Description</label>
            <textarea 
              v-model="description"
              rows="3"
              placeholder="What is the goal of this project?"
              class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            ></textarea>
          </div>

          <!-- Repo URL -->
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">GitHub / Git Repository URL</label>
            <input 
              v-model="repoUrl"
              placeholder="https://github.com/org/repo"
              class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 border-t border-gray-800 bg-gray-950/60 flex items-center justify-end space-x-2">
          <button 
            @click="$emit('close')"
            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            @click="submit"
            class="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {{ editProject ? 'Save Changes' : 'Create Project' }}
          </button>
        </div>

      </div>
    </div>
  `
};
