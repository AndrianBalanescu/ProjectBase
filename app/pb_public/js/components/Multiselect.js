// app/pb_public/js/components/Multiselect.js
// Reusable, keyboard-accessible multi-select component with search, chips and badges.

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
      return this.normalizedOptions.filter(o => this.modelValue.includes(o.value));
    },
    hiddenCount() {
      return Math.max(0, this.selectedObjects.length - this.maxDisplay);
    }
  },
  watch: {
    isOpen(nv) {
      if (nv) { this.searchQuery = ''; this.highlightedIndex = 0; this.$nextTick(() => this.$refs.searchInput && this.$refs.searchInput.focus()); }
    }
  },
  mounted() {
    document.addEventListener('click', this.handleDocClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleDocClick);
  },
  methods: {
    handleDocClick(e) {
      if (!this.$el || !this.$el.contains(e.target)) this.isOpen = false;
    },
    toggle() {
      if (!this.disabled) this.isOpen = !this.isOpen;
    },
    isSelected(v) {
      return this.modelValue.includes(v);
    },
    toggleOption(opt) {
      const vals = Array.isArray(this.modelValue) ? [...this.modelValue] : [];
      const idx = vals.indexOf(opt.value);
      if (idx >= 0) vals.splice(idx, 1);
      else vals.push(opt.value);
      this.$emit('update:modelValue', vals);
      this.$emit('change', vals);
    },
    removeValue(value, e) {
      if (e) e.stopPropagation();
      this.toggle({ value });
    },
    onKeyDown(e) {
      if (!this.isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this.isOpen = true; }
        return;
      }
      const total = this.filteredOptions.length;
      if (!total) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); this.highlightedIndex = (this.highlightedIndex + 1) % total; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.highlightedIndex = (this.highlightedIndex - 1 + total) % total; }
      else if (e.key === 'Enter') { e.preventDefault(); this.toggle(this.filteredOptions[this.highlightedIndex]); }
      else if (e.key === 'Escape') { this.isOpen = false; e.stopPropagation(); }
    },
    clearAll(e) {
      if (e) e.stopPropagation();
      this.$emit('update:modelValue', []);
      this.$emit('change', []);
    }
  },
  template: `
    <div class="relative w-full" @keydown="onKeyDown">
      <!-- Trigger / Chip Summary -->
      <button
        type="button"
        :disabled="disabled"
        @click="toggle"
        :class="[
          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all select-none focus:outline-none focus:ring-1 focus:ring-indigo-500',
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-900/40 border-gray-800 text-gray-500' : 'bg-gray-950/80 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-200 cursor-pointer shadow-sm',
          buttonClass
        ]"
      >
        <div class="flex items-center gap-1 flex-wrap min-w-0">
          <template v-if="selectedObjects.length">
            <span
              v-for="sel in selectedObjects.slice(0, maxDisplay)"
              :key="sel.value"
              class="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-[10px] font-medium"
            >
              <span v-if="sel.icon">{{ sel.icon }}</span>
              <span class="truncate max-w-[90px]">{{ sel.label }}</span>
              <span v-if="!disabled" @click="removeValue(sel.value, $event)" class="hover:text-white pl-1 cursor-pointer">×</span>
            </span>
            <span v-if="hiddenCount > 0" class="text-[10px] text-gray-400">+{{ hiddenCount }}</span>
            <span v-if="!selectedObjects.length" class="text-gray-500">{{ placeholder }}</span>
          </template>
          <template v-else>
            <span class="text-gray-500">{{ placeholder }}</span>
          </template>
        </div>
        <div class="flex items-center space-x-1 shrink-0 ml-1.5 text-gray-400">
          <button v-if="selectedObjects.length && !disabled" type="button" @click="clearAll" class="hover:text-white p-0.5 rounded">×</button>
          <span class="text-[9px] transition-transform duration-150" :class="{ 'rotate-180': isOpen }">▼</span>
        </div>
      </button>

      <!-- Dropdown -->
      <div
        v-show="isOpen"
        class="absolute left-0 right-0 z-50 mt-1 rounded-xl bg-gray-900/95 border border-gray-800 shadow-2xl backdrop-blur-md overflow-hidden text-xs"
        role="listbox"
      >
        <div v-if="searchable" class="p-1.5 border-b border-gray-800/80 bg-gray-950/50">
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-gray-500">🔍</span>
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
        <div class="max-h-52 overflow-y-auto p-1 space-y-0.5">
          <div
            v-for="(opt, idx) in filteredOptions"
            :key="opt.value"
            @click="toggle(opt)"
            @mouseenter="highlightedIndex = idx"
            :class="[
              'flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none',
              highlightedIndex === idx ? 'bg-indigo-600/20 text-white' : 'text-gray-300 hover:bg-gray-800/60',
              isSelected(opt.value) ? 'bg-indigo-950/40 text-indigo-200' : ''
            ]"
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
              <span v-if="isSelected(opt.value)" class="text-indigo-400 font-bold">✓</span>
            </div>
          </div>
          <div v-if="filteredOptions.length === 0" class="py-4 text-center text-gray-500 text-xs italic">No matching options</div>
        </div>
      </div>
    </div>
  `
};

window.MultiselectComponent = MultiselectComponent;
