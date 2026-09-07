// pb_public/js/components/AgentsView.js
// ProjectBase — Lean, Fast AI Agent Console & Live Execution Stream.
// Focus: Real-time agent session stream, live PID/diff inspection, and direct prompt dispatch.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all',
      activeTab: 'chat',
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null,
      dispatchError: null,
      chatLog: {},
      liveStreamActive: true,
      pollTimer: null,
      showTools: true,
      expandedMessage: null,
      sessionSuccessMsg: null,
      sessionErrorMsg: null,
      branchModalOpen: false,
      branchNameInput: '',
      branchPromptInput: '',
      isBranchingSession: false,
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
        // `agent` is not a schema field; match the runtime family plus the per-session
        // display name (agent_name is shaped like "Flomaster (parrot)").
        const name = (this.activeAgent.name || '').toLowerCase();
        const rt = (this.activeAgent.runtime || '').toLowerCase();
        return all.filter(s =>
          (s.runtime || '').toLowerCase() === rt ||
          (s.runtime || '').toLowerCase() === name ||
          (s.agent || '').toLowerCase() === name ||
          (s.agent_name || '').toLowerCase().startsWith(name)
        );
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
      if (this.chatLog[sid] && this.chatLog[sid].length > 0) {
        return this.chatLog[sid];
      }
      let rawTurns = [];
      // Check multiple sources for chat data (defensive: any source field may
      // be missing or non-array depending on the ingestion path).
      if (s.chat && Array.isArray(s.chat)) {
        rawTurns = s.chat;
      } else if (s.metadata && Array.isArray(s.metadata.chat)) {
        rawTurns = s.metadata.chat;
      } else if (s.chat && !Array.isArray(s.chat)) {
        rawTurns = [s.chat];
      }
      if (s.live_activity && Array.isArray(s.live_activity) && s.live_activity.length > 0) {
        const evTurns = s.live_activity.map(ev => {
          const o = Object.assign({}, ev);
          o.role = 'assistant';
          if (ev.type === 'text') o.content = ev.summary || ev.content || '';
          if (ev.type === 'reasoning') o.reasoning = ev.summary || '';
          if (ev.type === 'tool') {
            const t = { name: ev.name || ev.tool || 'tool', input: ev.input || '', intent: ev.intent || '' };
            if (Array.isArray(ev.tools)) {
              t.input = (o.input || '') + (ev.tools.length ? '\n' + ev.tools.map(x => x.name || x.tool || 'tool').join(', ') : '');
            }
            o.tools = [t];
          }
          o.timestamp = ev.timestamp;
          return o;
        });
        rawTurns = (s.chat || (s.metadata && s.metadata.chat)) ? rawTurns.concat(evTurns) : evTurns;
      }

      const validTurns = rawTurns.filter(t => t && (t.content || t.reasoning || (t.tools && t.tools.length) || (t.tool_calls && t.tool_calls.length)));
      
      if (validTurns.length > 0) {
        const coalesced = [];
        for (const t of validTurns) {
          const tTools = t.tools || t.tool_calls || [];
          if (t.role === 'assistant' && coalesced.length > 0 && coalesced[coalesced.length - 1].role === 'assistant') {
            const prev = coalesced[coalesced.length - 1];
            if (t.reasoning) {
              prev.reasoning = prev.reasoning ? (prev.reasoning + '\n\n' + t.reasoning) : t.reasoning;
            }
            if (tTools.length > 0) {
              prev.tools = (prev.tools || []).concat(tTools);
            }
            if (t.content) {
              prev.content = prev.content ? (prev.content + '\n\n' + t.content) : t.content;
            }
            if (t.timestamp || t.created_at) {
              prev.timestamp = t.timestamp || t.created_at;
            }
          } else {
            coalesced.push({
              ...t,
              tools: tTools
            });
          }
        }
        return coalesced;
      }

      // No chat data captured — show the dispatched command as a placeholder
      const cmd = s.command || s.title || s.last_prompt || '';
      if (cmd) {
        return [{
          role: 'assistant',
          content: `**${s.agent_name || 'Agent'}** was dispatched: "${cmd}"\n\nNo message log was captured for this run.`,
          timestamp: s.started_at || s.created,
        }];
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
    renderMarkdown(content) {
      if (!content) return '';
      if (window.marked && window.DOMPurify) {
        try {
          return window.DOMPurify.sanitize(window.marked.parse(String(content), { breaks: true, gfm: true }));
        } catch (e) {
          return String(content);
        }
      }
      return String(content);
    },
    getToolIcon(name) {
      const n = (name || '').toLowerCase();
      if (n.includes('bash') || n.includes('cmd') || n.includes('exec')) return '⚡';
      if (n.includes('read') || n.includes('file')) return '📄';
      if (n.includes('edit') || n.includes('write') || n.includes('patch')) return '✏️';
      if (n.includes('grep') || n.includes('search') || n.includes('find')) return '🔍';
      if (n.includes('todo') || n.includes('task')) return '📋';
      if (n.includes('browser') || n.includes('web')) return '🌐';
      if (n.includes('git')) return '🌿';
      return '🔧';
    },
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
      // Invalidate cached chat log for this session so computed re-evaluates
      const sid = s.session_id || s.id;
      if (sid) {
        this.$delete(this.chatLog, sid);
      }
      try {
        if (window.API && window.API.getAgentSessionDetails) {
          const detail = await window.API.getAgentSessionDetails(this.selectedSessionId).catch(() => null);
          if (detail) {
            // Extract chat from metadata.chat if present (PocketBase stores it there)
            if (detail.metadata && Array.isArray(detail.metadata.chat) && detail.metadata.chat.length > 0) {
              detail.chat = detail.metadata.chat;
            }
            // Mutate the list item AND re-set the id so any watcher on
            // selectedSessionId re-evaluates the chatTurns computed even when
            // the user re-clicks the same session.
            Object.assign(s, detail);
            this.$nextTick(() => { this.selectedSessionId = s.id || s.session_id; });
          }
        }
      } catch (x) {}
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
      if (!this.quickPrompt.trim()) return;
      this.isDispatching = true;
      this.dispatchSuccess = null;
      this.dispatchError = null;
      try {
        const target = agentName || (this.activeAgent ? this.activeAgent.name : 'flomaster');
        const sid = this.selectedSession ? (this.selectedSession.session_id || this.selectedSession.id) : null;
        
        const res = await API.dispatchAgent(target, {
          prompt: this.quickPrompt.trim(),
          session_id: sid
        });

        const turnSid = sid || (res && res.session_id) || 'active';
        if (!this.chatLog[turnSid]) {
          this.chatLog[turnSid] = [...this.chatTurns];
        }
        this.chatLog[turnSid].push({
          role: 'user',
          content: this.quickPrompt.trim(),
          created_at: new Date().toISOString()
        });
        if (res && res.response) {
          this.chatLog[turnSid].push({
            role: 'assistant',
            content: res.response,
            created_at: new Date().toISOString()
          });
        }

        if (this.selectedSession && this.selectedSession.chat) {
          this.selectedSession.chat.push({
            role: 'user',
            content: this.quickPrompt.trim(),
            created_at: new Date().toISOString()
          });
          if (res && res.response) {
            this.selectedSession.chat.push({
              role: 'assistant',
              content: res.response,
              created_at: new Date().toISOString()
            });
          }
        }

        this.dispatchSuccess = `Dispatched to ${target}`;
        this.quickPrompt = '';
        setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        this.$emit('sync-agents');
      } catch (e) {
        console.error('Dispatch failed', e);
        this.dispatchError = e.message || 'Dispatch failed';
        setTimeout(() => { this.dispatchError = null; }, 4000);
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
    },
    loadAgentSessions() {
      this.$emit('sync-agents');
    },
    // Debugger Methods (Milestone 16 / Epic 37)
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- PANE 1: LEFT AGENT FLEET SIDEBAR -->
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
                class="px-1 py-0.5 rounded font-semibold text-[9px]"
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
                <span v-if="selectedSession && (selectedSession.status === 'running' || selectedSession.is_active)" class="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-mono">
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
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                💬 Stream
              </button>
              <button
                @click="activeTab = 'terminal'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'terminal' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                💻 Logs / Output
              </button>
              <button
                @click="activeTab = 'diff'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'diff' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                🌿 Git Diff
              </button>
              <button
                @click="activeTab = 'runs'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'runs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'"
              >
                📊 Telemetry
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
          <div v-if="selectedSession" class="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/30 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex-wrap">
            <span v-if="selectedSession.pid" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">PID</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.pid }}</span>
            </span>
            <span v-if="selectedSession.model" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">MODEL</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.model }}</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">TOKENS</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ fmtTokens((selectedSession.tokens_in || 0) + (selectedSession.tokens_out || 0)) }}</span>
            </span>
            <span v-if="selectedSession.git_commit_after" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">GIT</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.git_commit_after.slice(0, 7) }}</span>
            </span>
            <span v-if="selectedSession.files_touched && selectedSession.files_touched.length" class="flex items-center gap-1.5 min-w-0">
              <span class="text-zinc-400 dark:text-zinc-500 shrink-0">FILES</span>
              <span class="flex items-center gap-1 flex-wrap min-w-0">
                <span v-for="f in (selectedSession.files_touched || []).slice(0, 3)" :key="f" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] truncate max-w-[140px]">{{ f.split('/').slice(-2).join('/') }}</span>
                <span v-if="selectedSession.files_touched.length > 3" class="text-zinc-400">+{{ selectedSession.files_touched.length - 3 }}</span>
              </span>
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div v-if="!selectedSession" class="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs space-y-2">
              <i data-lucide="bot" class="w-8 h-8 opacity-30"></i>
              <p class="font-semibold text-zinc-600 dark:text-zinc-400">Select a session to inspect live output</p>
              <p class="max-w-xs text-zinc-400 text-[11px]">Or use the quick prompt below to dispatch a task to your agent swarm.</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(turn, idx) in chatTurns"
                :key="idx"
                class="flex items-start gap-2.5"
                :class="turn.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <!-- Avatar -->
                <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs border"
                  :class="turn.role === 'user'
                    ? 'bg-indigo-600 border-indigo-500 text-white order-2'
                    : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100 order-1'">
                  {{ turn.role === 'user' ? '🧑' : (selectedSession.avatar || '🧠') }}
                </span>

                <!-- Message Box -->
                <div
                  class="max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2.5 shadow-sm transition-all"
                  :class="turn.role === 'user'
                    ? 'bg-indigo-600 text-white order-1 border border-indigo-500/80'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 order-2'"
                >
                  <!-- Thought / Reasoning Collapsible Disclosure Block -->
                  <details v-if="turn.reasoning" class="group rounded-xl border border-amber-500/20 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden text-xs">
                    <summary class="px-3 py-1.5 cursor-pointer font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between hover:bg-amber-100/40 dark:hover:bg-amber-900/20 select-none">
                      <span class="flex items-center gap-1.5">
                        <span>💭</span>
                        <span class="tracking-wider uppercase">Thought Process</span>
                      </span>
                      <span class="text-[9px] opacity-75 font-normal">details ▾</span>
                    </summary>
                    <div class="px-3.5 py-2.5 border-t border-amber-500/10 dark:border-amber-500/10 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 italic whitespace-pre-wrap select-text bg-white/40 dark:bg-black/30" v-html="renderMarkdown(turn.reasoning)"></div>
                  </details>

                  <!-- Tool Executions Deck -->
                  <div v-if="turn.tools && turn.tools.length" class="space-y-1.5">
                    <div class="flex items-center justify-between text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 px-0.5">
                      <span class="flex items-center gap-1">
                        <span>🔧</span>
                        <span>EXECUTED TOOLS ({{ turn.tools.length }})</span>
                      </span>
                    </div>
                    <div class="space-y-1">
                      <div v-for="(tc, tIdx) in turn.tools" :key="tIdx" class="p-2 rounded-lg bg-zinc-50/90 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 text-[11px] font-mono flex flex-col gap-1 shadow-2xs">
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-400/20 shrink-0">
                              {{ getToolIcon(tc.name) }} {{ tc.name }}
                            </span>
                            <span v-if="tc.intent" class="font-medium text-zinc-800 dark:text-zinc-200 truncate text-[10.5px]">{{ tc.intent }}</span>
                          </div>
                        </div>
                        <div v-if="tc.input" class="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/90 p-1.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 truncate font-mono select-all">
                          {{ tc.input }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Text content (Markdown Rendered with Code Highlight Styling) -->
                  <div v-if="turn.content" class="chat-markdown markdown-body text-xs leading-relaxed select-text" :class="turn.role === 'user' ? 'text-white' : 'text-zinc-800 dark:text-zinc-100'" v-html="renderMarkdown(turn.content)"></div>

                  <!-- Test Verdict Badge -->
                  <div v-if="turn.test_verdict" class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] flex items-center justify-between">
                    <span>🧪 Tests Passed: {{ turn.test_verdict.passed || 0 }}/{{ turn.test_verdict.total || 0 }}</span>
                    <span>✓ {{ turn.test_verdict.status || 'passed' }}</span>
                  </div>

                  <!-- Timestamp Footer -->
                  <div class="text-[9px] opacity-60 font-mono text-right pt-0.5" :class="turn.role === 'user' ? 'text-indigo-100' : 'text-zinc-400'">
                    {{ fmtTime(turn.timestamp || turn.created_at || turn.created) }}
                  </div>
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
          <pre v-else class="whitespace-pre-wrap leading-relaxed text-zinc-300">{{ selectedSession.log_tail }}</pre>
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

        <!-- TAB 4: Telemetry & Ephemeral Sandboxes -->
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
          </div>
          <div v-else class="py-16 text-center text-zinc-400 italic">
            Select a session run to inspect telemetry.
          </div>
        </div>

<!-- Interactive Dispatch Bar -->
        <div class="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
          <div class="flex items-end space-x-2">
            <textarea
              v-model="quickPrompt"
              @keydown.enter.exact.prevent="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
              rows="1"
              :placeholder="selectedSession ? ('Send follow-up prompt to ' + (selectedSession.agent_name || selectedSession.short_name) + '…') : 'Dispatch task to agent swarm…'"
              class="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
            ></textarea>
            <button
              @click="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
              :disabled="isDispatching || !quickPrompt.trim()"
              class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0"
            >
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>{{ isDispatching ? 'Sending…' : 'Send' }}</span>
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
