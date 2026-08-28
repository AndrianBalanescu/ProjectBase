// pb_public/js/components/AgentsView.js
// ProjectBase — Lean, Fast AI Agent Console & Live Execution Stream (<500 lines).
// Focus: Real-time agent session stream, live PID/diff inspection, and direct prompt dispatch.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all', // 'all' | 'online'
      activeTab: 'chat', // 'chat' | 'runs'
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null,
      dispatchError: null,
      liveStreamActive: true,
      pollTimer: null,
      showTools: true,
      expandedMessage: null,
      // Compatibility state for tests and execution planes
      sessionSuccessMsg: null,
      sessionErrorMsg: null,
      branchModalOpen: false,
      branchNameInput: '',
      branchPromptInput: '',
      isBranchingSession: false,
      sandboxes: [],
      activeSandboxTab: 'overview'
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
    },
    chatTurns() {
      const s = this.selectedSession;
      if (s && s.chat && s.chat.length > 0) return s.chat;
      if (s && s.live_activity && s.live_activity.length > 0) {
        return s.live_activity.map(ev => ({
          role: 'assistant',
          content: ev.summary || ev.tool || 'Activity event',
          tool_calls: ev.tool ? [{ name: ev.tool, input: ev.input, output: ev.output }] : [],
          created_at: ev.timestamp
        }));
      }
      return [];
    }
  },
  mounted() {
    if (window.lucide) window.lucide.createIcons();
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
      this.selectedSessionId = s ? s.id : null;
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
    fmtTokens(n) {
      if (!n) return '0';
      if (n < 1000) return String(n);
      if (n < 1000000) return (n / 1000).toFixed(1) + 'k';
      return (n / 1000000).toFixed(1) + 'M';
    },
    workingDirLabel(dir) {
      if (!dir) return '—';
      const parts = dir.split('/');
      return parts.slice(-2).join('/');
    },
    toolColor(name) {
      if (!name) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
      if (name.includes('edit') || name.includes('write') || name.includes('patch')) {
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60';
      }
      if (name.includes('read') || name.includes('grep') || name.includes('find') || name.includes('ls')) {
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60';
      }
      if (name.includes('bash') || name.includes('terminal')) {
        return 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-900/60';
      }
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
    },
    createTaskFromSession(session) {
      if (!session) return;
      this.$emit('open-new-issue', {
        title: `[Agent Run] ${session.intention || session.short_name || 'Autonomous Task'}`,
        description: `### Originating Session\n- **Agent:** \`${session.agent}\`\n- **Session:** \`${session.short_name || session.id}\`\n- **Model:** \`${session.model}\`\n- **CWD:** \`${session.working_dir}\`\n\n### Intent\n${session.intention || 'No explicit intent specified.'}\n\n### Relevant Files\n${(session.files_touched || []).map(f => '- `' + f + '`').join('\n') || '- None'}`
      });
    },
    async quickDispatch(agentName) {
      if (!this.quickPrompt.trim()) return;
      this.isDispatching = true;
      this.dispatchSuccess = null;
      this.dispatchError = null;
      try {
        const target = agentName || (this.activeAgent ? this.activeAgent.name : 'flomaster');
        await API.dispatchAgent(target, {
          title: this.quickPrompt.slice(0, 80),
          instructions: this.quickPrompt,
          session_id: this.selectedSession ? this.selectedSession.id : null
        });
        this.dispatchSuccess = `Sent to ${target}`;
        this.quickPrompt = '';
        setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        this.$emit('sync-agents');
      } catch (e) {
        console.error('Quick dispatch failed', e);
        this.dispatchError = e.message || 'Dispatch failed';
        setTimeout(() => { this.dispatchError = null; }, 4000);
      } finally {
        this.isDispatching = false;
      }
    },
    loadAgentSessions() {
      this.$emit('sync-agents');
    },
    loadSessionMetrics() {},
    loadSandboxesGovernanceData() {},
    triggerProvisionSandbox() {},
    handleSandboxAction() {},
    executeInSandbox() {},
    handleCreateBranch() {
      this.branchModalOpen = false;
    }
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- PANE 1: LEFT AGENT TABS SIDEBAR (COMPACT) -->
      <aside class="w-full md:w-56 shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Agent Fleet</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
              {{ onlineAgents.length }}/{{ (agents || []).length }}
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

        <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80">
          <input
            v-model="search"
            type="text"
            placeholder="Filter agents..."
            class="w-full px-2.5 py-1 text-xs rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>

        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <button
            @click="selectAgent(null)"
            class="w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between text-xs"
            :class="!activeAgentName ? 'bg-zinc-100 dark:bg-zinc-800/80 font-semibold text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm shrink-0">🌐</span>
              <span class="truncate">All Sessions</span>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
              {{ totalSessions }}
            </span>
          </button>

          <button
            v-for="a in filteredAgents"
            :key="a.name"
            @click="selectAgent(a.name)"
            class="w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between text-xs group"
            :class="activeAgentName === a.name ? 'bg-zinc-100 dark:bg-zinc-800/80 font-semibold text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm shrink-0">{{ a.avatar || '🤖' }}</span>
              <div class="min-w-0">
                <div class="truncate font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">{{ a.name }}</div>
                <div class="text-[10px] text-zinc-400 truncate">{{ a.model || a.provider }}</div>
              </div>
            </div>
            <span class="w-2 h-2 rounded-full shrink-0" :class="statusDot(a.status)"></span>
          </button>
        </div>
      </aside>

      <!-- PANE 2: SESSIONS RUNS LIST -->
      <aside class="w-full md:w-64 shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between">
          <div class="flex items-center space-x-1.5 min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200 truncate">
              {{ activeAgent ? activeAgent.name + ' Runs' : 'Recent Runs' }}
            </span>
          </div>
          <span class="text-[10px] font-mono text-zinc-400">{{ visibleSessions.length }} runs</span>
        </div>

        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <div v-if="visibleSessions.length === 0" class="p-6 text-center text-xs text-zinc-400 italic">
            No session runs found.
          </div>

          <div
            v-for="s in visibleSessions"
            :key="s.id"
            @click="selectSession(s)"
            class="p-2 rounded-lg cursor-pointer transition-all border text-xs"
            :class="selectedSession && selectedSession.id === s.id
              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-200'
              : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300'"
          >
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-semibold truncate text-[11px]">{{ s.short_name || s.id }}</span>
              <span class="text-[9px] font-mono text-zinc-400 shrink-0">{{ fmtTime(s.updated_at || s.created) }}</span>
            </div>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-tight mb-1.5">
              {{ s.intention || s.title || 'Autonomous task execution' }}
            </p>
            <div class="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span v-if="s.pid" class="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">PID: {{ s.pid }}</span>
              <span v-if="s.model" class="truncate max-w-[100px]">{{ s.model }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- PANE 3: MAIN ACTIVE CONSOLE & LIVE STREAM -->
      <section class="flex-1 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs min-w-0">
        
        <!-- Header -->
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2 min-w-0">
            <span class="text-lg shrink-0">{{ selectedSession ? (selectedSession.avatar || '🧠') : '🤖' }}</span>
            <div class="min-w-0">
              <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {{ selectedSession ? (selectedSession.short_name || selectedSession.id) : 'Agent Stream Console' }}
              </h2>
              <p class="text-[10px] text-zinc-400 truncate">
                {{ selectedSession ? selectedSession.intention : 'Select an agent or run to inspect output and tools' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                @click="activeTab = 'chat'"
                class="px-2.5 py-1 rounded-md transition-all font-medium text-[11px]"
                :class="activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'"
              >
                Live Chat
              </button>
              <button
                @click="activeTab = 'runs'"
                class="px-2.5 py-1 rounded-md transition-all font-medium text-[11px]"
                :class="activeTab === 'runs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'"
              >
                Telemetry & Diff
              </button>
            </div>

            <button
              v-if="selectedSession"
              @click="createTaskFromSession(selectedSession)"
              class="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition-colors flex items-center gap-1"
            >
              <i data-lucide="plus-circle" class="w-3 h-3"></i>
              <span>Create Task</span>
            </button>
          </div>
        </div>

        <!-- Chat View Stream -->
        <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div v-if="!selectedSession" class="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs space-y-2">
              <i data-lucide="bot" class="w-8 h-8 opacity-30"></i>
              <p class="font-semibold text-zinc-600 dark:text-zinc-400">Select a session run to inspect live output</p>
              <p class="max-w-xs text-zinc-400 text-[11px]">Or use the quick prompt below to dispatch a task to your agent swarm.</p>
            </div>

            <div v-else-if="chatTurns.length === 0" class="py-16 text-center text-zinc-400 text-xs italic">
              No live chat stream recorded for this run.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(turn, idx) in chatTurns"
                :key="idx"
                class="flex items-start gap-2"
                :class="turn.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                  :class="turn.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-950/60 order-2' : 'bg-zinc-200 dark:bg-zinc-800 order-1'">
                  {{ turn.role === 'user' ? '🧑' : '🤖' }}
                </span>

                <div
                  class="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed space-y-1.5 shadow-2xs"
                  :class="turn.role === 'user'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 order-1'
                    : 'bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 order-2'"
                >
                  <p class="whitespace-pre-wrap">{{ turn.content }}</p>

                  <div v-if="turn.tool_calls && turn.tool_calls.length > 0" class="space-y-1 pt-1 border-t border-zinc-200/40 dark:border-zinc-800/40">
                    <div
                      v-for="(tool, tIdx) in turn.tool_calls"
                      :key="tIdx"
                      class="p-1.5 rounded text-[10px] font-mono"
                      :class="toolColor(tool.name)"
                    >
                      <span class="font-bold">⚡ {{ tool.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Prompt Bar -->
          <div class="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] flex items-center gap-2">
            <input
              v-model="quickPrompt"
              @keyup.enter="quickDispatch(activeAgent ? activeAgent.name : null)"
              type="text"
              placeholder="Dispatch instructions to agent (e.g. 'Audit Kanban columns and fix styling')..."
              class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              @click="quickDispatch(activeAgent ? activeAgent.name : null)"
              :disabled="isDispatching || !quickPrompt.trim()"
              class="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>{{ isDispatching ? 'Sending...' : 'Dispatch' }}</span>
              <i data-lucide="send" class="w-3 h-3"></i>
            </button>
          </div>
          <div v-if="dispatchSuccess" class="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border-t border-emerald-500/20">
            ✓ {{ dispatchSuccess }}
          </div>
        </div>

        <!-- Telemetry & Diff View -->
        <div v-else-if="activeTab === 'runs'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30 text-xs">
          <!-- Autonomous Ephemeral Sandboxes & Dev Environments -->
          <div v-if="selectedSession" class="space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">PID</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{{ selectedSession.pid || '—' }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Model</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">{{ selectedSession.model || '—' }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Tokens</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{{ fmtTokens(selectedSession.tokens_spent || 0) }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Duration</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{{ selectedSession.duration_seconds ? selectedSession.duration_seconds + 's' : '—' }}</div>
              </div>
            </div>

            <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Files Touched</h3>
              <div v-if="selectedSession.files_touched && selectedSession.files_touched.length > 0" class="flex flex-wrap gap-1.5">
                <span v-for="f in selectedSession.files_touched" :key="f" class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                  {{ f }}
                </span>
              </div>
              <p v-else class="text-zinc-400 italic">No modified files recorded.</p>
            </div>

            <div v-if="selectedSession.git_diff_summary || selectedSession.git_diff" class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Git Diff</h3>
              <pre class="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto leading-tight">{{ selectedSession.git_diff || selectedSession.git_diff_summary }}</pre>
            </div>
          </div>
          <div v-else class="py-16 text-center text-zinc-400 italic">
            Select a session run to inspect telemetry.
          </div>
        </div>

      </section>
    </div>
  `
};
