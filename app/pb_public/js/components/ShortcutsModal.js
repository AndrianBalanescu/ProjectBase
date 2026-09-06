// pb_public/js/components/ShortcutsModal.js
// Keyboard shortcut reference modal supporting Dark and Light themes.
// Backed by the (?) hint on the Kanban board toolbar and the `?` key
// (Shift+/). Keep the listed bindings in sync with setupKeyboardShortcuts()
// in app.js — test_shortcuts_modal_wired_in_frontend guards the wiring.

const ShortcutsModalComponent = {
  props: ['isOpen'],
  emits: ['close'],
  computed: {
    groups() {
      return [
        {
          label: 'General',
          items: [
            { keys: ['Ctrl', 'K'], desc: 'Open the command palette (omnibar)' },
            { keys: ['?'], desc: 'Show this shortcut guide' },
            { keys: ['Esc'], desc: 'Close modal, drawer, or clear selection' }
          ]
        },
        {
          label: 'Create & Migrate',
          items: [
            { keys: ['C'], desc: 'Create a new issue' },
            { keys: ['N'], desc: 'Create a new issue (alias)' },
            { keys: ['I'], desc: 'Import issues (CSV, GitHub, Linear, Plane)' },
            { keys: ['E'], desc: 'Export issues (CSV, JSON)' }
          ]
        },
        {
          label: 'Switch Views',
          items: [
            { keys: ['1'], desc: 'Board (Kanban)' },
            { keys: ['2'], desc: 'List' },
            { keys: ['3'], desc: 'Cycles (sprints)' },
            { keys: ['4'], desc: 'Timeline' },
            { keys: ['5'], desc: 'Projects' },
            { keys: ['6'], desc: 'Stats / Analytics' },
            { keys: ['7'], desc: 'Docs' },
            { keys: ['8'], desc: 'Portfolio' }
          ]
        }
      ];
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal && window.lucide) {
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    close() {
      this.$emit('close');
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" @click.self="close">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="close"></div>

      <div class="relative w-full max-w-md rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="keyboard" class="w-3.5 h-3.5"></i>
            </div>
            <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Keyboard Shortcuts</h2>
          </div>
          <button @click="close" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close shortcuts guide">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div v-for="group in groups" :key="group.label" class="space-y-2">
            <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{{ group.label }}</p>
            <div class="space-y-1">
              <div v-for="item in group.items" :key="item.desc" class="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <span class="text-xs text-zinc-700 dark:text-zinc-300">{{ item.desc }}</span>
                <span class="flex items-center gap-1 shrink-0">
                  <kbd v-for="k in item.keys" :key="k" class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">{{ k }}</kbd>
                </span>
              </div>
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Single-key shortcuts pause while you are typing, while a modal or the
            issue drawer is open, or while modifier keys (Ctrl/Alt) are held.
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button @click="close" class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium shadow-2xs transition-colors">Got it</button>
        </div>
      </div>
    </div>
  `
};