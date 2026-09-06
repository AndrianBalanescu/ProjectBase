// app/pb_public/js/components/SearchableSelect.js
// Reusable, keyboard-accessible, searchable dropdown component supporting Dark and Light themes.

const SearchableSelectComponent = {
  props: {
    modelValue: { type: [String, Number, Object, null], default: null },
    options: { type: Array, default: () => [] }, // Array of { value, label, icon?, badge?, color? } or primitives
    placeholder: { type: String, default: 'Select option...' },
    searchPlaceholder: { type: String, default: 'Search...' },
    searchable: { type: Boolean, default: true },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    align: { type: String, default: 'left' }, // 'left' or 'right'
    buttonClass: { type: String, default: '' },
    dropdownClass: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'change', 'select'],
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
        return {
          value: opt,
          label: String(opt),
          icon: null,
          badge: null,
          color: null,
          description: null
        };
      });
    },
    filteredOptions() {
      if (!this.searchQuery.trim()) {
        return this.normalizedOptions;
      }
      const q = this.searchQuery.toLowerCase();
      return this.normalizedOptions.filter(o =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
      );
    },
    selectedOption() {
      return this.normalizedOptions.find(o => o.value === this.modelValue) || null;
    },
    displayLabel() {
      return this.selectedOption ? this.selectedOption.label : this.placeholder;
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
        this.highlightedIndex = Math.max(0, this.normalizedOptions.findIndex(o => o.value === this.modelValue));
        this.$nextTick(() => {
          if (this.searchable && this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
          this.scrollHighlightedIntoView();
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
    onKeyDown(e) {
      if (!this.isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.toggleDropdown();
        }
        return;
      }
      const total = this.filteredOptions.length;
      if (total === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.highlightedIndex = (this.highlightedIndex + 1) % total;
        this.scrollHighlightedIntoView();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.highlightedIndex = (this.highlightedIndex - 1 + total) % total;
        this.scrollHighlightedIntoView();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const option = this.filteredOptions[this.highlightedIndex];
        if (option) {
          this.selectOption(option);
        }
      } else if (e.key === 'Tab') {
        this.closeDropdown();
      }
    },
    scrollHighlightedIntoView() {
      this.$nextTick(() => {
        const list = this.$refs.optionsList;
        if (!list) return;
        const item = list.children[this.highlightedIndex];
        if (item) {
          item.scrollIntoView({ block: 'nearest' });
        }
      });
    },
    selectOption(option) {
      this.$emit('update:modelValue', option.value);
      this.$emit('change', option.value);
      this.$emit('select', option);
      this.closeDropdown();
    },
    clearSelection(e) {
      if (e) e.stopPropagation();
      this.$emit('update:modelValue', null);
      this.$emit('change', null);
      this.$emit('select', null);
    }
  },
  template: `
    <div class="relative inline-block text-left w-full" @keydown="onKeyDown">
      <!-- Select Button Trigger -->
      <button
        type="button"
        @click="toggleDropdown"
        :disabled="disabled"
        :class="[
          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors select-none focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600',
          disabled ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400' : 'bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer shadow-2xs',
          buttonClass
        ]"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
      >
        <div class="flex items-center space-x-2 truncate">
          <span v-if="selectedOption && selectedOption.icon" class="text-xs shrink-0">{{ selectedOption.icon }}</span>
          <span v-if="selectedOption && selectedOption.color" class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: selectedOption.color }"></span>
          <span class="truncate" :class="selectedOption ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-400'">{{ displayLabel }}</span>
          <span v-if="selectedOption && selectedOption.badge" class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">{{ selectedOption.badge }}</span>
        </div>

        <div class="flex items-center space-x-1 shrink-0 ml-1.5 text-zinc-400">
          <button
            v-if="clearable && selectedOption && !disabled"
            type="button"
            @click="clearSelection"
            class="hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded transition-colors"
            title="Clear selection"
          >
            ×
          </button>
          <span class="text-[9px] transition-transform duration-150" :class="{ 'rotate-180': isOpen }">▼</span>
        </div>
      </button>

      <!-- Dropdown Popover Menu -->
      <div
        v-show="isOpen"
        :class="[
          'absolute z-50 mt-1 min-w-[200px] max-w-[320px] w-full rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur-sm overflow-hidden text-xs transition-all',
          align === 'right' ? 'right-0' : 'left-0',
          dropdownClass
        ]"
        role="listbox"
      >
        <!-- Search Filter Input -->
        <div v-if="searchable && normalizedOptions.length > 5" class="p-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-zinc-400 text-xs pointer-events-none">🔍</span>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholder"
              class="w-full pl-7 pr-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 relative"
              @click.stop
            />
          </div>
        </div>

        <!-- Options List -->
        <div ref="optionsList" class="max-h-56 overflow-y-auto p-1 space-y-0.5">
          <div
            v-for="(opt, idx) in filteredOptions"
            :key="opt.value"
            @click="selectOption(opt)"
            @mouseenter="highlightedIndex = idx"
            :class="[
              'flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none',
              highlightedIndex === idx ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
              opt.value === modelValue ? 'font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/80' : ''
            ]"
            role="option"
            :aria-selected="opt.value === modelValue"
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
              <span v-if="opt.value === modelValue" class="text-zinc-900 dark:text-zinc-100 font-bold">✓</span>
            </div>
          </div>

          <!-- Empty Search State -->
          <div v-if="filteredOptions.length === 0" class="py-3 text-center text-zinc-400 text-xs italic">
            No matching options
          </div>
        </div>
      </div>
    </div>
  `
};
