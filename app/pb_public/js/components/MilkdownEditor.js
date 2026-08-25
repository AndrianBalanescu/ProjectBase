// app/pb_public/js/components/MilkdownEditor.js
// Lightweight zero-dependency Markdown editor (replaces the 2.7MB Milkdown WYSIWYG bundle).
// Split view: live textarea (Write) + rendered preview (using vendored `marked` + DOMPurify).
// Code fences render as styled blocks with a language badge and a one-click copy button.
// The component keeps the same tag/registration (`<milkdown-editor>`) so IssueDrawer is untouched.

const MdEditorComponent = {
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: 'Write a detailed Markdown description…' },
    readonly: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'blur', 'ready', 'error'],
  data() {
    return {
      draft: this.modelValue || '',
      live: true,            // live split preview (false = preview-only tab)
      copiedId: null
    };
  },
  computed: {
    rendered() {
      if (!window.marked) return '';
      const src = this.draft || '';
      try {
        let html = window.marked.parse(src);
        html = this.enhanceCodeBlocks(html);
        return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
      } catch (_) {
        return '';
      }
    }
  },
  watch: {
    modelValue(value) {
      if (this.draft !== (value || '')) this.draft = value || '';
    }
  },
  mounted() {
    this.$emit('ready', this);
    if (!window.marked) {
      this.$emit('error', new Error('Markdown renderer unavailable'));
    }
  },
  methods: {
    // Re-annotate fenced code blocks with a language label + copy button.
    // Marked renders ```lang as <pre><code class="language-x">...</code></pre>.
    enhanceCodeBlocks(html) {
      if (!html || !html.includes('<pre>')) return html;
      return html.replace(
        /<pre>[\s\S]*?<code( class="language-([^"]*)")?>[\s\S]*?<\/code><\/pre>/g,
        (block, cls, lang) => {
          const label = (lang || 'code').trim();
          const id = 'mdcode-' + Math.random().toString(36).slice(2, 9);
          const btn = `<button type="button" data-copy-id="${id}" class="md-code-copy" title="Copy code">Copy</button>`;
          const badge = `<span class="md-code-lang">${label}</span>`;
          const head = `<div class="md-code-head">${badge}${btn}</div>`;
          return `<div class="md-codeblock" data-code-id="${id}">${head}${block}</div>`;
        }
      );
    },
    onInput() {
      this.$emit('update:modelValue', this.draft);
    },
    // Handle copy-button clicks via delegation (DOMPurify strips inline handlers).
    onCopyClick(ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-copy-id]') : null;
      if (!btn) return;
      const wrap = btn.closest('.md-codeblock');
      const code = wrap && wrap.querySelector('code');
      if (!code) return;
      const text = code.innerText || code.textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => this.flashCopied(btn)).catch(() => {});
      } else {
        this.fallbackCopy(text);
        this.flashCopied(btn);
      }
      ev.preventDefault();
    },
    flashCopied(btn) {
      const old = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1200);
    },
    fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    },
    emitBlur() {
      this.$emit('blur');
    }
  },
  template: `
    <div class="md-editor-shell" @focusout="emitBlur" @click="onCopyClick">
      <template v-if="!readonly">
        <div class="md-editor-tabs">
          <button type="button" class="md-tab" :class="live ? 'active' : ''" @click="live = true">Write</button>
          <button type="button" class="md-tab" :class="!live ? 'active' : ''" @click="live = false">Preview</button>
        </div>
        <textarea
          v-if="live"
          :value="draft"
          @input="draft = $event.target.value; onInput()"
          :placeholder="placeholder"
          class="md-editor-ta"
        ></textarea>
        <div v-else class="md-preview markdown-body" v-html="rendered"></div>
      </template>
      <div v-else class="md-preview markdown-body" v-html="rendered"></div>
    </div>
  `
};

window.MilkdownEditorComponent = MdEditorComponent;
