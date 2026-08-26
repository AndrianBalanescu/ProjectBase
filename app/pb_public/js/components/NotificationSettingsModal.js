// pb_public/js/components/NotificationSettingsModal.js
// Minimalist notification channel configuration modal supporting Dark and Light themes.

const NotificationSettingsModalComponent = {
  props: ['isOpen'],
  emits: ['close', 'saved'],
  data() {
    return {
      loading: false,
      saving: false,
      error: '',
      saved: '',
      form: {
        discord_webhook_url: '',
        telegram_token: '',
        telegram_chat_id: '',
        generic_webhook_url: ''
      }
    };
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.error = '';
        this.saved = '';
        this.loadSettings();
        this.$nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    async loadSettings() {
      this.loading = true;
      this.error = '';
      try {
        if (typeof API === 'undefined' || !API.getNotificationSettings) {
          this.error = 'Notification settings API is not available.';
          return;
        }
        const data = await API.getNotificationSettings();
        this.form = {
          discord_webhook_url: data.discord_webhook_url || '',
          telegram_token: data.telegram_token || '',
          telegram_chat_id: data.telegram_chat_id || '',
          generic_webhook_url: data.generic_webhook_url || ''
        };
      } catch (err) {
        this.error = 'Failed to load notification settings: ' + String((err && err.message) || err);
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.error = '';
      this.saved = '';
      this.saving = true;
      try {
        if (typeof API === 'undefined' || !API.updateNotificationSettings) {
          this.error = 'Notification settings API is not available.';
          return;
        }
        const data = await API.updateNotificationSettings(this.form);
        this.form = {
          discord_webhook_url: data.discord_webhook_url || '',
          telegram_token: data.telegram_token || '',
          telegram_chat_id: data.telegram_chat_id || '',
          generic_webhook_url: data.generic_webhook_url || ''
        };
        this.saved = 'Notification channels updated successfully.';
        this.$emit('saved', data);
      } catch (err) {
        this.error = 'Failed to save notification settings: ' +
          String((err && err.data && err.data.message) || (err && err.message) || err);
      } finally {
        this.saving = false;
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" @click.self="close">
      <div class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" @click="close"></div>

      <div class="relative w-full max-w-lg rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
              <i data-lucide="bell" class="w-3.5 h-3.5"></i>
            </div>
            <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Notification Channels</h2>
          </div>
          <button @click="close" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">
          <p class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Configure where ProjectBase posts issue notifications. Applied immediately without restarting the server.
          </p>

          <div v-if="error" class="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300 text-xs">{{ error }}</div>
          <div v-if="saved" class="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs">{{ saved }}</div>

          <div v-if="loading" class="text-xs text-zinc-400 py-4 text-center">Loading current settings...</div>

          <template v-else>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Discord Webhook URL</label>
              <input v-model="form.discord_webhook_url" type="url" placeholder="https://discord.com/api/webhooks/..."
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Telegram Bot Token</label>
                <input v-model="form.telegram_token" type="text" placeholder="123456:ABC-..."
                  class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Telegram Chat ID</label>
                <input v-model="form.telegram_chat_id" type="text" placeholder="-1001234567890"
                  class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Generic Webhook URL</label>
              <input v-model="form.generic_webhook_url" type="url" placeholder="https://your-service.invalid/hook"
                class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
              <p class="text-[10px] text-zinc-400 mt-0.5">Receives a JSON payload when an issue is created or updated.</p>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button @click="close" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Close</button>
          <button
            @click="save"
            :disabled="saving || loading"
            class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
          >{{ saving ? 'Saving...' : 'Save Settings' }}</button>
        </div>
      </div>
    </div>
  `
};
