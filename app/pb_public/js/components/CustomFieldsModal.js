// pb_public/js/components/CustomFieldsModal.js
// Minimalist per-project custom field manager supporting Dark and Light themes.

const CustomFieldsModalComponent = {
  props: ['isOpen', 'project'],
  emits: ['close', 'saved'],
  data() {
    return {
      loading: false,
      saving: false,
      error: '',
      fields: [],
      activeLabel: '',
      activeType: 'text',
      activeRequired: false,
      activeOptions: ''
    };
  },
  computed: {
    types() {
      return [
        { value: 'text', label: 'Text' },
        { value: 'number', label: 'Number' },
        { value: 'select', label: 'Select' },
        { value: 'checkbox', label: 'Checkbox' },
        { value: 'date', label: 'Date' }
      ];
    }
  },
  watch: {
    isOpen(newVal) {
      if (newVal && this.project) {
        this.loadFields();
      }
    }
  },
  methods: {
    async loadFields() {
      this.loading = true;
      this.error = '';
      try {
        const res = await API.getCustomFields(this.project.id);
        this.fields = (res && res.fields) || [];
      } catch (err) {
        console.error('Custom fields load error:', err);
        this.error = 'Failed to load custom fields';
      } finally {
        this.loading = false;
      }
    },
    addField() {
      const label = this.activeLabel.trim();
      if (!label) return;
      let options = [];
      if (this.activeType === 'select') {
        options = this.activeOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (options.length === 0) {
          this.error = 'Select fields need at least one option (comma-separated)';
          return;
        }
      }
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      let k = key, n = 1;
      while (this.fields.some(f => f.key === k)) { k = key + '_' + (n++); }
      this.fields.push({ key: k, label: label, type: this.activeType, required: this.activeRequired, options: options });
      this.activeLabel = '';
      this.activeType = 'text';
      this.activeRequired = false;
      this.activeOptions = '';
      this.error = '';
    },
    removeField(index) {
      this.fields.splice(index, 1);
    },
    async save() {
      this.saving = true;
      this.error = '';
      try {
        const res = await API.saveCustomFields(this.project.id, this.fields);
        this.fields = (res && res.fields) || this.fields;
        this.$emit('saved', this.fields);
        this.$emit('close');
      } catch (err) {
        console.error('Custom fields save error:', err);
        this.error = (err && err.data && err.data.message) || err.message || 'Failed to save custom fields';
      } finally {
        this.saving = false;
      }
    }
  },
  template: `
    <div v-if="isOpen && project" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center select-none">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Custom Fields · {{ project.name }}</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">
          <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Define custom properties for issues in this project. Values appear on the issue drawer.
          </p>

          <div v-if="error" class="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-xs">
            {{ error }}
          </div>

          <!-- Existing Fields -->
          <div v-if="loading" class="text-xs text-zinc-400">Loading...</div>
          <div v-else-if="fields.length" class="space-y-1.5">
            <div
              v-for="(f, idx) in fields"
              :key="f.key"
              class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0"></span>
                <div class="min-w-0">
                  <div class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {{ f.label }}
                    <span v-if="f.required" class="text-rose-500 text-[10px] ml-1">required</span>
                  </div>
                  <div class="text-[10px] text-zinc-400 font-mono">
                    {{ f.type }}<span v-if="f.type === 'select' && f.options.length"> · {{ f.options.join(', ') }}</span> · {{ f.key }}
                  </div>
                </div>
              </div>
              <button @click="removeField(idx)" class="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Remove field">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
          <div v-else class="text-xs text-zinc-400">No custom fields defined yet.</div>

          <!-- Add Field Form -->
          <div class="space-y-2.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
            <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Add Field</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div class="col-span-2">
                <input
                  v-model="activeLabel"
                  placeholder="Field label (e.g. Client)"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>
              <div>
                <select
                  v-model="activeType"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer"
                >
                  <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
              <label class="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input type="checkbox" v-model="activeRequired" class="rounded border-zinc-300 text-zinc-900" />
                Required
              </label>
            </div>
            <div v-if="activeType === 'select'">
              <input
                v-model="activeOptions"
                placeholder="Options, comma-separated (e.g. P0, P1, P2)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
            <button
              @click="addField"
              class="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              + Add Field
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button @click="$emit('close')" class="px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            @click="save"
            :disabled="saving"
            class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
          >
            {{ saving ? 'Saving...' : 'Save Fields' }}
          </button>
        </div>
      </div>
    </div>
  `
};
