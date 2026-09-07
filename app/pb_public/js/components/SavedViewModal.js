// pb_public/js/components/SavedViewModal.js
// Minimalist Save View modal supporting Dark and Light themes.
// Persists the current board/list filter state (search, priority, cycle, label)
// under a user-chosen name into the `saved_views` collection.

const SavedViewModalComponent = {
  props: ['isOpen', 'currentView', 'currentProject'],
  emits: ['close', 'confirm'],
  data() {
    return {
      name: '',
      error: ''
    };
  },
  computed: {
    surfaceLabel() {
      return this.currentView === 'list' ? 'List' : 'Board';
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.name = '';
        this.error = '';
        this.$nextTick(() => {
          const inp = this.$refs.saveViewNameInput;
          if (inp) inp.focus();
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    submit() {
      const n = (this.name || '').trim();
      if (!n) { this.error = 'Name is required'; return; }
      if (n.length > 64) { this.error = 'Name must be 64 characters or fewer'; return; }
      this.error = '';
      this.$emit('confirm', {
        name: n,
        view: this.currentView === 'list' ? 'list' : 'board'
      });
    },
    onKeydown(e) {
      if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
      if (e.key === 'Escape') { e.preventDefault(); this.$emit('close'); }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center select-none">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-md bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="bookmark" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Save Current View</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-3.5">
          <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
            Saves the active filters (search, priority, cycle, label) for the
            <span class="font-semibold text-zinc-700 dark:text-zinc-300">{{ surfaceLabel }}</span> view
            <template v-if="currentProject"> on <span class="font-semibold text-zinc-700 dark:text-zinc-300">{{ currentProject.name }}</span></template>.
          </div>

          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">View Name</label>
            <input
              id="save-view-name-input"
              ref="saveViewNameInput"
              v-model="name"
              @keydown="onKeydown"
              type="text"
              maxlength="64"
              placeholder="e.g. High priority bugs"
              class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/60"
            />
            <p v-if="error" class="text-[11px] text-red-500">{{ error }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end space-x-2 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            @click="$emit('close')"
            class="px-3 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >Cancel</button>
          <button
            @click="submit"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
          >Save View</button>
        </div>
      </div>
    </div>
  `
};

// Expose globally (zero-build, no modules).
window.SavedViewModalComponent = SavedViewModalComponent;