// app/pb_public/js/components/Multiselect.js
// Reusable, keyboard-accessible multi-select component supporting Dark and Light themes.

const MultiselectComponent = {
  props: {
    modelValue: { type: Array, default: () => [] },
    options: { type: Array, default: () => [] }, // Array of {value,label,icon?,badge?,color?} or primitives
    placeholder: { type: String, default: 'Select...' },
    searchPlaceholder: { type: String, default: 'Search...' },
    searchable: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    maxDisplay: { type: Number, default: 4 },
    buttonClass: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      isOpen: false,
      searchQuery: '',
      highlightedIndex: 0
    };
  },
  computed: {
    normalizedOptions() {
      return (this.options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: opt.value !== undefined ? opt.value : (opt.id || opt.key || opt.name),
            label: opt.label || opt.name || opt.title || String(opt.value || opt.id || ''),
            icon: opt.icon || null,
            badge: opt.badge || null,
            color: opt.color || null,
            description: opt.description || null
          };
        }
        return { value: opt, label: String(opt), icon: null, badge: null, color: null, description: null };
      });
    },
    filteredOptions() {
      if (!this.searchQuery.trim()) return this.normalizedOptions;
      const q = this.searchQuery.toLowerCase();
      return this.normalizedOptions.filter(o =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q))
      );
    },
    selectedObjects() {
      const vals = this.modelValue || [];
      return this.normalizedOptions.filter(o => vals.includes(o.value));
    },
    displayedSelections() {
      return this.selectedObjects.slice(0, this.maxDisplay);
    },
    hiddenCount() {
      const diff = this.selectedObjects.length - this.maxDisplay;
      return diff > 0 ? diff : 0;
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    toggleDropdown() {
      if (this.disabled) return;
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.searchQuery = '';
        this.highlightedIndex = 0;
        this.$nextTick(() => {
          if (this.searchable && this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
        });
      }
    },
    closeDropdown() {
      this.isOpen = false;
      this.searchQuery = '';
    },
    handleClickOutside(e) {
      if (!this.$el.contains(e.target)) {
        this.closeDropdown();
      }
    },
    isSelected(val) {
      return (this.modelValue || []).includes(val);
    },
    toggle(opt) {
      const cur = [...(this.modelValue || [])];
      const idx = cur.indexOf(opt.value);
      if (idx >= 0) {
        cur.splice(idx, 1);
      } else {
        cur.push(opt.value);
      }
      this.$emit('update:modelValue', cur);
      this.$emit('change', cur);
    },
    removeValue(val, e) {
      if (e) e.stopPropagation();
      const cur = (this.modelValue || []).filter(v => v !== val);
      this.$emit('update:modelValue', cur);
      this.$emit('change', cur);
    },
    clearAll(e) {
      if (e) e.stopPropagation();
      this.$emit('update:modelValue', []);
      this.$emit('change', []);
    }
  },
  template: `
    <div class="relative inline-block text-left w-full">
      <!-- Trigger -->
      <button
        type="button"
        @click="toggleDropdown"
        :disabled="disabled"
        :class="[
          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors select-none focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600',
          disabled ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400' : 'bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer shadow-2xs',
          buttonClass
        ]"
      >
        <div class="flex items-center flex-wrap gap-1 min-w-0 flex-1">
          <template v-if="selectedObjects.length">
            <span
              v-for="sel in displayedSelections"
              :key="sel.value"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-medium"
            >
              <span v-if="sel.color" class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: sel.color }"></span>
              <span v-if="sel.icon">{{ sel.icon }}</span>
              <span class="truncate max-w-[90px]">{{ sel.label }}</span>
              <span v-if="!disabled" @click="removeValue(sel.value, $event)" class="hover:text-zinc-900 dark:hover:text-white pl-0.5 cursor-pointer">×</span>
            </span>
            <span v-if="hiddenCount > 0" class="text-[10px] text-zinc-400">+{{ hiddenCount }}</span>
            <span v-if="!selectedObjects.length" class="text-zinc-400">{{ placeholder }}</span>
          </template>
          <template v-else>
            <span class="text-zinc-400">{{ placeholder }}</span>
          </template>
        </div>
        <div class="flex items-center space-x-1 shrink-0 ml-1.5 text-zinc-400">
          <button v-if="selectedObjects.length && !disabled" type="button" @click="clearAll" class="hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded">×</button>
          <span class="text-[9px] transition-transform duration-150" :class="{ 'rotate-180': isOpen }">▼</span>
        </div>
      </button>

      <!-- Dropdown -->
      <div
        v-show="isOpen"
        class="absolute left-0 right-0 z-50 mt-1 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur-sm overflow-hidden text-xs"
        role="listbox"
      >
        <div v-if="searchable" class="p-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-zinc-400 text-xs">🔍</span>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholder"
              class="w-full pl-7 pr-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              @click.stop
            />
          </div>
        </div>
        <div class="max-h-52 overflow-y-auto p-1 space-y-0.5">
          <div
            v-for="(opt, idx) in filteredOptions"
            :key="opt.value"
            @click="toggle(opt)"
            @mouseenter="highlightedIndex = idx"
            :class="[
              'flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none',
              highlightedIndex === idx ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
              isSelected(opt.value) ? 'bg-zinc-100 dark:bg-zinc-800/80 font-semibold text-zinc-900 dark:text-zinc-100' : ''
            ]"
          >
            <div class="flex items-center space-x-2 truncate">
              <span v-if="opt.icon" class="text-xs shrink-0">{{ opt.icon }}</span>
              <span v-if="opt.color" class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: opt.color }"></span>
              <div class="truncate">
                <span class="truncate">{{ opt.label }}</span>
                <p v-if="opt.description" class="text-[10px] text-zinc-400 truncate">{{ opt.description }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-1.5 shrink-0 ml-2">
              <span v-if="opt.badge" class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono">{{ opt.badge }}</span>
              <span v-if="isSelected(opt.value)" class="text-zinc-900 dark:text-zinc-100 font-bold">✓</span>
            </div>
          </div>
          <div v-if="filteredOptions.length === 0" class="py-3 text-center text-zinc-400 text-xs italic">No matching options</div>
        </div>
      </div>
    </div>
  `
};
