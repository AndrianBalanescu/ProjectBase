// pb_public/js/components/AgentsView.js
// Multica 2.0: Native Chat & Command Center.
// SMS-style chat with user messages right-aligned (avatar right), assistant
// left-aligned, low-saturation cursive reasoning blocks, compact grouped masonry
// tool cards, session stats header widget, and 1-click session continuation.

const AgentsViewComponent = {
  props: ['agents', 'sessions', 'activeAgentName', 'agentSource'],
  emits: ['navigate', 'sync-agents', 'open-new-issue'],
  data() {
    return {
      selectedSessionId: null,
      search: '',
      filterStatus: 'all', // 'all' | 'online'
      activeTab: 'chat', // 'chat' | 'anomalies' | 'throughput' | 'federation'
      quickPrompt: '',
      isDispatching: false,
      dispatchSuccess: null,
      liveStreamActive: true,
      pollTimer: null,
      showTools: true, // expand grouped tool cards
      expandedMessage: null, // assistant message id whose reasoning is expanded
      anomaliesReport: null,
      isHealing: false,
      healSuccess: null,
      throughputMetrics: null,
      federationExportJson: '',
      federationImportJson: '',
      federationConflictStrategy: 'merge',
      federationStatus: null
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
    // The sanitized chat turns for the selected session (or a fallback).
    chatTurns() {
      const s = this.selectedSession;
      if (s && s.chat && s.chat.length > 0) return s.chat;
      // Fallback: derive from live_activity for sessions without a chat stream.
      if (s && s.live_activity && s.live_activity.length > 0) {
        return s.live_activity.map(ev => ({
          role: 'assistant',
          content: ev.intent || (ev.type === 'text' ? ev.summary : '') || '',
          reasoning: ev.type === 'reasoning' ? ev.summary : '',
          tools: ev.type === 'tool' ? [{ name: ev.name, input: ev.input, intent: ev.intent }] : [],
          timestamp: ev.timestamp
        }));
      }
      return [];
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
    this.loadAnomalies();
    this.loadThroughput();
    // Live streaming poll: refresh telemetry every 3.5 seconds.
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
      if (name.includes('read') || name.includes('grep') || name.includes('find') || name.includes('ls') || name.includes('agentgrep')) {
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60';
      }
      if (name.includes('bash') || name.includes('cmd') || name.includes('exec')) {
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60';
      }
      if (name.includes('web') || name.includes('search') || name.includes('fetch')) {
        return 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/60';
      }
      if (name.includes('mcp') || name.includes('todo') || name.includes('goal')) {
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60';
      }
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
    },
    toolIcon(name) {
      if (!name) return 'terminal';
      if (name.includes('edit') || name.includes('write') || name.includes('patch')) return 'file-edit';
      if (name.includes('read') || name.includes('grep') || name.includes('find') || name.includes('ls') || name.includes('agentgrep')) return 'file-search';
      if (name.includes('bash') || name.includes('cmd') || name.includes('exec')) return 'terminal';
      if (name.includes('web') || name.includes('search') || name.includes('fetch')) return 'globe';
      if (name.includes('mcp')) return 'plug';
      if (name.includes('todo') || name.includes('goal')) return 'list-checks';
      return 'wrench';
    },
    // Group consecutive same-tool invocations into a single compact card.
    groupTools(tools) {
      if (!tools || tools.length === 0) return [];
      const groups = [];
      for (const t of tools) {
        const last = groups[groups.length - 1];
        if (last && last.name === t.name) {
          last.count++;
          if (!last.inputs.includes(t.input)) last.inputs.push(t.input);
        } else {
          groups.push({
            name: t.name,
            count: 1,
            intent: t.intent,
            inputs: t.input ? [t.input] : [],
            lastInput: t.input
          });
        }
      }
      return groups;
    },
    // Toggle expansion of a message's reasoning.
    toggleReasoning(idx) {
      this.expandedMessage = this.expandedMessage === idx ? null : idx;
    },
    createTicketFromSession(session) {
      if (!session) return;
      this.$emit('open-new-issue', {
        title: session.intention ? session.intention.slice(0, 100) : (session.title || 'Task from session ' + session.short_name),
        description: `### Originating Session\n- **Agent:** \`${session.agent}\`\n- **Session:** \`${session.short_name || session.id}\`\n- **Model:** \`${session.model}\`\n- **CWD:** \`${session.working_dir}\`\n\n### Intent\n${session.intention || 'No explicit intent specified.'}\n\n### Relevant Files\n${(session.files_touched || []).map(f => '- `' + f + '`').join('\n') || '- None'}`
      });
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
        this.dispatchSuccess = `Sent to ${target}`;
        this.quickPrompt = '';
        setTimeout(() => { this.dispatchSuccess = null; }, 3000);
        this.$emit('sync-agents');
      } catch (e) {
        console.error('Quick dispatch failed', e);
      } finally {
        this.isDispatching = false;
      }
    },
    async loadAnomalies() {
      try {
        const res = await API.getAnomalies();
        this.anomaliesReport = res;
      } catch (e) {
        console.warn('Failed to load anomalies', e);
      }
    },
    async triggerAutoHeal() {
      this.isHealing = true;
      this.healSuccess = null;
      try {
        const res = await API.getAnomalies({ autoHeal: true });
        this.anomaliesReport = res;
        this.healSuccess = `Auto-healed ${res.healed_count || 0} issues`;
        setTimeout(() => { this.healSuccess = null; }, 4000);
        this.$emit('sync-agents');
      } catch (e) {
        console.error('Auto-heal error', e);
      } finally {
        this.isHealing = false;
      }
    },
    async loadThroughput() {
      try {
        const res = await API.getThroughputAnalytics();
        this.throughputMetrics = res;
      } catch (e) {
        console.warn('Failed to load throughput', e);
      }
    },
    async exportFederationBundle() {
      try {
        this.federationStatus = 'Exporting...';
        const res = await API.exportFederation();
        this.federationExportJson = JSON.stringify(res, null, 2);
        this.federationStatus = 'Export ready (' + (res.manifest?.issues_count || 0) + ' issues)';
      } catch (e) {
        this.federationStatus = 'Export failed: ' + (e.message || String(e));
      }
    },
    async importFederationBundle() {
      try {
        if (!this.federationImportJson.trim()) return;
        this.federationStatus = 'Importing...';
        const parsed = JSON.parse(this.federationImportJson);
        const res = await API.importFederation(parsed, { conflictStrategy: this.federationConflictStrategy });
        this.federationStatus = `Imported: ${res.stats?.issues_created || 0} created, ${res.stats?.issues_updated || 0} updated`;
        this.federationImportJson = '';
        this.$emit('sync-agents');
      } catch (e) {
        this.federationStatus = 'Import failed: ' + (e.message || String(e));
      }
    },
    toggleReasoning(idx) {
      this.expandedMessage = (this.expandedMessage === idx ? null : idx);
    }
  },
  template: `
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-2 gap-2 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-200 overflow-hidden select-none">

      <!-- ========================================================= -->
      <!-- PANE 1: LEFT AGENT TABS SIDEBAR (COMPACT)                 -->
      <!-- ========================================================= -->
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
            >All ({{ (agents || []).length }})</button>
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

        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <button
            @click="selectAgent(null)"
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors"
            :class="!activeAgentName ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm">🌐</span>
              <span class="truncate">Workspace Fleet</span>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/60 text-[10px] font-mono">{{ totalSessions }}</span>
          </button>

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
                <div class="text-[10px] font-mono text-zinc-400 truncate">{{ agent.provider }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-1.5 shrink-0">
              <span v-if="agent.session_count" class="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/60 text-[10px] font-mono">{{ agent.session_count }}</span>
              <span class="w-2 h-2 rounded-full" :class="statusDot(agent.status)" :title="agent.status"></span>
            </div>
          </button>
        </div>

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
      <!-- PANE 2: NATIVE CHAT & COMMAND CENTER                      -->
      <!-- ========================================================= -->
      <section class="flex-1 flex flex-col bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs min-w-0">

        <!-- Header with Tabs and Stats -->
        <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="text-xl shrink-0">{{ selectedSession ? (selectedSession.avatar || '🧠') : '🤖' }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 capitalize truncate">
                  {{ activeTab === 'anomalies' ? 'Workflow Health & Auto-Heal' : (activeTab === 'throughput' ? 'Persona Throughput & MTTC' : (activeTab === 'federation' ? 'Multi-Host Federation Sync' : (selectedSession ? (selectedSession.short_name || 'Session') : 'Agent Command Center'))) }}
                </h2>
                <span v-if="selectedSession && selectedSession.is_active && activeTab === 'chat'" class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Streaming
                </span>
              </div>
              <!-- Tab Switcher -->
              <div class="flex items-center gap-1 mt-1">
                <button
                  @click="activeTab = 'chat'"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
                  :class="activeTab === 'chat' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >💬 Chat Stream</button>
                <button
                  @click="activeTab = 'anomalies'; loadAnomalies();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'anomalies' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >
                  <span>🩺 Diagnostics</span>
                  <span v-if="anomaliesReport && anomaliesReport.total_anomalies > 0" class="px-1 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                    {{ anomaliesReport.total_anomalies }}
                  </span>
                </button>
                <button
                  @click="activeTab = 'throughput'; loadThroughput();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
                  :class="activeTab === 'throughput' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >📊 MTTC Analytics</button>
                <button
                  @click="activeTab = 'federation'"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
                  :class="activeTab === 'federation' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🌐 Federation</button>
              </div>
            </div>
          </div>

          <!-- Compact Session Stats Widget -->
          <div v-if="selectedSession" class="flex items-center gap-1.5 flex-wrap">
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Model">
              <span class="text-zinc-400">🧠</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ selectedSession.model || 'prime' }}</span>
            </div>
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Messages">
              <span class="text-zinc-400">💬</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ selectedSession.message_count || 0 }}</span>
            </div>
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Tool calls">
              <span class="text-zinc-400">🔧</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ (selectedSession.recent_tools || []).length }}</span>
            </div>
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Prompt tokens">
              <span class="text-zinc-400">⬆</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ fmtTokens(selectedSession.token_usage && selectedSession.token_usage.prompt) }}</span>
            </div>
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Completion tokens">
              <span class="text-zinc-400">⬇</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ fmtTokens(selectedSession.token_usage && selectedSession.token_usage.completion) }}</span>
            </div>
            <div class="px-2 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono flex items-center gap-1" title="Total tokens">
              <span class="text-zinc-400">∑</span>
              <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ fmtTokens(selectedSession.token_usage && selectedSession.token_usage.total) }}</span>
            </div>
            <button
              @click="createTicketFromSession(selectedSession)"
              class="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-semibold transition-colors flex items-center space-x-1"
              title="Create a tracked ProjectBase issue from this session"
            >
              <i data-lucide="tag" class="w-3 h-3"></i>
              <span>Create Ticket</span>
            </button>
          </div>
        </div>

        <!-- Tab View 1: Native Chat Message Stream -->
        <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div v-if="!selectedSession" class="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs space-y-2">
              <i data-lucide="message-square" class="w-10 h-10 opacity-30"></i>
              <p class="font-semibold text-zinc-600 dark:text-zinc-400">Select a session to view its live chat</p>
              <p class="max-w-xs text-zinc-400">Start a session in flomaster or dispatch a task from any Kanban issue.</p>
            </div>

            <div v-else-if="chatTurns.length === 0" class="py-16 text-center text-zinc-400 text-xs italic">
              No chat messages recorded yet. Live reasoning and tools will stream here as the agent works.
            </div>

            <!-- Message Bubbles -->
            <div v-else class="space-y-3">
              <div
                v-for="(turn, idx) in chatTurns"
                :key="idx"
                class="flex items-end gap-2"
                :class="turn.role === 'user' ? 'justify-end flex-row-reverse' : 'justify-start'"
              >
                <!-- Avatar (right for user, left for assistant) -->
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0"
                  :class="turn.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-950/60 order-2' : 'bg-zinc-200 dark:bg-zinc-800 order-1'">
                  {{ turn.role === 'user' ? '🧑' : (selectedSession.avatar || '🧠') }}
                </span>

                <!-- Bubble Body -->
                <div
                  class="max-w-[80%] rounded-2xl px-3 py-2 shadow-2xs text-xs leading-relaxed space-y-2 min-w-0"
                  :class="turn.role === 'user'
                    ? 'bg-indigo-500/90 text-white dark:bg-indigo-600/90 rounded-br-sm'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm'"
                >
                  <!-- User message content -->
                  <div v-if="turn.role === 'user' && turn.content" class="whitespace-pre-wrap break-words">
                    {{ turn.content }}
                  </div>

                  <!-- Assistant content blocks -->
                  <template v-if="turn.role === 'assistant'">
                    <!-- Reasoning: low-saturation, cursive, collapsible -->
                    <div v-if="turn.reasoning" class="space-y-1">
                      <button
                        @click="toggleReasoning(idx)"
                        class="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 hover:underline"
                      >
                        <span class="italic font-serif text-zinc-400">💭 thought</span>
                        <span class="text-zinc-300 dark:text-zinc-600">{{ expandedMessage === idx ? '▾' : '▸' }}</span>
                      </button>
                      <p
                        v-if="expandedMessage === idx"
                        class="text-[11px] italic font-serif text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap select-text"
                      >
                        {{ turn.reasoning }}
                      </p>
                      <p v-else class="text-[11px] italic font-serif text-zinc-400 dark:text-zinc-500 leading-relaxed truncate select-text">
                        {{ turn.reasoning }}
                      </p>
                    </div>

                    <!-- Assistant text -->
                    <div v-if="turn.content" class="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words select-text">
                      {{ turn.content }}
                    </div>

                    <!-- Grouped masonry tool cards -->
                    <div v-if="turn.tools && turn.tools.length > 0" class="pt-1">
                      <div class="flex flex-wrap gap-1.5">
                        <div
                          v-for="(g, gi) in groupTools(turn.tools)"
                          :key="gi"
                          class="px-2 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5"
                          :class="toolColor(g.name)"
                          :title="g.inputs.join(' · ')"
                        >
                          <i :data-lucide="toolIcon(g.name)" class="w-3 h-3 shrink-0"></i>
                          <span class="font-bold">{{ g.name }}</span>
                          <span v-if="g.count > 1" class="px-1 rounded bg-white/40 dark:bg-black/20 font-bold">×{{ g.count }}</span>
                          <span v-if="g.intent" class="truncate max-w-[120px] text-[9px] opacity-80">{{ g.intent }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Interactive Chat Prompt / Continuation Bar -->
          <div class="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
            <div class="flex items-end space-x-2">
              <textarea
                v-model="quickPrompt"
                @keydown.enter.exact.prevent="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
                rows="1"
                :placeholder="selectedSession ? ('Send a follow-up to ' + (selectedSession.short_name || 'session') + '…') : 'Dispatch instruction to agent…'"
                class="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
              ></textarea>
              <button
                @click="quickDispatch(activeAgent ? activeAgent.name : 'flomaster')"
                :disabled="isDispatching || !quickPrompt.trim()"
                class="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50 shadow-2xs shrink-0"
              >
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                <span>{{ isDispatching ? 'Sending…' : (selectedSession ? 'Continue Session' : 'Dispatch') }}</span>
              </button>
            </div>
            <div v-if="dispatchSuccess" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">✓ {{ dispatchSuccess }}</div>
          </div>
        </div>

        <!-- Tab View 2: Workflow Health & Anomaly Diagnostics -->
        <div v-else-if="activeTab === 'anomalies'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Autonomous Workflow Diagnostics</h3>
              <p class="text-[11px] text-zinc-500">Detects expired task leases, rapid failure loops, circular locks & starvation</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="loadAnomalies"
                class="px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >Refresh</button>
              <button
                @click="triggerAutoHeal"
                :disabled="isHealing"
                class="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>⚡ Run Auto-Heal</span>
              </button>
            </div>
          </div>

          <div v-if="healSuccess" class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            ✓ {{ healSuccess }}
          </div>

          <div v-if="anomaliesReport" class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] uppercase font-mono text-zinc-400">Total Anomalies</div>
                <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100">{{ anomaliesReport.total_anomalies || 0 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] uppercase font-mono text-rose-500 font-bold">Critical</div>
                <div class="text-lg font-bold text-rose-600">{{ anomaliesReport.critical_count || 0 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] uppercase font-mono text-amber-500 font-bold">Warnings</div>
                <div class="text-lg font-bold text-amber-600">{{ anomaliesReport.warning_count || 0 }}</div>
              </div>
            </div>

            <div v-if="!anomaliesReport.anomalies || anomaliesReport.anomalies.length === 0" class="py-12 text-center text-xs text-zinc-400">
              ✓ All agent leases and workflow DAGs are healthy. Zero anomalies detected.
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(an, ai) in anomaliesReport.anomalies"
                :key="ai"
                class="p-3 rounded-xl bg-white dark:bg-zinc-900 border text-xs space-y-1"
                :class="an.severity === 'critical' ? 'border-rose-300 dark:border-rose-900/60' : 'border-amber-300 dark:border-amber-900/60'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ an.type }}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                    :class="an.severity === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'">
                    {{ an.severity }}
                  </span>
                </div>
                <p class="text-zinc-600 dark:text-zinc-400">{{ an.reason }}</p>
                <div v-if="an.issue_ref" class="text-[10px] font-mono text-indigo-500">Target: {{ an.issue_ref }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab View 3: Persona Throughput & MTTC Analytics -->
        <div v-else-if="activeTab === 'throughput'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Agent Persona Performance & MTTC</h3>
              <p class="text-[11px] text-zinc-500">Cycle times, validation pass rates, and completion velocity</p>
            </div>
            <button @click="loadThroughput" class="px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Refresh</button>
          </div>

          <div v-if="throughputMetrics" class="space-y-4">
            <div class="grid grid-cols-4 gap-3">
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] font-mono uppercase text-zinc-400">Completed (Window)</div>
                <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100">{{ throughputMetrics.completed_in_window || 0 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] font-mono uppercase text-zinc-400">Velocity / Day</div>
                <div class="text-lg font-bold text-indigo-600">{{ throughputMetrics.velocity_issues_per_day || 0 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] font-mono uppercase text-zinc-400">Weekly Forecast</div>
                <div class="text-lg font-bold text-emerald-600">{{ throughputMetrics.forecast ? throughputMetrics.forecast.projected_weekly_throughput : 0 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div class="text-[10px] font-mono uppercase text-zinc-400">Telemetry Events</div>
                <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100">{{ throughputMetrics.telemetry_events_in_window || 0 }}</div>
              </div>
            </div>

            <!-- Personas Cards -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-500">Persona Breakdown</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  v-for="(p, pi) in (throughputMetrics.persona_breakdown || [])"
                  :key="pi"
                  class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-zinc-900 dark:text-zinc-100 capitalize">{{ p.persona }}</span>
                    <span class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">MTTC: {{ p.mttc_minutes || 0 }}m</span>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Assigned: {{ p.total }}</span>
                    <span>Completed: {{ p.completed }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab View 4: Multi-Host Federation Sync -->
        <div v-else-if="activeTab === 'federation'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Multi-Host Federation Bridge</h3>
            <p class="text-[11px] text-zinc-500">Export or import portable workspace packages with SHA-256 integrity verification</p>
          </div>

          <div v-if="federationStatus" class="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono">
            {{ federationStatus }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Export Card -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Export Federation Bundle</h4>
              <p class="text-[11px] text-zinc-500">Generates a full snapshot of projects, issues, relations, checkpoints & telemetry.</p>
              <button
                @click="exportFederationBundle"
                class="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold"
              >Export Bundle</button>
              <textarea
                v-if="federationExportJson"
                readonly
                v-model="federationExportJson"
                rows="6"
                class="w-full p-2 text-[10px] font-mono rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 resize-none select-all"
              ></textarea>
            </div>

            <!-- Import Card -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Import Federation Bundle</h4>
              <div class="flex items-center gap-2">
                <label class="text-[11px] text-zinc-500">Conflict Strategy:</label>
                <select
                  v-model="federationConflictStrategy"
                  class="px-2 py-1 text-xs rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="merge">Merge</option>
                  <option value="overwrite">Overwrite</option>
                  <option value="skip_existing">Skip Existing</option>
                </select>
              </div>
              <textarea
                v-model="federationImportJson"
                rows="6"
                placeholder="Paste federation bundle JSON here..."
                class="w-full p-2 text-[10px] font-mono rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 resize-none"
              ></textarea>
              <button
                @click="importFederationBundle"
                :disabled="!federationImportJson.trim()"
                class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >Import Bundle</button>
            </div>
          </div>
        </div>

      </section>
    </div>
  `
};
