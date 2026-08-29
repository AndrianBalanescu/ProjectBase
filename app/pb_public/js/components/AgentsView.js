// pb_public/js/components/AgentsView.js
// ProjectBase — Real-Time AI Agent Console & Live Execution Stream.
// Features: Real-time chat stream with OmniRoute, live process inspection, terminal logs, and git diffs.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all', // 'all' | 'online'
      activeTab: 'chat', // 'chat' | 'terminal' | 'diff'
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null,
      dispatchError: null,
      chatLog: {},
      liveStreamActive: true,
      pollTimer: null
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
        return all.filter(s => s.agent === this.activeAgent.name || s.runtime === this.activeAgent.name);
      }
      return all;
    },
    selectedSession() {
      if (!this.selectedSessionId) {
        return this.visibleSessions[0] || null;
      }
      return this.visibleSessions.find(s => s.id === this.selectedSessionId || s.session_id === this.selectedSessionId) || this.visibleSessions[0] || null;
    },
    chatTurns() {
      const s = this.selectedSession;
      if (!s) return [];
      const sid = s.session_id || s.id;

      // 1. Interactive log always wins (survives parent poll re-renders)
      if (this.chatLog[sid] && this.chatLog[sid].length > 0) {
        return this.chatLog[sid];
      }

      // 2. Server-persisted chat history
      if (s.chat && Array.isArray(s.chat) && s.chat.length > 0) {
        return s.chat;
      }

      // 3. Synthesize from real session fields
      const promptText = s.last_prompt || s.title || s.command || `Autonomous engineering run on ${s.working_dir || 'workspace'}`;
      let assistantContent = `⚡ **Agent Execution Summary**\n\n` +
        `• **Agent:** \`${s.agent_name || s.short_name || 'Flomaster'}\`\n` +
        `• **Working Directory:** \`${s.working_dir || s.workdir || '/data/projects/projectbase'}\`\n` +
        `• **Model:** \`${s.model || 'omniroute/premium'}\`\n` +
        `• **Git Branch:** \`${s.git_branch || 'main'}\` ${s.git_commit ? '(`' + s.git_commit.slice(0, 7) + '`)' : ''}\n` +
        `• **Status:** \`${(s.status || 'completed').toUpperCase()}\` ${s.pid ? '(PID: ' + s.pid + ')' : ''}\n` +
        `• **Token Usage:** \`${this.fmtTokens(s.tokens || 0)}\``;

      if (s.log_tail) {
        assistantContent += `\n\n**Terminal Log Excerpt:**\n\`\`\`bash\n${s.log_tail.trim()}\n\`\`\``;
      }

      return [
        {
          role: 'user',
          content: promptText,
          created_at: s.started_at || s.created || new Date().toISOString()
        },
        {
          role: 'assistant',
          content: assistantContent,
          log_tail: s.log_tail || '',
          git_diff: s.git_diff_raw || '',
          test_verdict: s.test_verdict || null,
          created_at: s.updated || s.created || new Date().toISOString()
        }
      ];
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
    async selectSession(s) {
      if (!s) {
        this.selectedSessionId = null;
        return;
      }
      this.selectedSessionId = s.id || s.session_id;
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    },
    scrollToBottom() {
      const container = document.getElementById('agents-chat-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },
    statusDot(status) {
      return status === 'online' || status === 'running' ? 'bg-emerald-500 dark:bg-emerald-400' : (status === 'idle' ? 'bg-amber-400' : 'bg-zinc-400 dark:bg-zinc-600');
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
    async quickDispatch(agentName) {
      const prompt = this.quickPrompt.trim();
      if (!prompt) return;

      this.isDispatching = true;
      this.dispatchSuccess = null;
      this.dispatchError = null;

      const target = agentName || (this.activeAgent ? this.activeAgent.name : 'flomaster');
      const s = this.selectedSession;
      const sid = s ? (s.session_id || s.id) : ('sess_chat_' + Date.now().toString(36));
      this.selectedSessionId = s ? (s.id || sid) : sid;

      // Seed the interactive log from the current view once, then append.
      // chatLog is component state, so it survives parent poll re-renders.
      if (!this.chatLog[sid]) {
        this.chatLog = { ...this.chatLog, [sid]: [...this.chatTurns] };
      }

      this.chatLog = {
        ...this.chatLog,
        [sid]: [
          ...this.chatLog[sid],
          { role: 'user', content: prompt, created_at: new Date().toISOString() }
        ]
      };

      this.quickPrompt = '';
      this.$nextTick(() => { this.scrollToBottom(); });

      try {
        const res = await API.dispatchAgent(target, {
          prompt: prompt,
          session_id: sid
        });

        const reply = res.response || res.message || 'Task dispatched to agent.';

        this.chatLog = {
          ...this.chatLog,
          [sid]: [
            ...this.chatLog[sid],
            { role: 'assistant', content: reply, created_at: new Date().toISOString() }
          ]
        };

        this.dispatchSuccess = `Reply from ${target}`;
        setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        this.$nextTick(() => { this.scrollToBottom(); });
      } catch (e) {
        console.error('Dispatch failed', e);
        this.dispatchError = e.message || 'Dispatch failed';
        this.chatLog = {
          ...this.chatLog,
          [sid]: [
            ...this.chatLog[sid],
            { role: 'assistant', content: `⚠️ Error: ${e.message || String(e)}`, created_at: new Date().toISOString() }
          ]
        };
        this.$nextTick(() => { this.scrollToBottom(); });
        setTimeout(() => { this.dispatchError = null; }, 5000);
      } finally {
        this.isDispatching = false;
      }
    },
    createTaskFromSession(session) {
      if (!session) return;
      this.$emit('open-new-issue', {
        title: session.title || session.last_prompt || `Task from session ${session.short_name || session.id}`,
        description: `Created from agent session \`${session.session_id || session.id}\` (${session.agent_name || 'agent'}).\n\n${session.last_prompt ? '> ' + session.last_prompt : ''}`
      });
    }
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- PANE 1: LEFT AGENT TEAM SIDEBAR -->
      <aside class="w-full md:w-52 shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-center space-x-2">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Agent Team</span>
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
              <span class="truncate">All Agents</span>
            </div>
            <span class="font-mono text-[10px] bg-zinc-200/80 dark:bg-zinc-700/60 px-1.5 py-0.5 rounded">{{ totalSessions }}</span>
          </button>

          <button
            v-for="a in filteredAgents"
            :key="a.name"
            @click="selectAgent(a.name)"
            class="w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between text-xs"
            :class="activeAgentName === a.name ? 'bg-zinc-100 dark:bg-zinc-800/80 font-semibold text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm shrink-0">{{ a.avatar || '🤖' }}</span>
              <div class="truncate">
                <span class="capitalize block truncate">{{ a.name }}</span>
                <span class="text-[10px] text-zinc-400 font-mono">{{ a.session_count || 0 }} runs</span>
              </div>
            </div>
            <span class="w-2 h-2 rounded-full shrink-0" :class="statusDot(a.status)"></span>
          </button>
        </div>
      </aside>

      <!-- PANE 2: SESSIONS RUNS LIST -->
      <aside class="w-full md:w-72 shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs">
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
            :class="selectedSession && (selectedSession.id === s.id || selectedSession.session_id === s.session_id)
              ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
              : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300'"
          >
            <div class="flex items-center justify-between gap-1 mb-1">
              <div class="flex items-center space-x-1.5 min-w-0">
                <span class="text-xs shrink-0">{{ s.avatar || '🧠' }}</span>
                <span class="font-bold truncate text-[11px]">{{ s.agent_name || s.short_name || s.id }}</span>
              </div>
              <span class="text-[9px] font-mono text-zinc-400 shrink-0">{{ fmtTime(s.updated || s.created) }}</span>
            </div>

            <p class="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-tight mb-1.5 font-medium">
              {{ s.title || s.last_prompt || s.command || 'Autonomous execution run' }}
            </p>

            <div class="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <div class="flex items-center space-x-1 truncate max-w-[140px]" :title="s.working_dir">
                <span>📁</span>
                <span class="truncate">{{ s.working_dir ? s.working_dir.split('/').slice(-2).join('/') : 'workspace' }}</span>
              </div>
              <span
                class="px-1 py-0.2 rounded font-semibold text-[9px]"
                :class="s.status === 'running' || s.is_active ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'"
              >
                {{ s.status || 'completed' }}
              </span>
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
              <div class="flex items-center gap-2">
                <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {{ selectedSession ? (selectedSession.agent_name || selectedSession.short_name || selectedSession.id) : 'Agent Stream Console' }}
                </h2>
                <span v-if="selectedSession && (selectedSession.status === 'running' || selectedSession.is_active)" class="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-mono">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE RUNNING
                </span>
              </div>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" v-if="selectedSession">
                {{ selectedSession.working_dir || '/data/projects/projectbase' }} • 🌿 {{ selectedSession.git_branch || 'main' }} {{ selectedSession.git_commit ? '@ ' + selectedSession.git_commit.slice(0, 7) : '' }}
              </p>
            </div>
          </div>

          <!-- Tab Bar / Actions -->
          <div class="flex items-center gap-1.5">
            <div class="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs">
              <button
                @click="activeTab = 'chat'"
                class="px-2.5 py-1 rounded-md font-medium transition-colors text-xs"
                :class="activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                💬 Live Chat & Stream
              </button>
              <button
                @click="activeTab = 'terminal'"
                class="px-2.5 py-1 rounded-md font-medium transition-colors text-xs"
                :class="activeTab === 'terminal' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                💻 Logs / Output
              </button>
              <button
                @click="activeTab = 'diff'"
                class="px-2.5 py-1 rounded-md font-medium transition-colors text-xs"
                :class="activeTab === 'diff' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                🌿 Git Diff
              </button>
            </div>

            <button
              v-if="selectedSession"
              @click="createTaskFromSession(selectedSession)"
              class="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1"
              title="Create a tracked issue from this session"
            >
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>Create Task</span>
            </button>
          </div>
        </div>

        <!-- TAB 1: Chat Stream -->
        <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
          <div id="agents-chat-container" class="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div v-if="!selectedSession" class="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs space-y-2">
              <i data-lucide="bot" class="w-8 h-8 opacity-30"></i>
              <p class="font-semibold text-zinc-600 dark:text-zinc-400">Select a session to inspect live output</p>
              <p class="max-w-xs text-zinc-400 text-[11px]">Or type in the prompt bar below to talk directly with your agent.</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(turn, idx) in chatTurns"
                :key="idx"
                class="flex items-start gap-2"
                :class="turn.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                  :class="turn.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-950/60 order-2' : 'bg-zinc-200 dark:bg-zinc-800 order-1'">
                  {{ turn.role === 'user' ? '🧑' : (selectedSession.avatar || '🧠') }}
                </span>

                <div
                  class="max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed space-y-2 shadow-2xs"
                  :class="turn.role === 'user'
                    ? 'bg-indigo-600 text-white order-1'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 order-2'"
                >
                  <div class="whitespace-pre-wrap font-sans text-xs leading-normal">{{ turn.content }}</div>

                  <!-- Test Verdict Badge -->
                  <div v-if="turn.test_verdict" class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] flex items-center justify-between">
                    <span>🧪 Tests Passed: {{ turn.test_verdict.passed || 0 }}/{{ turn.test_verdict.total || 0 }}</span>
                    <span>✓ {{ turn.test_verdict.status || 'passed' }}</span>
                  </div>

                  <!-- Tool calls / activity snippet -->
                  <div v-if="turn.tool_calls && turn.tool_calls.length" class="space-y-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <div v-for="(tc, tIdx) in turn.tool_calls" :key="tIdx" class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200/60 dark:border-zinc-800/60">
                      🔧 {{ tc.name }}
                    </div>
                  </div>

                  <div class="text-[9px] opacity-60 font-mono text-right pt-0.5">
                    {{ fmtTime(turn.created_at) }}
                  </div>
                </div>
              </div>

              <!-- Live Thinking Indicator when dispatching -->
              <div v-if="isDispatching" class="flex items-start gap-2 justify-start">
                <span class="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs shrink-0 mt-0.5">🧠</span>
                <div class="rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                  <span>Agent is thinking & executing via OmniRoute...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: Terminal Output & Logs -->
        <div v-else-if="activeTab === 'terminal'" class="flex-1 flex flex-col min-h-0 bg-[#09090b] text-zinc-200 p-3 font-mono text-xs overflow-y-auto">
          <div v-if="!selectedSession || !selectedSession.log_tail" class="text-zinc-500 italic p-6 text-center">
            No terminal stdout/stderr captured yet for this session.
          </div>
          <pre v-else class="whitespace-pre-wrap leading-relaxed text-zinc-300 font-mono text-[11px]">{{ selectedSession.log_tail }}</pre>
        </div>

        <!-- TAB 3: Git Diff -->
        <div v-else-if="activeTab === 'diff'" class="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 p-3 overflow-y-auto font-mono text-xs">
          <div v-if="!selectedSession || (!selectedSession.git_diff_raw && (!selectedSession.files_touched || !selectedSession.files_touched.length))" class="text-zinc-400 italic p-6 text-center">
            No git file modifications recorded for this session.
          </div>
          <div v-else class="space-y-2">
            <div v-if="selectedSession.files_touched && selectedSession.files_touched.length" class="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
              <span class="font-bold text-zinc-700 dark:text-zinc-300">Files Touched:</span>
              <ul class="list-disc list-inside mt-1 text-zinc-600 dark:text-zinc-400">
                <li v-for="f in selectedSession.files_touched" :key="f">{{ f }}</li>
              </ul>
            </div>
            <pre v-if="selectedSession.git_diff_raw" class="p-3 rounded bg-zinc-900 text-emerald-400 whitespace-pre-wrap overflow-x-auto text-[11px]">{{ selectedSession.git_diff_raw }}</pre>
          </div>
        </div>

        <!-- Interactive Real-Time Prompt Bar -->
        <div class="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-end space-x-2">
            <textarea
              v-model="quickPrompt"
              @keydown.enter.exact.prevent="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
              rows="1"
              :placeholder="selectedSession ? ('Ask ' + (selectedSession.agent_name || selectedSession.short_name) + ' a question or give a task… (Press Enter)') : 'Type a task to chat with Flomaster… (Press Enter)'"
              class="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 resize-none"
            ></textarea>
            <button
              @click="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
              :disabled="isDispatching || !quickPrompt.trim()"
              class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0"
            >
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>{{ isDispatching ? 'Thinking…' : 'Send' }}</span>
            </button>
          </div>
          <div v-if="dispatchSuccess" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">✓ {{ dispatchSuccess }}</div>
          <div v-if="dispatchError" class="text-[10px] text-rose-600 dark:text-rose-400 font-mono mt-1">✕ {{ dispatchError }}</div>
        </div>
      </section>
    </div>
  `
};

window.AgentsViewComponent = AgentsViewComponent;
