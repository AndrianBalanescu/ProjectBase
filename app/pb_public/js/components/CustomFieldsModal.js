// pb_public/js/components/CustomFieldsModal.js
// ProjectBase — per-project custom field definition manager.
// Lets admins/editors define arbitrary custom fields (text/number/select/
// checkbox/date) that appear on issues. Definitions are stored in
// projects.custom_field_defs; values live on issues.custom_fields.

const CustomFieldsModalComponent = {
  props: ['isOpen', 'project'],
  emits: ['close', 'saved'],
  data() {
    return {
      loading: false,
      saving: false,
      error: '',
      fields: [],          // normalized array from the API
      activeLabel: '',
      activeType: 'text',
      activeRequired: false,
      activeOptions: ''    // comma-separated for select type
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
      // derive a slug key like the backend
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      // ensure uniqueness
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
    <div v-if="isOpen && project" class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex justify-center items-center">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

      <div class="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60 select-none">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <i data-lucide="settings-2" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm font-bold text-white">Custom Fields · {{ project.name }}</h3>
          </div>

          <button @click="$emit('close')" class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <p class="text-xs text-gray-400 leading-relaxed">
            Define extra fields for issues in this project (Linear-style custom properties).
            Values appear on the issue detail drawer.
          </p>

          <div v-if="error" class="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
            {{ error }}
          </div>

          <!-- Existing Fields -->
          <div v-if="loading" class="text-xs text-gray-500">Loading...</div>
          <div v-else-if="fields.length" class="space-y-2">
            <div
              v-for="(f, idx) in fields"
              :key="f.key"
              class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-950/60 border border-gray-800"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-200 truncate">{{ f.label }} <span v-if="f.required" class="text-red-400 text-[10px]">required</span></div>
                  <div class="text-[11px] text-gray-500">{{ f.type }}<span v-if="f.type === 'select' && f.options.length"> · {{ f.options.join(', ') }}</span><span class="font-mono text-gray-600"> · {{ f.key }}</span></div>
                </div>
              </div>
              <button @click="removeField(idx)" class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors" title="Remove field">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <div v-else class="text-xs text-gray-500">No custom fields yet.</div>

          <!-- Add Field Form -->
          <div class="space-y-3 p-4 rounded-xl bg-gray-950/60 border border-gray-800">
            <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Field</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="col-span-2">
                <input
                  v-model="activeLabel"
                  placeholder="Field label (e.g. Client)"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <select
                  v-model="activeType"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
              <label class="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" v-model="activeRequired" class="accent-indigo-500" />
                Required
              </label>
            </div>
            <div v-if="activeType === 'select'">
              <input
                v-model="activeOptions"
                placeholder="Options, comma-separated (e.g. P0, P1, P2)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              @click="addField"
              class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              + Add Field
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-800 flex justify-end gap-2 bg-gray-950/60">
          <button @click="$emit('close')" class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors">Cancel</button>
          <button
            @click="save"
            :disabled="saving"
            class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save Fields' }}
          </button>
        </div>
      </div>
    </div>
  `
};

