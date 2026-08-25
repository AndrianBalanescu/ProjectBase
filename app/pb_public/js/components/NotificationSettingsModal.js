// pb_public/js/components/NotificationSettingsModal.js
// In-app notification channel configuration (self-hosted, cycle 33).
// The dispatcher (app/pb_hooks/60_notifications.pb.js) previously only read
// channel config from process environment (DISCORD_WEBHOOK_URL, TELEGRAM_*,
// PROJECTBASE_WEBHOOK_URL). This modal reads/writes the same values through
// the admin-gated /api/projectbase/notification-settings routes backed by the
// `notification_settings` singleton collection, so a self-hoster can change
// Discord / Telegram / generic-webhook channels without restarting the binary.
// The dispatcher reads the DB row first and falls back to env (env only wins
// when the DB value is empty), so existing installs keep working unchanged.

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
        this.saved = 'Notification channels updated. They take effect immediately without a restart.';
        this.$emit('saved', data);
      } catch (err) {
        this.error = 'Failed to save notification settings: ' + String((err && err.message) || err);
      } finally {
        this.saving = false;
      }
    }
  },
  template: `
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="close">
      <div class="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div class="flex items-center space-x-2">
            <i data-lucide="bell" class="w-4 h-4 text-indigo-400"></i>
            <h2 class="text-sm font-semibold text-white">Notification Channels</h2>
          </div>
          <button @click="close" class="text-gray-400 hover:text-white transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <div class="p-5 space-y-4">
          <p class="text-[11px] leading-relaxed text-gray-500">
            Configure where ProjectBase posts issue notifications. These values are
            stored in your local database and applied immediately, no restart needed.
            Leave a field blank to fall back to the process environment (or to disable
            that channel entirely).
          </p>

          <div v-if="error" class="px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">{{ error }}</div>
          <div v-if="saved" class="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">{{ saved }}</div>

          <div v-if="loading" class="text-xs text-gray-400 py-4 text-center">Loading current settings...</div>

          <template v-else>
            <div>
              <label class="text-xs font-medium text-gray-400 mb-1 block">Discord Webhook URL</label>
              <input v-model="form.discord_webhook_url" type="url" placeholder="https://discord.com/api/webhooks/..." class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="text-xs font-medium text-gray-400 mb-1 block">Telegram Bot Token</label>
                <input v-model="form.telegram_token" type="text" placeholder="123456:ABC-..." class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-400 mb-1 block">Telegram Chat ID</label>
                <input v-model="form.telegram_chat_id" type="text" placeholder="-1001234567890" class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label class="text-xs font-medium text-gray-400 mb-1 block">Generic Webhook URL</label>
              <input v-model="form.generic_webhook_url" type="url" placeholder="https://your-service.invalid/hook" class="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <p class="text-[11px] text-gray-500 mt-1">Receives a JSON payload when an issue's status changes.</p>
            </div>
          </template>
        </div>

        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-950/50">
          <button @click="close" class="px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-gray-800">Close</button>
          <button
            @click="save"
            :disabled="saving || loading"
            class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ saving ? 'Saving...' : 'Save Settings' }}</button>
        </div>
      </div>
    </div>
  `
};
