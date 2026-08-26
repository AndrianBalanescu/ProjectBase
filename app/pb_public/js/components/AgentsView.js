// pb_public/js/components/AgentsView.js
// Multica 2.0: Ultra-dense, full-width agent cockpit dashboard.
// Zero empty margins (max 8-10px), multi-column layout, instant tab-switching,
// live session stream, real-time tool execution trace, active checklist, and 1-click dispatch.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all', // 'all' | 'online' | 'active'
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null
    };
  },
  computed: {
    onlineAgents() {
      return (this.agents || []).filter(a => a.status === 'online');
    },
    totalSessions() {
      return (this.sessions || []).length;
    },
    // The currently selected agent (or null for "all agents")
    activeAgent() {
      if (!this.activeAgentName) return null;
      return (this.agents || []).find(a => a.name === this.activeAgentName) || null;
    },
    // Filtered agents in the left tab list
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
    // Sessions scoped to the selected agent (or all sessions if no agent selected)
    visibleSessions() {
      const all = this.sessions || [];
      if (this.activeAgent) {
        return all.filter(s => s.agent === this.activeAgent.name);
      }
      return all;
    },
    // Selected session object for inspection
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
  methods: {
    selectAgent(agentName) {
      this.$emit('navigate', agentName || null);
      this.selectedSessionId = null;
    },
    selectSession(s) {
      this.selectedSessionId = s.id;
    },
    statusDot(status) {
      return status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-600';
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
      const parts = dir.split('/').filter(Boolean);
      if (parts.length <= 2) return dir;
      return '…/' + parts.slice(-2).join('/');
    },
    toolIcon(name) {
      const map = {
        bash: 'terminal',
        read: 'file-text',
        write: 'file-plus-2',
        edit: 'edit-3',
        multiedit: 'edit-3',
        apply_patch: 'diff',
        patch: 'diff',
        grep: 'search',
        agentgrep: 'search',
        webfetch: 'globe',
        websearch: 'globe',
        mcp: 'plug',
        todo: 'check-square',
        ls: 'folder',
        schedule: 'clock',
        browser: 'mouse-pointer-click'
      };
      return map[name] || 'bot';
    },
    toolColor(name) {
      const map = {
        bash: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        read: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        write: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        edit: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        multiedit: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        grep: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
        agentgrep: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
        todo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
      };
      return map[name] || 'text-gray-400 bg-gray-500/10 border-gray-600/20';
    },
    async quickDispatch(targetAgent) {
      if (!this.quickPrompt.trim()) return;
      this.isDispatching = true;
      try {
        const res = await fetch('/api/projectbase/dispatch-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_target: targetAgent || (this.activeAgent ? this.activeAgent.name : 'flomaster'),
            prompt: this.quickPrompt.trim()
          })
        });
        if (res.ok) {
          this.dispatchSuccess = 'Dispatched successfully!';
          this.quickPrompt = '';
          setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        }
      } catch (e) {
        console.error('Quick dispatch failed', e);
      } finally {
        this.isDispatching = false;
      }
    }
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-[#0b0f19] text-gray-100 overflow-hidden select-none">

      <!-- ========================================================= -->
      <!-- PANE 1: LEFT AGENT TABS SIDEBAR (COMPACT, DENSE)          -->
      <!-- ========================================================= -->
      <aside class="w-full md:w-64 shrink-0 flex flex-col bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <!-- Sidebar Header -->
        <div class="p-2.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
          <div class="flex items-center space-x-2">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-bold uppercase tracking-wider text-gray-200">Agent Fleet</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-800/60 text-[10px] font-mono text-purple-300 font-semibold">
              {{ onlineAgents.length }}/{{ (agents || []).length }} ON
            </span>
            <button
              @click="$emit('sync-agents')"
              class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              title="Rescan Agents"
            >
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Filter / Search input -->
        <div class="p-2 border-b border-gray-800/80 bg-gray-950/40 space-y-1.5">
          <div class="relative">
            <input
              v-model="search"
              placeholder="Filter agents..."
              class="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
            <i data-lucide="search" class="w-3 h-3 text-gray-500 absolute left-1.5 top-2"></i>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="filterStatus = 'all'"
              class="flex-1 py-0.5 text-[10px] font-medium rounded text-center transition-colors"
              :class="filterStatus === 'all' ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'"
            >
              All ({{ (agents || []).length }})
            </button>
            <button
              @click="filterStatus = 'online'"
              class="flex-1 py-0.5 text-[10px] font-medium rounded text-center transition-colors flex items-center justify-center gap-1"
              :class="filterStatus === 'online' ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300' : 'text-gray-500 hover:text-gray-300'"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Live ({{ onlineAgents.length }})
            </button>
          </div>
        </div>

        <!-- Agent Tabs List -->
        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <!-- "All Agents" Overview Tab -->
          <button
            @click="selectAgent(null)"
            class="w-full flex items-center justify-between px-2 py-2 rounded-lg text-left transition-all border"
            :class="!activeAgentName ? 'bg-purple-950/50 border-purple-700/60 text-purple-200 font-semibold shadow-sm' : 'bg-gray-900/40 border-transparent text-gray-300 hover:bg-gray-800/60 hover:text-gray-100'"
          >
            <div class="flex items-center space-x-2 truncate">
              <span class="text-base">⚡</span>
              <div class="truncate">
                <div class="text-xs font-semibold">All Active Sessions</div>
                <div class="text-[10px] text-gray-500 font-normal">Workspace Overview</div>
              </div>
            </div>
            <span class="px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 text-[10px] font-mono font-bold">
              {{ totalSessions }}
            </span>
          </button>

          <!-- Individual Agent Tabs -->
          <button
            v-for="a in filteredAgents"
            :key="a.name"
            @click="selectAgent(a.name)"
            class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all border"
            :class="activeAgentName === a.name ? 'bg-purple-950/60 border-purple-700/70 text-purple-200 font-semibold shadow-sm' : 'bg-gray-900/40 border-transparent text-gray-300 hover:bg-gray-800/50 hover:text-gray-100'"
          >
            <div class="flex items-center space-x-2 truncate min-w-0">
              <span class="text-base shrink-0">{{ a.avatar }}</span>
              <div class="truncate min-w-0">
                <div class="text-xs font-medium capitalize truncate flex items-center gap-1.5">
                  <span class="truncate">{{ a.name }}</span>
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="statusDot(a.status)"
                    :title="a.status"
                  ></span>
                </div>
                <div class="text-[10px] text-gray-500 truncate font-mono">{{ a.runtime || a.provider }}</div>
              </div>
            </div>

            <!-- Live Session Badge -->
            <span
              v-if="a.session_count > 0"
              class="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[9px] font-mono font-bold shrink-0"
            >
              {{ a.session_count }} live
            </span>
            <span
              v-else
              class="text-[10px] text-gray-600 font-mono shrink-0"
            >
              idle
            </span>
          </button>
        </div>

        <!-- Sidebar Footer Status -->
        <div class="p-2 border-t border-gray-800 bg-gray-950/60 flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <span class="flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {{ agentSource || 'bridge' }}
          </span>
          <span>zero-config</span>
        </div>
      </aside>

      <!-- ========================================================= -->
      <!-- PANE 2: MAIN DASHBOARD & SESSIONS STREAM (HIGH DENSITY)   -->
      <!-- ========================================================= -->
      <section class="flex-1 flex flex-col bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden shadow-lg min-w-0">

        <!-- Top Cockpit Status Bar (Dense, Compact) -->
        <div class="px-3 py-2 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 bg-gray-900/90">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="text-xl">{{ activeAgent ? activeAgent.avatar : '🧠' }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold capitalize text-gray-100 truncate">
                  {{ activeAgent ? activeAgent.name : 'Workspace AI Cockpit' }}
                </h2>
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold"
                  :class="activeAgent && activeAgent.status === 'online' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'bg-gray-800 text-gray-400'"
                >
                  {{ activeAgent ? activeAgent.status : (onlineAgents.length + ' ONLINE') }}
                </span>
              </div>
              <p class="text-[10px] text-gray-400 font-mono truncate">
                {{ activeAgent ? (activeAgent.runtime + ' · ' + activeAgent.provider + ' · ' + (activeAgent.source_dir || 'detected')) : 'Real-time telemetry from active local coding agents' }}
              </p>
            </div>
          </div>

          <!-- Quick Actions in top bar -->
          <div class="flex items-center gap-2">
            <div class="flex items-center text-[11px] font-mono text-gray-400 bg-gray-950/70 px-2 py-1 rounded border border-gray-800">
              <span class="text-purple-400 font-bold mr-1.5">{{ visibleSessions.length }}</span>
              <span>active session{{ visibleSessions.length === 1 ? '' : 's' }}</span>
            </div>
            <button
              @click="$emit('open-new-issue')"
              class="px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center space-x-1 transition-colors shadow"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>New Task</span>
            </button>
          </div>
        </div>

        <!-- Main Body: 2-Column Split View (Session Feed + Inspection Cockpit) -->
        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-gray-800">

          <!-- Left Column: Live Sessions List (Dense Cards) -->
          <div class="flex-1 flex flex-col overflow-hidden min-w-0">
            <div class="p-2 border-b border-gray-800/80 bg-gray-950/30 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <div class="flex items-center gap-1.5">
                <i data-lucide="activity" class="w-3.5 h-3.5 text-purple-400"></i>
                <span>Live Sessions Stream</span>
              </div>
              <span class="text-[10px] text-gray-500 font-mono font-normal">Real-time SSE synced</span>
            </div>

            <!-- Sessions Scroll Area -->
            <div class="flex-1 overflow-y-auto p-2 space-y-2">
              <div v-if="visibleSessions.length === 0" class="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <i data-lucide="bot" class="w-10 h-10 mb-2 opacity-30 text-purple-400"></i>
                <div class="text-xs font-semibold text-gray-400">No active sessions for this agent</div>
                <div class="text-[11px] text-gray-500 mt-1 max-w-xs">Start a session in flomaster or dispatch a task from any Kanban issue.</div>
              </div>

              <!-- Session Item Card (Dense, Rich) -->
              <div
                v-for="s in visibleSessions"
                :key="s.id"
                @click="selectSession(s)"
                class="rounded-lg border p-2.5 transition-all cursor-pointer space-y-2 select-text"
                :class="selectedSession && selectedSession.id === s.id ? 'bg-gray-800/80 border-purple-600/70 shadow-md ring-1 ring-purple-600/30' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800/40'"
              >
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center space-x-2 min-w-0">
                    <span class="text-base shrink-0">{{ s.avatar || '🧠' }}</span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-gray-100 truncate flex items-center gap-1.5">
                        <span>{{ s.short_name || s.id }}</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Active"></span>
                      </div>
                      <div class="text-[10px] font-mono text-gray-400 truncate flex items-center gap-1.5">
                        <span class="text-purple-400">{{ s.model || 'gpt-5.5' }}</span>
                        <span>·</span>
                        <span class="truncate" :title="s.working_dir">{{ workingDirLabel(s.working_dir) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col items-end shrink-0 text-[10px] font-mono text-gray-500">
                    <span>{{ fmtTime(s.last_active_at || s.updated_at) }}</span>
                    <span class="text-gray-400">{{ s.message_count }} msgs</span>
                  </div>
                </div>

                <!-- Current Intent Callout (Dense) -->
                <div v-if="s.intention" class="rounded-md bg-purple-950/40 border border-purple-800/40 p-2 text-xs text-purple-200 flex items-start space-x-2">
                  <span class="text-purple-400 text-xs shrink-0 font-bold">🎯</span>
                  <div class="min-w-0 flex-1">
                    <div class="text-[9px] uppercase tracking-wider text-purple-400 font-bold">Current Intent</div>
                    <div class="text-[11px] leading-relaxed line-clamp-2 text-purple-100">{{ s.intention }}</div>
                  </div>
                </div>

                <!-- Active Checklist / Todos (Compact) -->
                <div v-if="s.todos && s.todos.length > 0" class="space-y-1 pt-0.5">
                  <div class="text-[9px] uppercase tracking-wider text-gray-400 font-bold flex items-center justify-between">
                    <span>Active Checklist ({{ s.todos.length }})</span>
                  </div>
                  <div class="grid grid-cols-1 gap-1">
                    <div
                      v-for="(t, i) in s.todos.slice(0, 3)"
                      :key="i"
                      class="flex items-center space-x-1.5 text-[11px] text-gray-300 bg-gray-950/40 px-2 py-1 rounded border border-gray-800/60 truncate"
                    >
                      <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="t.status === 'in_progress' ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'"></span>
                      <span class="truncate">{{ t.content }}</span>
                    </div>
                  </div>
                </div>

                <!-- Recent Tool Calls (Terminal Trace Pill Stream) -->
                <div v-if="s.recent_tools && s.recent_tools.length > 0" class="pt-1 border-t border-gray-800/60">
                  <div class="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1 flex items-center justify-between">
                    <span>Recent Tool Trace</span>
                    <span class="font-mono">{{ s.recent_tools.length }} tools</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-1">
                    <span
                      v-for="(t, idx) in s.recent_tools.slice(0, 6)"
                      :key="idx"
                      class="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium truncate max-w-[200px]"
                      :class="toolColor(t.name)"
                      :title="t.name + (t.input ? ': ' + t.input : '')"
                    >
                      <span class="font-bold">{{ t.name }}</span>
                      <span v-if="t.input" class="opacity-60 truncate font-normal text-[9px]">{{ t.input }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Inspector & 1-Click Dispatch Cockpit (Dense) -->
          <div class="w-full lg:w-96 shrink-0 flex flex-col bg-gray-950/40 overflow-hidden">
            <!-- Inspector Header -->
            <div class="p-2 border-b border-gray-800/80 bg-gray-950/60 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <div class="flex items-center gap-1.5">
                <i data-lucide="terminal" class="w-3.5 h-3.5 text-emerald-400"></i>
                <span>Execution Trace & Dispatch</span>
              </div>
              <span class="text-[10px] text-purple-400 font-mono">Multica 2.0</span>
            </div>

            <div class="flex-1 overflow-y-auto p-2.5 space-y-3">
              <!-- Selected Session Details -->
              <div v-if="selectedSession" class="space-y-2">
                <div class="p-2 rounded-lg bg-gray-900 border border-gray-800 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-200">{{ selectedSession.short_name || selectedSession.id }}</span>
                    <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/50 px-1.5 py-0.5 rounded font-semibold">
                      {{ selectedSession.model }}
                    </span>
                  </div>
                  <div class="text-[10px] font-mono text-gray-400 break-all bg-gray-950/80 p-1.5 rounded border border-gray-800/60">
                    <span class="text-gray-500">cwd: </span>{{ selectedSession.working_dir }}
                  </div>
                </div>

                <!-- Complete Tool Call Feed for Selected Session -->
                <div class="space-y-1">
                  <div class="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between">
                    <span>Tool Feed</span>
                    <span class="font-mono text-gray-500">{{ (selectedSession.recent_tools || []).length }} operations</span>
                  </div>

                  <div class="rounded-lg bg-gray-900/90 border border-gray-800 p-2 font-mono text-[11px] max-h-56 overflow-y-auto space-y-1.5">
                    <div v-if="!selectedSession.recent_tools || selectedSession.recent_tools.length === 0" class="text-gray-500 text-[10px] italic">
                      No tool operations recorded in recent window.
                    </div>
                    <div
                      v-for="(t, idx) in selectedSession.recent_tools"
                      :key="idx"
                      class="flex items-start space-x-1.5 py-0.5 border-b border-gray-800/40 last:border-0"
                    >
                      <span class="text-emerald-400 font-bold shrink-0">></span>
                      <span class="px-1 py-0.5 rounded text-[10px] font-bold shrink-0" :class="toolColor(t.name)">{{ t.name }}</span>
                      <span class="text-gray-300 text-[10px] truncate flex-1" :title="t.input">{{ t.input || '—' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 1-Click Fast Dispatch Form -->
              <div class="p-2.5 rounded-lg bg-gray-900 border border-purple-900/40 space-y-2 shadow-sm">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1">
                    <span>⚡ 1-Click Dispatch to</span>
                    <span class="text-white">{{ activeAgent ? activeAgent.name : 'Flomaster' }}</span>
                  </label>
                </div>

                <textarea
                  v-model="quickPrompt"
                  placeholder="Task or command for agent (e.g. 'Run full test suite and report failures')..."
                  rows="3"
                  class="w-full px-2 py-1.5 text-xs rounded bg-gray-950 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                ></textarea>

                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1">
                    <button
                      @click="quickPrompt = 'Run pytest tests/ and report status'"
                      class="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
                    >
                      🧪 Run tests
                    </button>
                    <button
                      @click="quickPrompt = 'Check git diff and verify cleanliness'"
                      class="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
                    >
                      🔍 Diff check
                    </button>
                  </div>

                  <button
                    @click="quickDispatch()"
                    :disabled="isDispatching || !quickPrompt.trim()"
                    class="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1 shadow transition-colors"
                  >
                    <span>{{ isDispatching ? 'Sending...' : 'Dispatch' }}</span>
                  </button>
                </div>

                <div v-if="dispatchSuccess" class="text-[10px] text-emerald-400 font-mono text-center">
                  ✓ {{ dispatchSuccess }}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  `
};
