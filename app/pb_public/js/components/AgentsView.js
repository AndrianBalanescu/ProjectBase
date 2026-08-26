// pb_public/js/components/AgentsView.js
// Agentic-native: a full page that treats local AI agents as board teammates.
// Lists every detected agent (avatar, provider, live status) and, on selection,
// shows that agent's detail page (e.g. all live flomaster sessions, their
// working dirs and current intent lines).

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate'],
  data() {
    return {
      rescanning: false,
      search: ''
    };
  },
  computed: {
    // The agent whose detail page is open (or null -> team grid).
    activeAgent() {
      if (!this.activeAgentName) return null;
      return (this.agents || []).find(a => a.name === this.activeAgentName) || null;
    },
    onlineCount() {
      return (this.agents || []).filter(a => a.status === 'online').length;
    },
    sessionCount() {
      return (this.sessions || []).length;
    },
    // Sessions scoped to the selected agent (flomaster has live ones).
    activeSessions() {
      const all = this.sessions || [];
      if (this.activeAgent) return all.filter(s => s.agent === this.activeAgent.name);
      return all;
    },
    filteredAgents() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.agents || [];
      return (this.agents || []).filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.provider || '').toLowerCase().includes(q) ||
        (a.runtime || '').toLowerCase().includes(q)
      );
    }
  },
  methods: {
    open(agent) {
      this.$emit('navigate', agent.name);
    },
    back() {
      this.$emit('navigate', null);
    },
    statusDot(status) {
      return status === 'online' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-gray-600';
    },
    statusLabel(status) {
      return status === 'online' ? 'Online' : 'Offline';
    },
    initial(name) {
      return ((name || '?')[0] || '?').toUpperCase();
    },
    fmtTime(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    },
    providerBadge(provider) {
      const map = {
        'openai-api': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
        'openrouter': 'text-sky-300 bg-sky-500/10 border-sky-500/30',
        'mixed': 'text-purple-300 bg-purple-500/10 border-purple-500/30',
        'openai': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
        'inflection': 'text-pink-300 bg-pink-500/10 border-pink-500/30'
      };
      return map[provider] || 'text-gray-300 bg-gray-500/10 border-gray-500/30';
    },
    workingDirLabel(dir) {
      if (!dir) return '—';
      // collapse long paths to something readable, keep last 2 segments
      const parts = dir.split('/').filter(Boolean);
      if (parts.length <= 2) return dir;
      return '…/' + parts.slice(-2).join('/');
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#0b0f19]">
      <div class="max-w-6xl mx-auto p-6 space-y-6">

        <!-- ============ Detail page for a single agent ============ -->
        <div v-if="activeAgent" class="space-y-6">
          <button
            @click="back"
            class="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            <span>All agents</span>
          </button>

          <!-- Agent hero -->
          <div class="flex items-center gap-5 bg-gray-900/70 border border-gray-800 rounded-2xl p-6">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              {{ activeAgent.avatar }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2.5">
                <h2 class="text-2xl font-bold text-white tracking-tight">{{ activeAgent.name }}</h2>
                <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="activeAgent.status === 'online' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-gray-500/10 text-gray-400 border border-gray-600'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(activeAgent.status)"></span>
                  {{ statusLabel(activeAgent.status) }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <span class="px-2 py-0.5 rounded-md border font-mono" :class="providerBadge(activeAgent.provider)">{{ activeAgent.provider || 'unknown' }}</span>
                <span class="px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 font-mono">{{ activeAgent.runtime || '—' }}</span>
                <span class="text-gray-500 font-mono">{{ activeAgent.source_dir || '—' }}</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0 hidden sm:block">
              <div class="text-2xl font-bold text-white">{{ activeSessions.length }}</div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">live sessions</div>
            </div>
          </div>

          <!-- Live sessions -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">Live sessions</h3>
              <span class="text-[11px] text-gray-500">{{ activeSessions.length }} found · newest first</span>
            </div>

            <div v-if="activeSessions.length" class="space-y-3">
              <div
                v-for="(s, i) in activeSessions"
                :key="s.id || i"
                class="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
              >
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold flex-shrink-0">
                      {{ initial(s.short_name || s.title || s.id) }}
                    </span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-white truncate">{{ s.short_name || s.title || 'Untitled session' }}</span>
                        <span v-if="s.status" class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                          :class="s.status === 'Active' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-gray-600/20 text-gray-400 border border-gray-700'">
                          <span class="w-1 h-1 rounded-full" :class="s.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-500'"></span>
                          {{ s.status }}
                        </span>
                      </div>
                      <div class="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span class="font-mono">{{ s.model || '—' }}</span>
                        <span>·</span>
                        <span class="flex items-center gap-1">
                          <i data-lucide="folder" class="w-3 h-3"></i>
                          <span class="font-mono" :title="s.working_dir">{{ workingDirLabel(s.working_dir) }}</span>
                        </span>
                        <span>·</span>
                        <span>{{ s.message_count }} messages</span>
                        <span>·</span>
                        <span>active {{ fmtTime(s.last_active_at) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="s.intention" class="mt-3 pl-11">
                  <div class="bg-indigo-950/40 border-l-2 border-indigo-500 rounded-r-lg px-3 py-2">
                    <div class="text-[10px] uppercase tracking-wide text-indigo-400 mb-0.5">Current intent</div>
                    <p class="text-xs text-gray-300 leading-relaxed">{{ s.intention }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="bg-gray-900/50 border border-dashed border-gray-800 rounded-xl p-8 text-center">
              <div class="text-2xl mb-2">{{ activeAgent.avatar }}</div>
              <p class="text-sm text-gray-400">No live sessions detected for {{ activeAgent.name }}.</p>
              <p class="text-xs text-gray-600 mt-1">The bridge only surfaces agents actively running a session on this machine.</p>
            </div>
          </div>
        </div>

        <!-- ============ Team grid (all agents) ============ -->
        <div v-else class="space-y-6">
          <div class="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 class="text-xl font-bold text-white tracking-tight">Agent Team</h2>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ agents.length }} agents · <span class="text-emerald-400">{{ onlineCount }} online</span> · {{ sessionCount }} live session(s) · source: {{ agentSource || 'bridge' }}
              </p>
            </div>
            <div class="relative">
              <i data-lucide="search" class="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
              <input
                v-model="search"
                type="text"
                placeholder="Search agents…"
                class="bg-gray-900/70 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 w-52"
              />
            </div>
          </div>

          <!-- Agent cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <button
              v-for="a in filteredAgents"
              :key="a.name"
              @click="open(a)"
              class="text-left bg-gray-900/70 border border-gray-800 rounded-2xl p-5 hover:border-indigo-500/50 hover:bg-gray-900 transition-all group flex flex-col"
            >
              <div class="flex items-start justify-between">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/10 flex-shrink-0">
                  {{ a.avatar }}
                </div>
                <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="a.status === 'online' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-gray-600/10 text-gray-500 border border-gray-700'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(a.status)"></span>
                  {{ statusLabel(a.status) }}
                </span>
              </div>

              <div class="mt-3 flex items-center justify-between">
                <span class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{{ a.name }}</span>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all"></i>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span class="px-1.5 py-0.5 rounded border text-[10px] font-mono" :class="providerBadge(a.provider)">{{ a.provider || 'unknown' }}</span>
                <span class="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono">{{ a.runtime }}</span>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-500">
                <span class="font-mono truncate" :title="a.source_dir">{{ a.source_dir }}</span>
                <span class="flex items-center gap-1 font-semibold"
                  :class="(a.session_count || 0) > 0 ? 'text-indigo-300' : 'text-gray-600'">
                  <i data-lucide="layers" class="w-3 h-3"></i>
                  {{ a.session_count || 0 }} session(s)
                </span>
              </div>
            </button>
          </div>

          <!-- Flomaster live sessions (top-level preview) -->
          <div v-if="activeSessions.length">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">Active work right now</h3>
              <span class="text-[11px] text-gray-500">{{ activeSessions.length }} live sessions</span>
            </div>
            <div class="space-y-3">
              <div
                v-for="(s, i) in activeSessions.slice(0, 4)"
                :key="s.id || i"
                class="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer"
                @click="open({ name: s.agent })"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold flex-shrink-0">
                    {{ initial(s.short_name || s.id) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-white truncate">{{ s.short_name || 'Untitled session' }}</span>
                      <span class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        <span class="w-1 h-1 rounded-full bg-emerald-400"></span>{{ s.status }}
                      </span>
                    </div>
                    <p v-if="s.intention" class="text-xs text-gray-400 mt-0.5 truncate">{{ s.intention }}</p>
                    <div class="text-[11px] text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                      <span class="font-mono">{{ workingDirLabel(s.working_dir) }}</span>
                      <span>·</span>
                      <span>{{ s.message_count }} msgs</span>
                      <span>·</span>
                      <span>{{ fmtTime(s.last_active_at) }}</span>
                    </div>
                  </div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-gray-600 flex-shrink-0"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
