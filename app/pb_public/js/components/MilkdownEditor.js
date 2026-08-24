// app/pb_public/js/components/MilkdownEditor.js
// Vue 3 adapter for the vendored Milkdown Crepe browser bundle.
// The editor stores Markdown, so existing PocketBase descriptions remain compatible.

const MilkdownEditorComponent = {
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: 'Write a detailed Markdown description…' },
    readonly: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'blur', 'ready', 'error'],
  data() {
    return {
      editor: null,
      syncing: false,
      errorMessage: ''
    };
  },
  mounted() {
    this.mountEditor();
  },
  beforeUnmount() {
    this.destroyEditor();
  },
  watch: {
    modelValue(value) {
      if (!this.editor || this.syncing) return;
      // The Crepe instance exposes getMarkdown, but crepe.create() may resolve
      // to a wrapper without it. Guard so an external modelValue update never
      // throws an uncaught TypeError (pre-existing console error).
      let current;
      try {
        current = typeof this.editor.getMarkdown === 'function' ? this.editor.getMarkdown() : null;
      } catch (_) {
        current = null;
      }
      if (current === null || value === current) return;
      this.syncing = true;
      try {
        this.editor.editor.action((ctx) => {
          const editorView = ctx.get(Milkdown.EditorViewCtx);
          const state = editorView.state;
          const tr = state.tr.replaceWith(0, state.doc.content.size,
            state.schema.text(value || ''));
          editorView.dispatch(tr);
        });
      } catch (_) {
        // Milkdown owns the document model; avoid disrupting typing on a stale update.
      } finally {
        this.syncing = false;
      }
    },
    readonly(value) {
      if (this.editor) this.editor.setReadonly(value);
    }
  },
  methods: {
    async mountEditor() {
      if (!window.Milkdown || !window.Milkdown.Crepe) {
        this.errorMessage = 'Milkdown bundle is unavailable.';
        this.$emit('error', new Error(this.errorMessage));
        return;
      }
      try {
        const crepe = new window.Milkdown.Crepe({
          root: this.$refs.editor,
          defaultValue: this.modelValue || ''
        });
        crepe.setReadonly(this.readonly);
        crepe.on((listener) => {
          listener.markdownUpdated((_ctx, markdown) => {
            if (this.syncing) return;
            this.$emit('update:modelValue', markdown);
          });
        });
        this.editor = await crepe.create();
        this.$emit('ready', this.editor);
      } catch (error) {
        this.errorMessage = 'Unable to initialize the Markdown editor.';
        this.$emit('error', error);
      }
    },
    async destroyEditor() {
      if (!this.editor) return;
      try {
        await this.editor.destroy();
      } catch (_) {
        // Teardown should never prevent the drawer from closing.
      }
      this.editor = null;
    },
    emitBlur() {
      this.$emit('blur');
    }
  },
  template: `
    <div class="milkdown-editor-shell" @focusout="emitBlur">
      <div ref="editor" class="milkdown-editor" :aria-label="placeholder"></div>
      <p v-if="errorMessage" class="mt-2 text-[11px] text-amber-400">{{ errorMessage }} Falling back to Markdown preview is recommended.</p>
    </div>
  `
};

window.MilkdownEditorComponent = MilkdownEditorComponent;
