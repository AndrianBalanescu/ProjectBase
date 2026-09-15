// pb_public/js/components/AgentsView.js
// ProjectBase — Lean, Fast Sessions Console & Live Execution Stream.
// Focus: real-time session stream, live PID/diff inspection, collapsible +
// resizable layout, grouped tool decks, and direct prompt dispatch.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all',
      activeTab: 'chat',
      chatLog: {},
      liveStreamActive: true,
      pollTimer: null,
      showTools: true,
      expandedMessage: null,
      sessionSuccessMsg: null,
      sessionErrorMsg: null,

      // Panel layout: combined provider + sessions sidebar.
      leftWidth: 288,
      leftCollapsed: false,
      leftDragging: false,
      resizeStartX: 0,
      resizeStartWidth: 288,
      showProviders: true,
      showSessionList: true,
      expandedToolGroups: {},
      expandedDiff: false,

      // Chat dispatch
      chatDraft: '',
      isSending: false,
      sendError: null,
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
      let list = all;
      if (this.activeAgent) {
        // `agent` is not a schema field; match the runtime family plus the per-session
        // display name (agent_name is shaped like "Flomaster (parrot)").
        const name = (this.activeAgent.name || '').toLowerCase();
        const rt = (this.activeAgent.runtime || '').toLowerCase();
        list = all.filter(s =>
          (s.runtime || '').toLowerCase() === rt ||
          (s.runtime || '').toLowerCase() === name ||
          (s.agent || '').toLowerCase() === name ||
          (s.agent_name || '').toLowerCase().startsWith(name)
        );
      }
      // The sidebar search filters runs too, not just the provider tabs.
      const q = this.search.trim().toLowerCase();
      if (!q) return list;
      return list.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.last_prompt || '').toLowerCase().includes(q) ||
        (s.short_name || '').toLowerCase().includes(q) ||
        (s.agent_name || '').toLowerCase().includes(q) ||
        (s.working_dir || '').toLowerCase().includes(q) ||
        (s.session_id || '').toLowerCase().includes(q)
      );
    },
    selectedSession() {
      if (!this.selectedSessionId) {
        return this.visibleSessions[0] || null;
      }
      return this.visibleSessions.find(s => s.id === this.selectedSessionId || s.session_id === this.selectedSessionId) || this.visibleSessions[0] || null;
    },
    selectedSessionKey() {
      const s = this.selectedSession;
      return s ? (s.session_id || s.id) : null;
    },
    leftStyle() {
      return { width: this.leftWidth + 'px' };
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
          else if (ev.type === 'reasoning') o.reasoning = ev.summary || ev.content || '';
          else if (ev.type === 'tool') {
            const t = { name: ev.name || ev.tool || 'tool', input: ev.input || '', intent: ev.intent || '' };
            if (Array.isArray(ev.tools) && ev.tools.length) {
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
    },
    /** Raw diff for the selected run, from the list payload or fetched detail. */
    selectedDiff() {
      const s = this.selectedSession;
      if (!s) return '';
      return s.git_diff_raw || s.git_diff || '';
    },
    diffStats() {
      const raw = this.selectedDiff;
      if (!raw) return { added: 0, removed: 0 };
      let added = 0, removed = 0;
      for (const line of raw.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---')) continue;
        if (line.startsWith('+')) added++;
        else if (line.startsWith('-')) removed++;
      }
      return { added, removed };
    },
  },
  mounted() {
    this._loadLayout();
    if (window.lucide) window.lucide.createIcons();
    window.addEventListener('mousemove', this.onResizeMove);
    window.addEventListener('mouseup', this.stopResize);
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
    window.removeEventListener('mousemove', this.onResizeMove);
    window.removeEventListener('mouseup', this.stopResize);
  },
  updated() {
    if (window.lucide) window.lucide.createIcons();
  },
  methods: {
    // --- Layout ------------------------------------------------------------
    _loadLayout() {
      try {
        const w = Number(localStorage.getItem('pb.sessions.leftWidth'));
        if (w && w >= 200 && w <= 560) this.leftWidth = w;
        this.leftCollapsed = localStorage.getItem('pb.sessions.leftCollapsed') === '1';
        this.showProviders = localStorage.getItem('pb.sessions.showProviders') !== '0';
        this.showSessionList = localStorage.getItem('pb.sessions.showSessionList') !== '0';
      } catch (e) {}
    },
    _saveLayout() {
      try {
        localStorage.setItem('pb.sessions.leftWidth', String(this.leftWidth));
        localStorage.setItem('pb.sessions.leftCollapsed', this.leftCollapsed ? '1' : '0');
        localStorage.setItem('pb.sessions.showProviders', this.showProviders ? '1' : '0');
        localStorage.setItem('pb.sessions.showSessionList', this.showSessionList ? '1' : '0');
      } catch (e) {}
    },
    toggleLeft() {
      this.leftCollapsed = !this.leftCollapsed;
      this._saveLayout();
    },
    toggleProviders() {
      this.showProviders = !this.showProviders;
      this._saveLayout();
    },
    toggleSessionList() {
      this.showSessionList = !this.showSessionList;
      this._saveLayout();
    },
    startResize(e) {
      this.leftDragging = true;
      this.resizeStartX = e.clientX;
      this.resizeStartWidth = this.leftWidth;
      e.preventDefault();
    },
    onResizeMove(e) {
      if (!this.leftDragging) return;
      const delta = e.clientX - this.resizeStartX;
      const next = this.resizeStartWidth + delta;
      this.leftWidth = Math.max(200, Math.min(560, Math.round(next)));
    },
    stopResize() {
      if (!this.leftDragging) return;
      this.leftDragging = false;
      this._saveLayout();
    },
    resetLeftWidth() {
      this.leftWidth = 288;
      this._saveLayout();
    },

    // --- Rendering helpers -------------------------------------------------
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
    /** Collapse tool aliases so bash/bash_cmd/run_bash land in one group. */
    normalizeToolName(name) {
      const n = (name || 'tool').toLowerCase().trim();
      // Ordered most-specific first: 'TodoWrite' contains 'write' but is a task
      // tool, and 'WebFetch' contains 'fetch', so the edit/web rules must not
      // swallow them.
      if (n.includes('todo')) return 'todo';
      if (n.includes('bash') || n.includes('shell') || n === 'cmd' || n.includes('exec')) return 'bash';
      if (n.startsWith('read') || n.includes('read_file') || n.includes('cat')) return 'read';
      if (n.includes('grep') || n.includes('search') || n.includes('find') || n.includes('glob')) return 'search';
      if (n.includes('browser') || n.includes('web') || n.includes('fetch')) return 'web';
      if (n.includes('git')) return 'git';
      if (n.includes('edit') || n.includes('write') || n.includes('patch') || n.includes('apply')) return 'edit';
      if (n.includes('task')) return 'todo';
      return n || 'tool';
    },
    /**
     * Group *consecutive* calls of the same tool into one deck so a run of
     * bash calls renders as a single "bash · 4 calls" block instead of four.
     */
    groupedTools(tools) {
      const list = Array.isArray(tools) ? tools : [];
      const groups = [];
      for (const tc of list) {
        const key = this.normalizeToolName(tc && tc.name);
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
          last.calls.push(tc);
        } else {
          groups.push({ key, label: (tc && tc.name) || key, icon: this.getToolIcon(tc && tc.name), calls: [tc] });
        }
      }
      return groups;
    },
    groupKey(turnIdx, groupIdx) {
      return turnIdx + ':' + groupIdx;
    },
    toggleToolGroup(turnIdx, groupIdx) {
      const k = this.groupKey(turnIdx, groupIdx);
      // Groups default to expanded, so invert the *effective* state rather than
      // the raw map value (a missing key would otherwise always expand).
      const current = this.isToolGroupExpanded(turnIdx, groupIdx);
      this.expandedToolGroups = Object.assign({}, this.expandedToolGroups, { [k]: !current });
    },
    isToolGroupExpanded(turnIdx, groupIdx) {
      const k = this.groupKey(turnIdx, groupIdx);
      // Single-call groups are always "open" — collapsing adds no value.
      return this.expandedToolGroups[k] !== false;
    },

    // --- Git diff: real per-line red/green --------------------------------
    diffLines(raw) {
      if (!raw) return [];
      const out = [];
      for (const line of String(raw).split('\n')) {
        let type = 'ctx';
        if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('new file') ||
            line.startsWith('deleted file') || line.startsWith('similarity index') || line.startsWith('rename ')) {
          type = 'meta';
        } else if (line.startsWith('@@')) {
          type = 'hunk';
        } else if (line.startsWith('+++') || line.startsWith('---')) {
          type = 'file';
        } else if (line.startsWith('+')) {
          type = 'add';
        } else if (line.startsWith('-')) {
          type = 'del';
        }
        out.push({ text: line, type });
      }
      return out;
    },
    diffLineClass(type) {
      // Alpha is deliberately high enough to read as a real git diff at a
      // glance (a /10 tint was indistinguishable from context lines).
      if (type === 'add') return 'bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border-l-2 border-emerald-500/70';
      if (type === 'del') return 'bg-red-500/25 text-red-800 dark:text-red-200 border-l-2 border-red-500/70';
      if (type === 'hunk') return 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border-l-2 border-indigo-500/50 font-semibold';
      if (type === 'meta') return 'text-zinc-500 dark:text-zinc-500 border-l-2 border-transparent';
      if (type === 'file') return 'text-sky-700 dark:text-sky-300 border-l-2 border-transparent font-semibold';
      return 'text-zinc-600 dark:text-zinc-400 border-l-2 border-transparent';
    },
    shortPath(p) {
      if (!p) return '';
      const parts = String(p).split('/');
      return parts.length <= 2 ? p : parts.slice(-2).join('/');
    },

    // --- Selection ---------------------------------------------------------
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
      this.chatDraft = '';
      this.sendError = null;
      // Invalidate cached transcript so the computed re-reads fresh state.
      const sid = s.session_id || s.id;
      if (sid) {
        delete this.chatLog[sid];
        this.chatLog = Object.assign({}, this.chatLog);
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
    tokenCount(s) {
      if (!s) return 0;
      if (typeof s.tokens === 'number') return s.tokens;
      if (s.token_usage) return (s.token_usage.input || 0) + (s.token_usage.output || 0);
      return (s.tokens_in || 0) + (s.tokens_out || 0);
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

    // --- Chat dispatch -----------------------------------------------------
    /**
     * Append an operator turn to this run and show the reply. The session list
     * payload carries the transcript, so re-selecting refreshes it.
     */
    async sendMessage() {
      const text = (this.chatDraft || '').trim();
      if (!text || this.isSending) return;
      const s = this.selectedSession;
      if (!s) return;
      const sid = s.session_id || s.id;
      const target = s.id || s.session_id;

      this.isSending = true;
      this.sendError = null;

      // Optimistic user turn so the console feels live during the round trip.
      const optimistic = (this.chatTurns || []).concat([{
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      }]);
      this.chatLog = Object.assign({}, this.chatLog, { [sid]: optimistic });
      this.chatDraft = '';

      try {
        if (!(window.API && window.API.sendSessionMessage)) {
          throw new Error('Chat API unavailable');
        }
        const res = await window.API.sendSessionMessage(target, text);
        if (res && Array.isArray(res.turns) && res.turns.length > 0) {
          this.chatLog = Object.assign({}, this.chatLog, { [sid]: res.turns });
        } else if (res && res.response) {
          this.chatLog = Object.assign({}, this.chatLog, {
            [sid]: optimistic.concat([{
              role: 'assistant',
              content: res.response,
              created_at: new Date().toISOString(),
            }])
          });
        }
        this.sessionSuccessMsg = res && res.gateway_reached === false
          ? 'Message queued (no LLM gateway configured)'
          : 'Message sent';
        setTimeout(() => { this.sessionSuccessMsg = null; }, 3000);
        this.$emit('sync-agents');
      } catch (e) {
        // Keep the optimistic turn visible; surface the failure next to it.
        this.sendError = (e && e.message) || 'Failed to send message';
        // Restore the draft so the user does not lose their text.
        this.chatDraft = text;
        this.chatLog = Object.assign({}, this.chatLog, { [sid]: optimistic.slice(0, -1) });
      } finally {
        this.isSending = false;
      }
    },
    onChatKeydown(e) {
      // Enter sends; Shift+Enter inserts a newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    },
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- ================= COMBINED PANEL: providers (tabs) + sessions list ================= -->
      <aside
        v-show="!leftCollapsed"
        data-qa="sessions-panel"
        :style="leftStyle"
        class="w-full md:shrink-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs"
      >
        <!-- Panel header -->
        <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 shrink-0">
          <div class="flex items-center space-x-1.5 min-w-0">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200 truncate">Sessions</span>
            <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
              {{ onlineAgents.length }}/{{ (agents || []).length }}
            </span>
          </div>
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              @click="$emit('sync-agents')"
              class="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Rescan sessions"
            >
              <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            </button>
            <button
              @click="toggleLeft"
              class="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Collapse panel"
            >
              <i data-lucide="chevrons-left" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="p-2 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <input
            v-model="search"
            type="text"
            placeholder="Filter runs..."
            class="w-full px-2.5 py-1 text-xs rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>

        <!-- Provider tabs (agent runtimes) -->
        <div class="border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <button
            @click="toggleProviders"
            class="w-full px-2 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
          >
            <span class="flex items-center gap-1.5">
              <i data-lucide="cpu" class="w-3 h-3"></i>
              <span>Providers</span>
            </span>
            <i :data-lucide="showProviders ? 'chevron-down' : 'chevron-right'" class="w-3 h-3"></i>
          </button>
          <div v-show="showProviders" class="px-2 pb-2 flex flex-wrap gap-1">
            <button
              @click="selectAgent(null)"
              class="px-2 py-1 rounded-lg text-[11px] font-medium transition-colors border"
              :class="!activeAgent
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300'
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              All
              <span class="opacity-60 font-mono">{{ totalSessions }}</span>
            </button>
            <button
              v-for="a in filteredAgents"
              :key="a.name"
              @click="selectAgent(a.name)"
              class="px-2 py-1 rounded-lg text-[11px] font-medium transition-colors border flex items-center gap-1.5"
              :class="activeAgentName === a.name
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300'
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
              :title="a.name + ' · ' + (a.status || 'unknown')"
            >
              <span>{{ a.avatar || '🤖' }}</span>
              <span class="capitalize">{{ a.name }}</span>
              <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(a.status)"></span>
            </button>
          </div>
        </div>

        <!-- Sessions / runs list -->
        <div class="flex flex-col min-h-0 flex-1">
          <button
            @click="toggleSessionList"
            class="w-full px-2 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors shrink-0"
          >
            <span class="flex items-center gap-1.5 min-w-0">
              <i data-lucide="activity" class="w-3 h-3 shrink-0"></i>
              <span class="truncate">{{ activeAgent ? activeAgent.name + ' Runs' : 'Recent Runs' }}</span>
            </span>
            <span class="flex items-center gap-1 shrink-0">
              <span class="font-mono normal-case">{{ visibleSessions.length }}</span>
              <i :data-lucide="showSessionList ? 'chevron-down' : 'chevron-right'" class="w-3 h-3"></i>
            </span>
          </button>

          <div v-show="showSessionList" data-qa="session-list" class="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
            <div v-if="visibleSessions.length === 0" class="p-6 text-center text-xs text-zinc-400 italic">
              No session runs found.
            </div>

            <div
              v-for="s in visibleSessions"
              :key="s.id"
              @click="selectSession(s)"
              class="p-2 rounded-lg cursor-pointer transition-all border text-xs"
              :class="selectedSession && (selectedSession.id === s.id || selectedSession.session_id === s.session_id)
                ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300/60 dark:border-indigo-800/60'
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

              <div class="flex items-center justify-between text-[10px] text-zinc-400 font-mono gap-1">
                <div class="flex items-center space-x-1 truncate min-w-0" :title="s.working_dir">
                  <span class="shrink-0">📁</span>
                  <span class="truncate">{{ s.working_dir ? s.working_dir.split('/').slice(-2).join('/') : 'workspace' }}</span>
                </div>
                <span
                  class="px-1 py-0.5 rounded font-semibold text-[9px] shrink-0"
                  :class="s.status === 'running' || s.is_active ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'"
                >
                  {{ s.status || 'completed' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Collapsed rail -->
      <button
        v-if="leftCollapsed"
        @click="toggleLeft"
        class="hidden md:flex shrink-0 w-8 flex-col items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        title="Expand sessions panel"
      >
        <i data-lucide="chevrons-right" class="w-3.5 h-3.5"></i>
        <span class="text-[10px] font-mono [writing-mode:vertical-rl]">{{ visibleSessions.length }} runs</span>
      </button>

      <!-- Resizer -->
      <div
        v-if="!leftCollapsed"
        @mousedown="startResize"
        @dblclick="resetLeftWidth"
        class="hidden md:block w-1.5 shrink-0 rounded-full cursor-col-resize transition-colors self-stretch"
        :class="leftDragging ? 'bg-indigo-400/70' : 'bg-transparent hover:bg-zinc-300 dark:hover:bg-zinc-700'"
        title="Drag to resize · double-click to reset"
      ></div>

      <!-- ================= MAIN CONSOLE ================= -->
      <section class="flex-1 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs min-w-0">

        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div class="flex items-center space-x-2 min-w-0">
            <span class="text-lg shrink-0">{{ selectedSession ? (selectedSession.avatar || '🧠') : '🤖' }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {{ selectedSession ? (selectedSession.agent_name || selectedSession.short_name || selectedSession.id) : 'Sessions Console' }}
                </h2>
                <span v-if="selectedSession && (selectedSession.status === 'running' || selectedSession.is_active)" class="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-mono shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE RUNNING
                </span>
              </div>
              <p class="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" v-if="selectedSession">
                {{ selectedSession.working_dir || '/data/projects/projectbase' }} • 🌿 {{ selectedSession.git_branch || 'main' }} {{ selectedSession.git_commit_after ? '@ ' + selectedSession.git_commit_after.slice(0, 7) : (selectedSession.git_commit ? '@ ' + selectedSession.git_commit.slice(0, 7) : '') }}
              </p>
            </div>
          </div>

          <!-- Tab Bar / Actions -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <div class="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs">
              <button
                @click="activeTab = 'chat'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              >
                💬 Stream
              </button>
              <button
                @click="activeTab = 'terminal'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'terminal' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              >
                💻 Logs / Output
              </button>
              <button
                @click="activeTab = 'diff'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1"
                :class="activeTab === 'diff' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              >
                <span>🌿 Git Diff</span>
                <span v-if="diffStats.added || diffStats.removed" class="font-mono text-[9px]">
                  <span class="text-emerald-600 dark:text-emerald-400">+{{ diffStats.added }}</span>
                  <span class="text-red-600 dark:text-red-400">-{{ diffStats.removed }}</span>
                </span>
              </button>
              <button
                @click="activeTab = 'runs'"
                class="px-2 py-0.5 rounded-md font-medium transition-colors"
                :class="activeTab === 'runs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
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
          <div v-if="selectedSession" class="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/30 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex-wrap shrink-0">
            <span v-if="selectedSession.pid" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">PID</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.pid }}</span>
            </span>
            <span v-if="selectedSession.model" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">MODEL</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.model }}</span>
            </span>
            <span v-if="tokenCount(selectedSession)" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">TOKENS</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ fmtTokens(tokenCount(selectedSession)) }}</span>
            </span>
            <span v-if="selectedSession.git_commit_after" class="flex items-center gap-1">
              <span class="text-zinc-400 dark:text-zinc-500">GIT</span>
              <span class="text-zinc-700 dark:text-zinc-200 font-semibold">{{ selectedSession.git_commit_after.slice(0, 7) }}</span>
            </span>
            <span v-if="selectedSession.files_touched && selectedSession.files_touched.length" class="flex items-center gap-1.5 min-w-0">
              <span class="text-zinc-400 dark:text-zinc-500 shrink-0">FILES</span>
              <span class="flex items-center gap-1 flex-wrap min-w-0">
                <span v-for="f in (selectedSession.files_touched || []).slice(0, 3)" :key="f" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] truncate max-w-[140px]" :title="f">{{ shortPath(f) }}</span>
                <span v-if="selectedSession.files_touched.length > 3" class="text-zinc-400">+{{ selectedSession.files_touched.length - 3 }}</span>
              </span>
            </span>
          </div>

          <!-- Transcript -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30 min-h-0">
            <div v-if="!selectedSession" class="flex flex-col items-center justify-center h-full text-zinc-400 italic text-sm gap-2">
              <span class="text-3xl">🧠</span>
              <span>Select an execution run to inspect its live stream.</span>
            </div>

            <div v-else-if="chatTurns.length === 0" class="flex flex-col items-center justify-center h-full text-zinc-400 italic text-sm gap-2">
              <span class="text-3xl">💬</span>
              <span>No transcript captured for this run yet.</span>
            </div>

            <div v-for="(turn, ti) in chatTurns" :key="ti" class="flex" :class="turn.role === 'user' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[92%] min-w-0 space-y-1.5">
                <div
                  class="rounded-xl px-3 py-2 text-xs shadow-2xs"
                  :class="turn.role === 'user'
                    ? 'bg-indigo-600 text-white order-1'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 order-2'"
                >
                  <!-- Thought / Reasoning Collapsible Disclosure Block -->
                  <details v-if="turn.reasoning" class="group rounded-xl border border-amber-500/20 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden text-xs mb-2">
                    <summary class="px-3 py-1.5 cursor-pointer font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between hover:bg-amber-100/40 dark:hover:bg-amber-900/20 select-none">
                      <span class="flex items-center gap-1.5">
                        <span>💭</span>
                        <span class="tracking-wider uppercase">Thought Process</span>
                      </span>
                      <span class="text-[9px] opacity-75 font-normal">toggle ▾</span>
                    </summary>
                    <div class="px-3.5 py-2.5 border-t border-amber-500/10 dark:border-amber-500/10 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 italic whitespace-pre-wrap select-text bg-white/40 dark:bg-black/30" v-html="renderMarkdown(turn.reasoning)"></div>
                  </details>

                  <!-- Tool Executions Deck: consecutive same-tool calls share one block -->
                  <div v-if="turn.tools && turn.tools.length" class="space-y-1.5 mb-2">
                    <div class="flex items-center justify-between text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 px-0.5">
                      <span class="flex items-center gap-1">
                        <span>🔧</span>
                        <span>EXECUTED TOOLS ({{ turn.tools.length }})</span>
                      </span>
                      <span v-if="groupedTools(turn.tools).length !== turn.tools.length" class="text-[9px] text-zinc-400 font-normal normal-case">
                        {{ groupedTools(turn.tools).length }} groups
                      </span>
                    </div>

                    <div class="space-y-1">
                      <div
                        v-for="(grp, gi) in groupedTools(turn.tools)"
                        :key="gi"
                        class="rounded-lg bg-zinc-50/90 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden shadow-2xs"
                      >
                        <!-- Group header: one line per tool family -->
                        <button
                          @click="toggleToolGroup(ti, gi)"
                          class="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70 transition-colors"
                        >
                          <span class="flex items-center gap-1.5 min-w-0">
                            <span class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-400/20 shrink-0 font-mono">
                              {{ grp.icon }} {{ grp.label }}
                            </span>
                            <span v-if="grp.calls.length > 1" class="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] font-mono font-semibold shrink-0">
                              {{ grp.calls.length }} calls
                            </span>
                            <span v-if="grp.calls.length === 1 && grp.calls[0].intent" class="font-medium text-zinc-800 dark:text-zinc-200 truncate text-[10.5px]">{{ grp.calls[0].intent }}</span>
                          </span>
                          <i v-if="grp.calls.length > 1" :data-lucide="isToolGroupExpanded(ti, gi) ? 'chevron-up' : 'chevron-down'" class="w-3 h-3 shrink-0 text-zinc-400"></i>
                        </button>

                        <!-- Calls: 2-col grid when several, single row otherwise -->
                        <div
                          v-show="isToolGroupExpanded(ti, gi)"
                          class="px-2 pb-2 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-1.5"
                          :class="grp.calls.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-1' : ''"
                        >
                          <div
                            v-for="(tc, ci) in grp.calls"
                            :key="ci"
                            class="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-900/90 rounded border border-zinc-200/60 dark:border-zinc-800/60 px-1.5 py-1 min-w-0"
                          >
                            <div v-if="tc.intent && grp.calls.length > 1" class="text-zinc-700 dark:text-zinc-300 font-semibold truncate mb-0.5">{{ tc.intent }}</div>
                            <div v-if="tc.input" class="text-zinc-500 dark:text-zinc-400 truncate select-all" :title="tc.input">{{ tc.input }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Text content (Markdown Rendered with Code Highlight Styling) -->
                  <div v-if="turn.content" class="chat-markdown markdown-body text-xs leading-relaxed select-text" :class="turn.role === 'user' ? 'text-white' : 'text-zinc-800 dark:text-zinc-100'" v-html="renderMarkdown(turn.content)"></div>

                  <div v-if="turn.test_verdict" class="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] flex items-center justify-between">
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

          <!-- Chat input: append an operator turn to this run -->
          <div class="border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-2 shrink-0">
            <div v-if="!selectedSession" class="text-[11px] text-zinc-400 italic text-center py-1">
              Select a run to chat with it.
            </div>
            <div v-else class="flex items-end gap-2">
              <textarea
                v-model="chatDraft"
                @keydown="onChatKeydown"
                :disabled="isSending"
                rows="1"
                placeholder="Message this run…  (Enter to send · Shift+Enter for newline)"
                class="flex-1 px-2.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 resize-none max-h-32 disabled:opacity-60"
              ></textarea>
              <button
                @click="sendMessage"
                :disabled="isSending || !chatDraft.trim()"
                class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
                title="Send message to this run"
              >
                <i :data-lucide="isSending ? 'loader' : 'send'" class="w-3.5 h-3.5" :class="isSending ? 'animate-spin' : ''"></i>
                <span>{{ isSending ? 'Sending' : 'Send' }}</span>
              </button>
            </div>
            <div v-if="sendError" class="text-[10px] text-red-600 dark:text-red-400 font-mono mt-1">✗ {{ sendError }}</div>
            <div v-else-if="sessionSuccessMsg" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">✓ {{ sessionSuccessMsg }}</div>
          </div>
        </div>

        <!-- TAB 2: Terminal / Logs -->
        <div v-else-if="activeTab === 'terminal'" class="flex-1 flex flex-col min-h-0 bg-[#09090b] text-zinc-200 p-3 font-mono text-xs overflow-y-auto">
          <div v-if="!selectedSession || !selectedSession.log_tail" class="text-zinc-500 italic p-6 text-center">
            No terminal stdout/stderr captured yet for this session.
          </div>
          <pre v-else class="whitespace-pre-wrap leading-relaxed text-zinc-300 select-text">{{ selectedSession.log_tail }}</pre>
        </div>

        <!-- TAB 3: Git Diff (real per-line red/green) -->
        <div v-else-if="activeTab === 'diff'" class="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 overflow-y-auto">
          <div v-if="!selectedSession || (!selectedDiff && (!selectedSession.files_touched || !selectedSession.files_touched.length))" class="text-zinc-400 italic p-6 text-center text-xs">
            No git file modifications recorded for this session.
          </div>
          <div v-else class="p-3 space-y-2">
            <div v-if="selectedSession.files_touched && selectedSession.files_touched.length" class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
              <span class="font-bold text-zinc-700 dark:text-zinc-300">Files Touched:</span>
              <ul class="list-disc list-inside mt-1 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                <li v-for="f in selectedSession.files_touched" :key="f" class="truncate">{{ f }}</li>
              </ul>
            </div>

            <div v-if="selectedDiff" class="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div class="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span class="font-mono text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">Unified diff</span>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px]">
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">+{{ diffStats.added }}</span>
                    <span class="text-red-600 dark:text-red-400 font-semibold ml-1.5">-{{ diffStats.removed }}</span>
                  </span>
                  <button
                    @click="expandedDiff = !expandedDiff"
                    class="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {{ expandedDiff ? 'collapse' : 'expand' }}
                  </button>
                </div>
              </div>
              <div class="overflow-x-auto bg-zinc-950" :class="expandedDiff ? '' : 'max-h-96 overflow-y-auto'">
                <pre class="font-mono text-[11px] leading-[1.45] select-text"><code><span
                  v-for="(ln, li) in diffLines(selectedDiff)"
                  :key="li"
                  class="block px-2 whitespace-pre"
                  :class="diffLineClass(ln.type)"
                >{{ ln.text || ' ' }}</span></code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 4: Telemetry -->
        <div v-else-if="activeTab === 'runs'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30 text-xs">
          <div v-if="selectedSession" class="space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">PID</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{{ selectedSession.pid || '—' }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Model</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" :title="selectedSession.model">{{ selectedSession.model || '—' }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Tokens</div>
                <div class="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{{ fmtTokens(tokenCount(selectedSession)) }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] text-zinc-400 font-semibold uppercase">Status</div>
                <div class="text-sm font-mono font-bold mt-0.5 truncate" :class="selectedSession.status === 'running' || selectedSession.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'">{{ selectedSession.status || '—' }}</div>
              </div>
            </div>

            <details class="rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 overflow-hidden" open>
              <summary class="px-3 py-2 cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 select-none">
                Run details
              </summary>
              <div class="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
                <div class="flex justify-between gap-2"><span class="text-zinc-400">session</span><span class="truncate text-zinc-700 dark:text-zinc-300" :title="selectedSession.session_id">{{ selectedSession.session_id || selectedSession.id }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">agent</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ selectedSession.agent_name || '—' }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">runtime</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ selectedSession.runtime || '—' }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">branch</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ selectedSession.git_branch || '—' }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">workdir</span><span class="truncate text-zinc-700 dark:text-zinc-300" :title="selectedSession.working_dir">{{ selectedSession.working_dir || '—' }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">commit</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ (selectedSession.git_commit_after || selectedSession.git_commit || '—').slice(0, 10) }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">updated</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ fmtTime(selectedSession.updated || selectedSession.created) }}</span></div>
                <div class="flex justify-between gap-2"><span class="text-zinc-400">messages</span><span class="truncate text-zinc-700 dark:text-zinc-300">{{ selectedSession.message_count || chatTurns.length }}</span></div>
              </div>
            </details>

            <details v-if="selectedSession.todos && selectedSession.todos.length" class="rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 overflow-hidden" open>
              <summary class="px-3 py-2 cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 select-none">
                Todos ({{ selectedSession.todos.length }})
              </summary>
              <ul class="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/60 space-y-1">
                <li v-for="(td, i) in selectedSession.todos" :key="i" class="flex items-start gap-2 text-[11px]">
                  <span class="shrink-0 font-mono">{{ td.status === 'completed' ? '✅' : (td.status === 'in_progress' ? '🔄' : '⬜') }}</span>
                  <span class="text-zinc-700 dark:text-zinc-300" :class="td.status === 'completed' ? 'line-through opacity-60' : ''">{{ td.content || td.title || td }}</span>
                </li>
              </ul>
            </details>

            <details v-if="selectedSession.test_verdict" class="rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <summary class="px-3 py-2 cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 select-none">
                Test verdict
              </summary>
              <pre class="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/60 font-mono text-[11px] text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{{ JSON.stringify(selectedSession.test_verdict, null, 2) }}</pre>
            </details>
          </div>

          <div v-else class="text-zinc-400 italic p-6 text-center">
            Select a run to inspect its telemetry.
          </div>
        </div>
      </section>
    </div>
  `,
};
