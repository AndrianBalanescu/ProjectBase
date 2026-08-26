// pb_public/js/components/AgentsView.js
// Multica 2.0: Minimalist, ultra-dense, full-width agent cockpit dashboard.
// Low-contrast refined palette, light & dark theme support, live streaming tools & reasoning,
// session continuation/resume on tickets, active checklist, and 1-click dispatch.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all', // 'all' | 'online'
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null,
      liveStreamActive: true,
      pollTimer: null,
      activeTab: 'activity' // 'activity' | 'tools' | 'reasoning' | 'todos'
    };
  },
  computed: {
    onlineAgents() {
      return (this.agents || []).filter(a => a.status === 'online');
    },
    totalSessions() {
      return (this.sessions || []).length;
    },
    activeAgent() {
      if (!this.activeAgentName) return null;
      return (this.agents || []).find(a => a.name === this.activeAgentName) || null;
    },
    filteredAgents() {
      let list = this.agents || [];
      if (this.filterStatus === 'online') {
        list = list.filter(a => a.status === 'online');
      }
      const q = this.search.trim().toLowerCase();
      if (!q) return list;
      return list.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.provider || '').toLowerCase().includes(q) ||
        (a.runtime || '').toLowerCase().includes(q)
      );
    },
    visibleSessions() {
      const all = this.sessions || [];
      if (this.activeAgent) {
        return all.filter(s => s.agent === this.activeAgent.name);
      }
      return all;
    },
    selectedSession() {
      if (!this.selectedSessionId) {
        return this.visibleSessions[0] || null;
      }
      return this.visibleSessions.find(s => s.id === this.selectedSessionId) || this.visibleSessions[0] || null;
    }
  },
  watch: {
    visibleSessions: {
      immediate: true,
      handler(newSessions) {
        if (!this.selectedSessionId && newSessions && newSessions.length > 0) {
          this.selectedSessionId = newSessions[0].id;
        }
      }
    }
  },
  mounted() {
    if (window.lucide) window.lucide.createIcons();
    // Live streaming poll: refresh telemetry every 3.5 seconds
    this.pollTimer = setInterval(() => {
      if (this.liveStreamActive) {
        this.$emit('sync-agents');
      }
    }, 3500);
  },
  beforeUnmount() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },
  updated() {
    if (window.lucide) window.lucide.createIcons();
  },
  methods: {
    selectAgent(agentName) {
      this.$emit('navigate', agentName || null);
      this.selectedSessionId = null;
    },
    selectSession(s) {
      this.selectedSessionId = s.id;
    },
    statusDot(status) {
      return status === 'online' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-600';
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
    workingDirLabel(dir) {
      if (!dir) return '—';
      const parts = dir.split('/');
      return parts.slice(-2).join('/');
    },
    toolColor(name) {
      if (!name) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
      if (name.includes('edit') || name.includes('write') || name.includes('patch')) {
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60';
      }
      if (name.includes('read') || name.includes('grep') || name.includes('find') || name.includes('ls')) {
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60';
      }
      if (name.includes('bash') || name.includes('cmd') || name.includes('exec')) {
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60';
      }
      if (name.includes('mcp') || name.includes('todo') || name.includes('goal')) {
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60';
      }
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
    },
    async quickDispatch(agentName) {
      if (!this.quickPrompt.trim()) return;
      this.isDispatching = true;
      this.dispatchSuccess = null;
      try {
        const target = agentName || (this.activeAgent ? this.activeAgent.name : 'flomaster');
        const res = await API.dispatchAgent(target, {
          title: this.quickPrompt.slice(0, 80),
          instructions: this.quickPrompt,
          session_id: this.selectedSession ? this.selectedSession.id : null
        });
        this.dispatchSuccess = `Dispatched to ${target}`;
        this.quickPrompt = '';
        setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        this.$emit('sync-agents');
      } catch (e) {
        console.error('Quick dispatch failed', e);
      } finally {
        this.isDispatching = false;
      }
    },
    createTicketFromSession(session) {
      if (!session) return;
      this.$emit('open-new-issue', {
        title: session.intention ? session.intention.slice(0, 100) : (session.title || 'Task from session ' + session.short_name),
        description: `### Originating Session\n- **Agent:** \`${session.agent}\`\n- **Session:** \`${session.short_name || session.id}\`\n- **Model:** \`${session.model}\`\n- **CWD:** \`${session.working_dir}\`\n\n### Intent\n${session.intention || 'No explicit intent specified.'}\n\n### Relevant Files\n${(session.files_touched || []).map(f => '- `' + f + '`').join('\n') || '- None'}`
      });
    }
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- ========================================================= -->
      <!-- PANE 1: LEFT AGENT TABS SIDEBAR (COMPACT, MINIMALIST)     -->
      <!-- ========================================================= -->
      <aside class="w-full md:w-60 shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
        <!-- Sidebar Header -->
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Agent Fleet</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
              {{ onlineAgents.length }}/{{ (agents || []).length }} ON
            </span>
            <button
              @click="$emit('sync-agents')"
              class="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Rescan Agents"
            >
              <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Filter & Search Box -->
        <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80 space-y-1.5 bg-zinc-50/30 dark:bg-zinc-950/20">
          <div class="relative">
            <i data-lucide="search" class="w-3 h-3 absolute left-2 top-2 text-zinc-400"></i>
            <input
              v-model="search"
              type="text"
              placeholder="Filter agents..."
              class="w-full pl-6 pr-2 py-1 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
          </div>
          <div class="flex gap-1">
            <button
              @click="filterStatus = 'all'"
              class="flex-1 py-0.5 text-[10px] font-medium rounded transition-colors text-center"
              :class="filterStatus === 'all' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >
              All ({{ (agents || []).length }})
            </button>
            <button
              @click="filterStatus = 'online'"
              class="flex-1 py-0.5 text-[10px] font-medium rounded transition-colors text-center flex items-center justify-center gap-1"
              :class="filterStatus === 'online' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
              Live ({{ onlineAgents.length }})
            </button>
          </div>
        </div>

        <!-- Agent Tabs List -->
        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <!-- All Agents Overview Option -->
          <button
            @click="selectAgent(null)"
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors"
            :class="!activeAgentName ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm">🌐</span>
              <span class="truncate">Workspace Fleet</span>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/60 text-[10px] font-mono font-medium">
              {{ totalSessions }}
            </span>
          </button>

          <!-- Individual Detected Agents -->
          <button
            v-for="agent in filteredAgents"
            :key="agent.name"
            @click="selectAgent(agent.name)"
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors"
            :class="activeAgentName === agent.name ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm shrink-0">{{ agent.avatar || '🤖' }}</span>
              <div class="min-w-0">
                <div class="truncate capitalize flex items-center gap-1">
                  <span>{{ agent.name }}</span>
                  <span v-if="agent.core" class="text-[8px] uppercase tracking-wider text-zinc-400">core</span>
                </div>
                <div class="text-[10px] font-mono text-zinc-400 truncate">
                  {{ agent.provider }}
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-1.5 shrink-0">
              <span v-if="agent.session_count" class="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/60 text-[10px] font-mono">
                {{ agent.session_count }}
              </span>
              <span class="w-2 h-2 rounded-full" :class="statusDot(agent.status)" :title="agent.status"></span>
            </div>
          </button>
        </div>

        <!-- Telemetry Source Footer -->
        <div class="p-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
          <span class="flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full" :class="agentSource === 'bridge' ? 'bg-emerald-500' : 'bg-amber-500'"></span>
            {{ agentSource === 'bridge' ? 'Agent Bridge' : 'Fallback Scan' }}
          </span>
          <button @click="liveStreamActive = !liveStreamActive" class="hover:underline flex items-center gap-1" :title="liveStreamActive ? 'Live auto-streaming ON' : 'Paused'">
            <span v-if="liveStreamActive" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {{ liveStreamActive ? 'Live' : 'Paused' }}
          </button>
        </div>
      </aside>

      <!-- ========================================================= -->
      <!-- PANE 2 & 3: MAIN STACK (SESSIONS + LIVE STREAM & TRACE)  -->
      <!-- ========================================================= -->
      <section class="flex-1 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs min-w-0">

        <!-- Top Cockpit Header -->
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 flex-wrap gap-2">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="text-xl shrink-0">{{ activeAgent ? activeAgent.avatar : '🧠' }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 capitalize truncate">
                  {{ activeAgent ? activeAgent.name : 'Flomaster & Agent Fleet Sessions' }}
                </h2>
                <span v-if="activeAgent" class="px-1.5 py-0.5 rounded text-[10px] font-mono border" :class="activeAgent.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'">
                  {{ activeAgent.status }}
                </span>
              </div>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                {{ activeAgent ? (activeAgent.runtime + ' · ' + activeAgent.provider + ' · ' + (activeAgent.source_dir || 'detected')) : 'Real-time telemetry, tool executions & reasoning from active coding agents' }}
              </p>
            </div>
          </div>

          <!-- Quick Actions in top bar -->
          <div class="flex items-center gap-2">
            <div class="flex items-center text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800">
              <span class="text-zinc-900 dark:text-zinc-200 font-bold mr-1.5">{{ visibleSessions.length }}</span>
              <span>active session{{ visibleSessions.length === 1 ? '' : 's' }}</span>
            </div>
            <button
              @click="$emit('open-new-issue')"
              class="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1 transition-colors shadow-2xs"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>New Task</span>
            </button>
          </div>
        </div>

        <!-- Main Body: 2-Column Split View (Session Feed + Inspection Cockpit) -->
        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800/80">

          <!-- Left Column: Live Sessions List -->
          <div class="w-full lg:w-80 shrink-0 flex flex-col overflow-hidden min-w-0 bg-zinc-50/30 dark:bg-zinc-950/20">
            <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span>Active Agent Sessions</span>
              <span class="font-mono text-[10px] text-zinc-400">{{ visibleSessions.length }} live</span>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <!-- Empty state -->
              <div v-if="visibleSessions.length === 0" class="py-12 text-center select-none flex flex-col items-center">
                <i data-lucide="bot" class="w-10 h-10 mb-2 opacity-30 text-zinc-400"></i>
                <div class="text-xs font-semibold text-zinc-600 dark:text-zinc-400">No active sessions for this agent</div>
                <div class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">Start a session in flomaster or dispatch a task from any Kanban issue.</div>
              </div>

              <!-- Session Item Card -->
              <div
                v-for="s in visibleSessions"
                :key="s.id"
                @click="selectSession(s)"
                class="rounded-lg border p-2.5 transition-all cursor-pointer space-y-1.5 select-text"
                :class="selectedSession && selectedSession.id === s.id ? 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600 shadow-xs' : 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'"
              >
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center space-x-2 min-w-0">
                    <span class="text-base shrink-0">{{ s.avatar || '🧠' }}</span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-zinc-900 dark:text-zinc-200 truncate flex items-center gap-1.5">
                        <span>{{ s.short_name || s.id }}</span>
                        <span v-if="s.is_active" class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" title="Active & Running"></span>
                      </div>
                      <div class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        <span>{{ s.model || 'model' }}</span>
                        <span>·</span>
                        <span>{{ workingDirLabel(s.working_dir) }}</span>
                      </div>
                    </div>
                  </div>
                  <span class="text-[10px] font-mono text-zinc-400 shrink-0">
                    {{ fmtTime(s.last_active_at || s.updated_at) }}
                  </span>
                </div>

                <!-- User Intention / Goal line -->
                <p v-if="s.intention" class="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-tight">
                  {{ s.intention }}
                </p>

                <!-- Tool Pills Preview -->
                <div v-if="s.recent_tools && s.recent_tools.length > 0" class="flex flex-wrap gap-1 pt-0.5">
                  <span
                    v-for="(t, ti) in s.recent_tools.slice(0, 4)"
                    :key="ti"
                    class="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                    :class="toolColor(t.name)"
                  >
                    {{ t.name }}
                  </span>
                  <span v-if="s.recent_tools.length > 4" class="text-[9px] text-zinc-400 font-mono self-center">
                    +{{ s.recent_tools.length - 4 }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Deep Inspection & Live Streaming Cockpit -->
          <div class="flex-1 flex flex-col overflow-hidden min-w-0 bg-white dark:bg-[#121215]">
            <!-- Inspector Header & Tab Navigation -->
            <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center space-x-2">
                <span class="text-sm">{{ selectedSession ? (selectedSession.avatar || '🧠') : '🤖' }}</span>
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                  {{ selectedSession ? (selectedSession.short_name || selectedSession.id) : 'Select a Session' }}
                </span>
                <span v-if="selectedSession && selectedSession.is_active" class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Streaming
                </span>
              </div>

              <!-- View Sub-tabs -->
              <div class="flex items-center gap-1 text-xs">
                <button
                  @click="activeTab = 'activity'"
                  class="px-2 py-1 rounded font-medium transition-colors"
                  :class="activeTab === 'activity' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >
                  ⚡ Live Stream
                </button>
                <button
                  @click="activeTab = 'reasoning'"
                  class="px-2 py-1 rounded font-medium transition-colors"
                  :class="activeTab === 'reasoning' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >
                  💭 Reasoning
                </button>
                <button
                  @click="activeTab = 'tools'"
                  class="px-2 py-1 rounded font-medium transition-colors"
                  :class="activeTab === 'tools' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >
                  🔧 Tool Trace ({{ (selectedSession && selectedSession.recent_tools || []).length }})
                </button>
                <button
                  v-if="selectedSession && selectedSession.todos && selectedSession.todos.length > 0"
                  @click="activeTab = 'todos'"
                  class="px-2 py-1 rounded font-medium transition-colors"
                  :class="activeTab === 'todos' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >
                  📋 Checklist ({{ selectedSession.todos.length }})
                </button>
              </div>
            </div>

            <!-- Content Area for Selected Session -->
            <div v-if="selectedSession" class="flex-1 overflow-y-auto p-3 space-y-3">

              <!-- Overview Meta Card -->
              <div class="p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">User Intention / Goal</div>
                    <div class="text-sm font-medium text-zinc-900 dark:text-zinc-200 mt-0.5">
                      {{ selectedSession.intention || selectedSession.title || 'Interactive agent session' }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="createTicketFromSession(selectedSession)"
                      class="px-2 py-1 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center space-x-1"
                      title="Create a tracked ProjectBase issue from this session"
                    >
                      <i data-lucide="tag" class="w-3 h-3"></i>
                      <span>Create Ticket</span>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[11px] font-mono">
                  <div>
                    <span class="text-zinc-400">Model: </span>
                    <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ selectedSession.model || 'prime' }}</span>
                  </div>
                  <div>
                    <span class="text-zinc-400">Messages: </span>
                    <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ selectedSession.message_count || 0 }}</span>
                  </div>
                  <div class="col-span-2 truncate" :title="selectedSession.working_dir">
                    <span class="text-zinc-400">CWD: </span>
                    <span class="text-zinc-700 dark:text-zinc-300">{{ selectedSession.working_dir || 'workspace' }}</span>
                  </div>
                </div>

                <!-- Files touched pills -->
                <div v-if="selectedSession.files_touched && selectedSession.files_touched.length > 0" class="pt-1">
                  <div class="text-[10px] text-zinc-500 uppercase font-semibold">Touched Files</div>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="(f, fi) in selectedSession.files_touched"
                      :key="fi"
                      class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 truncate max-w-xs"
                      :title="f"
                    >
                      {{ f.split('/').slice(-2).join('/') }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- TAB 1: Interleaved Live Activity Stream -->
              <div v-if="activeTab === 'activity'" class="space-y-2">
                <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Chronological Stream</span>
                  <span class="text-[10px] font-mono text-zinc-400">Recent {{ (selectedSession.live_activity || []).length }} events</span>
                </div>

                <div v-if="!selectedSession.live_activity || selectedSession.live_activity.length === 0" class="p-8 text-center text-zinc-400 text-xs italic">
                  No activity events recorded yet.
                </div>

                <div v-else class="space-y-1.5">
                  <div
                    v-for="(ev, ei) in selectedSession.live_activity"
                    :key="ei"
                    class="p-2 rounded-lg border text-xs transition-colors flex items-start space-x-2"
                    :class="ev.type === 'reasoning' ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/40' : (ev.type === 'tool' ? 'bg-zinc-50/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800')"
                  >
                    <!-- Event Icon -->
                    <span class="text-sm shrink-0 mt-0.5">
                      {{ ev.type === 'reasoning' ? '💭' : (ev.type === 'tool' ? '🔧' : '💬') }}
                    </span>

                    <!-- Event Body -->
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 font-medium">
                          <span v-if="ev.type === 'tool'" class="px-1 py-0.5 rounded text-[10px] font-mono font-bold" :class="toolColor(ev.name)">
                            {{ ev.name }}
                          </span>
                          <span v-if="ev.intent" class="text-xs text-zinc-900 dark:text-zinc-100 font-semibold">
                            {{ ev.intent }}
                          </span>
                          <span v-else-if="ev.type === 'reasoning'" class="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                            Reasoning Thought
                          </span>
                          <span v-else class="text-xs text-zinc-800 dark:text-zinc-200">
                            Assistant message
                          </span>
                        </div>
                        <span class="text-[10px] font-mono text-zinc-400 shrink-0">
                          {{ fmtTime(ev.timestamp) }}
                        </span>
                      </div>

                      <div v-if="ev.input" class="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 break-all bg-white/60 dark:bg-zinc-950/60 p-1 rounded border border-zinc-200/40 dark:border-zinc-800/40">
                        {{ ev.input }}
                      </div>

                      <div v-if="ev.summary && ev.type !== 'tool'" class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {{ ev.summary }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 2: Deep Reasoning Inspector -->
              <div v-if="activeTab === 'reasoning'" class="space-y-3">
                <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Model Thought Process & Steps</span>
                  <span v-if="selectedSession.is_active" class="text-emerald-500 text-[10px] font-mono flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Thought Stream
                  </span>
                </div>

                <div v-if="selectedSession.reasoning_steps && selectedSession.reasoning_steps.length > 0" class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Key Reasoning Steps:</div>
                  <ul class="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                    <li v-for="(st, sti) in selectedSession.reasoning_steps" :key="sti" class="flex items-start space-x-2">
                      <span class="text-emerald-500 font-bold shrink-0">✓</span>
                      <span>{{ st }}</span>
                    </li>
                  </ul>
                </div>

                <div class="p-3.5 rounded-xl bg-zinc-50/90 dark:bg-zinc-950/90 border border-zinc-200 dark:border-zinc-800 space-y-2 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                  <div class="text-[10px] uppercase font-bold text-zinc-400">Latest Reasoning Snapshot</div>
                  <div class="whitespace-pre-wrap">
                    {{ selectedSession.latest_reasoning || 'No raw reasoning block recorded in current session window.' }}
                  </div>
                </div>
              </div>

              <!-- TAB 3: Tool Execution Trace -->
              <div v-if="activeTab === 'tools'" class="space-y-2">
                <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Recent Tool Execution Trace</span>
                  <span class="font-mono text-[10px] text-zinc-400">{{ (selectedSession.recent_tools || []).length }} operations</span>
                </div>

                <div v-if="!selectedSession.recent_tools || selectedSession.recent_tools.length === 0" class="p-8 text-center text-zinc-400 text-xs italic">
                  No tools recorded in recent window.
                </div>

                <div v-else class="space-y-1.5">
                  <div
                    v-for="(t, ti) in selectedSession.recent_tools"
                    :key="ti"
                    class="p-2 rounded-lg bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1 font-mono"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-1.5">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="toolColor(t.name)">{{ t.name }}</span>
                        <span v-if="t.intent" class="text-xs font-sans font-semibold text-zinc-900 dark:text-zinc-100">{{ t.intent }}</span>
                      </div>
                      <span class="text-[10px] text-zinc-400">{{ fmtTime(t.timestamp) }}</span>
                    </div>
                    <div v-if="t.input" class="text-[10px] text-zinc-600 dark:text-zinc-400 break-all bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800/80">
                      {{ t.input }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 4: Active Checklist / Todos -->
              <div v-if="activeTab === 'todos'" class="space-y-2">
                <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Checklist</div>
                <div class="space-y-1">
                  <div
                    v-for="(td, tdi) in selectedSession.todos"
                    :key="tdi"
                    class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between"
                  >
                    <div class="flex items-center space-x-2">
                      <span :class="td.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'">●</span>
                      <span class="text-zinc-800 dark:text-zinc-200">{{ td.content }}</span>
                    </div>
                    <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {{ td.status }}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            <!-- Empty selection state -->
            <div v-else class="flex-1 flex items-center justify-center p-8 text-center text-zinc-400 text-xs">
              Select a session from the list to inspect live streaming telemetry and reasoning.
            </div>

            <!-- Bottom Interactive Prompt & Continuation Bar -->
            <div class="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
              <div class="flex items-center space-x-2">
                <input
                  v-model="quickPrompt"
                  @keydown.enter="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
                  type="text"
                  :placeholder="selectedSession ? ('Send follow-up instruction to ' + (selectedSession.short_name || 'session') + '...') : 'Dispatch instruction to agent...'"
                  class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                />
                <button
                  @click="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
                  :disabled="isDispatching || !quickPrompt.trim()"
                  class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50 shadow-2xs shrink-0"
                >
                  <i data-lucide="send" class="w-3 h-3"></i>
                  <span>{{ isDispatching ? 'Sending...' : (selectedSession ? 'Continue Session' : 'Dispatch') }}</span>
                </button>
              </div>
              <div v-if="dispatchSuccess" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                ✓ {{ dispatchSuccess }}
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  `
};
