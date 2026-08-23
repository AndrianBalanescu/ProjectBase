// app/pb_public/js/components/SearchableSelect.js
// Reusable, keyboard-accessible, searchable dropdown component for ProjectBase.

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
      return this.normalizedOptions.filter(opt =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
      );
    },
    selectedOption() {
      return this.normalizedOptions.find(opt => opt.value === this.modelValue) || null;
    },
    displayLabel() {
      return this.selectedOption ? this.selectedOption.label : this.placeholder;
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.searchQuery = '';
        this.highlightedIndex = 0;
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
        });
      }
    },
    filteredOptions() {
      this.highlightedIndex = 0;
    }
  },
  mounted() {
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleGlobalKeyDown);
  },
  methods: {
    toggleDropdown() {
      if (this.disabled) return;
      this.isOpen = !this.isOpen;
    },
    closeDropdown() {
      this.isOpen = false;
    },
    handleDocumentClick(e) {
      if (!this.$el || !this.$el.contains(e.target)) {
        this.closeDropdown();
      }
    },
    handleGlobalKeyDown(e) {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeDropdown();
      }
    },
    onKeyDown(e) {
      if (!this.isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          this.isOpen = true;
          e.preventDefault();
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
          'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all select-none focus:outline-none focus:ring-1 focus:ring-indigo-500',
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-900/40 border-gray-800 text-gray-500' : 'bg-gray-950/80 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-200 cursor-pointer shadow-sm',
          buttonClass
        ]"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
      >
        <div class="flex items-center space-x-2 truncate">
          <span v-if="selectedOption && selectedOption.icon" class="text-sm shrink-0">{{ selectedOption.icon }}</span>
          <span v-if="selectedOption && selectedOption.color" class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: selectedOption.color }"></span>
          <span class="truncate" :class="selectedOption ? 'text-gray-100 font-medium' : 'text-gray-500'">{{ displayLabel }}</span>
          <span v-if="selectedOption && selectedOption.badge" class="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 font-mono">{{ selectedOption.badge }}</span>
        </div>

        <div class="flex items-center space-x-1 shrink-0 ml-1.5 text-gray-400">
          <button
            v-if="clearable && selectedOption && !disabled"
            type="button"
            @click="clearSelection"
            class="hover:text-gray-200 p-0.5 rounded transition-colors"
            title="Clear selection"
          >
            ×
          </button>
          <span class="text-[10px] transition-transform duration-150" :class="{ 'rotate-180': isOpen }">▼</span>
        </div>
      </button>

      <!-- Dropdown Popover Menu -->
      <div
        v-show="isOpen"
        :class="[
          'absolute z-50 mt-1 min-w-[200px] max-w-[320px] w-full rounded-xl bg-gray-900/95 border border-gray-800 shadow-2xl backdrop-blur-md overflow-hidden text-xs transition-all',
          align === 'right' ? 'right-0' : 'left-0',
          dropdownClass
        ]"
        role="listbox"
      >
        <!-- Search Filter Input -->
        <div v-if="searchable && normalizedOptions.length > 5" class="p-1.5 border-b border-gray-800/80 bg-gray-950/50">
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-gray-500 text-xs">🔍</span>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholder"
              class="w-full pl-7 pr-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500/80"
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
              highlightedIndex === idx ? 'bg-indigo-600/20 text-white' : 'text-gray-300 hover:bg-gray-800/60',
              opt.value === modelValue ? 'font-semibold text-indigo-300 bg-indigo-950/40' : ''
            ]"
            role="option"
            :aria-selected="opt.value === modelValue"
          >
            <div class="flex items-center space-x-2 truncate">
              <span v-if="opt.icon" class="text-sm shrink-0">{{ opt.icon }}</span>
              <span v-if="opt.color" class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: opt.color }"></span>
              <div class="truncate">
                <span class="truncate">{{ opt.label }}</span>
                <p v-if="opt.description" class="text-[10px] text-gray-500 truncate">{{ opt.description }}</p>
              </div>
            </div>

            <div class="flex items-center space-x-1.5 shrink-0 ml-2">
              <span v-if="opt.badge" class="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 font-mono">{{ opt.badge }}</span>
              <span v-if="opt.value === modelValue" class="text-indigo-400 font-bold">✓</span>
            </div>
          </div>

          <!-- Empty Search State -->
          <div v-if="filteredOptions.length === 0" class="py-4 text-center text-gray-500 text-xs italic">
            No matching options
          </div>
        </div>
      </div>
    </div>
  `
};

window.SearchableSelectComponent = SearchableSelectComponent;
