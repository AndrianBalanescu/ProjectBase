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
      activeTab: 'chat', // 'chat' | 'workload' | 'anomalies' | 'throughput' | 'federation'
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
      federationStatus: null,
      workloadData: null,
      autoscalePlan: null,
      isAutoscaling: false,
      autoscaleSuccess: null,
      benchmarksData: null,
      isLoadingBenchmarks: false,
      selfHealReport: null,
      clusterNodes: [],
      clusterState: null,
      failoverHistory: [],
      newNodeId: '',
      newNodeName: '',
      newNodeRole: 'replica',
      newNodeEndpoint: '',
      newNodeRegion: 'homelab',
      clusterSuccessMsg: null,
      clusterErrorMsg: null,
      isSyncingCluster: false,
      webhookEndpoints: [],
      webhookDeliveries: [],
      webhookDlq: [],
      newWebhookName: '',
      newWebhookUrl: '',
      newWebhookPlatform: 'slack',
      newWebhookEvents: 'issue.*, agent.*',
      newWebhookSecret: '',
      testEventName: 'issue.created',
      testPayloadTitle: 'Verify Webhook Security Gateway',
      webhookSuccessMsg: null,
      webhookErrorMsg: null,
      isDispatchingWebhook: false,
      dlqRetrying: false,
      transformPreview: null,
      previewPlatform: 'slack',
      sdkLanguages: [],
      selectedSdkLang: 'python',
      sdkTargetEndpoint: '/api/collections/issues/records',
      sdkTargetTool: '',
      generatedSdkCode: '',
      sdkCopied: false,
      observabilityMetrics: null,
      observabilityAlerts: [],
      observabilityEvents: [],
      newAlertName: 'High Error Rate Alert',
      newAlertMetric: 'error_rate_pct',
      newAlertOperator: 'gt',
      newAlertThreshold: 5.0,
      newAlertChannel: 'agent-coordinator',
      newAlertChannelType: 'agent',
      alertSuccessMsg: null,
      alertErrorMsg: null,
      isEvaluatingAlerts: false,
      integrationRecipes: [],
      selectedRecipe: null,
      isLoadingObservability: false,
      consensusGates: [],
      consensusMetrics: null,
      selectedConsensusGate: null,
      gateBallots: [],
      isLoadingConsensus: false,
      isStartingDebate: false,
      isEvaluatingGate: false,
      consensusSuccessMsg: null,
      consensusErrorMsg: null,
      newGateIssueId: '',
      newGateTargetType: 'pull_request',
      newGateTitle: '',
      newGateScope: 'Multi-Model Release Consensus Review',
      newGateQuorum: 4,
      newGateMinConfidence: 0.85,
      newGateAutoTransition: true,
      manualBallotModel: 'claude-3-7-sonnet',
      manualBallotPersona: 'SecurityAuditor',
      manualBallotVote: 'approve',
      manualBallotConfidence: 0.95,
      manualBallotReason: 'Verified architecture rules, authentication headers and test coverage.',
      ssoProviders: [],
      ssoLoading: false,
      ssoSelectedProvider: null,
      newSsoProviderKey: 'google',
      newSsoName: '',
      newSsoIssuerUrl: '',
      newSsoClientId: '',
      newSsoClientSecret: '',
      newSsoDiscoveryUrl: '',
      newSsoScopes: 'openid profile email',
      newSsoJit: true,
      newSsoDefaultRole: 'member',
      ssoSuccessMsg: null,
      ssoErrorMsg: null,
      ssoTestEmail: 'federated_dev@example.com',
      ssoTestName: 'Federated Dev User',
      ssoTestResult: null,
      isTestingSso: false,
      rbacRoles: [],
      rbacMatrix: [],
      rbacAssignments: [],
      rbacAuditLogs: [],
      rbacAuditFilter: '',
      selectedRbacRole: null,
      testRbacActor: 'flomaster-autonomous-agent',
      testRbacCap: 'issues:create',
      testRbacResult: null,
      isCheckingRbac: false,
      newRoleKey: '',
      newRoleName: '',
      newRoleDesc: '',
      newRoleCapsStr: 'issues:read, issues:create, agents:dispatch',
      newAssignUser: '',
      newAssignRole: 'member',
      newAssignProject: 'all',
      rbacSuccessMsg: null,
      rbacErrorMsg: null,
      isLoadingSsoRbac: false
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
    async loadWorkload() {
      try {
        const res = await API.getAgentWorkload();
        this.workloadData = res;
      } catch (e) {
        console.warn('Failed to load workload', e);
      }
    },
    async runAutoscale(apply = false) {
      try {
        this.isAutoscaling = true;
        this.autoscaleSuccess = null;
        const res = await API.calculateAutoscale({ apply });
        this.autoscalePlan = res;
        if (apply) {
          this.autoscaleSuccess = `Applied autoscaling plan: target ${res.total_recommended_workers} worker(s)`;
          await this.loadWorkload();
        }
      } catch (e) {
        this.autoscaleSuccess = 'Autoscale error: ' + (e.message || String(e));
      } finally {
        this.isAutoscaling = false;
      }
    },
    async runSelfHeal(autoFix = true) {
      try {
        this.isHealing = true;
        this.healSuccess = null;
        const res = await API.runWorkflowSelfHeal({ auto_fix: autoFix });
        this.selfHealReport = res;
        this.healSuccess = `Resolved ${res.repairs_applied || 0} / ${res.anomalies_detected || 0} issue(s)`;
        await this.loadWorkload();
      } catch (e) {
        this.healSuccess = 'Self-heal failed: ' + (e.message || String(e));
      } finally {
        this.isHealing = false;
      }
    },
    async loadLiveBenchmarks() {
      try {
        this.isLoadingBenchmarks = true;
        const res = await API.getLiveBenchmarks();
        this.benchmarksData = res;
      } catch (e) {
        console.warn('Failed to load benchmarks', e);
      } finally {
        this.isLoadingBenchmarks = false;
      }
    },
    toggleReasoning(idx) {
      this.expandedMessage = (this.expandedMessage === idx ? null : idx);
    },
    async loadClusterState() {
      try {
        const [nodesRes, failoverRes] = await Promise.all([
          API.getClusterNodes(),
          API.getClusterFailoverStatus()
        ]);
        this.clusterNodes = (nodesRes && nodesRes.nodes) || [];
        this.clusterState = (failoverRes && failoverRes.cluster) || (nodesRes && nodesRes.cluster) || null;
        this.failoverHistory = (failoverRes && failoverRes.failover_history) || [];
      } catch (e) {
        console.warn('Failed to load cluster state', e);
      }
    },
    async registerNewClusterNode() {
      if (!this.newNodeId.trim() || !this.newNodeEndpoint.trim()) {
        this.clusterErrorMsg = 'Node ID and Endpoint URL are required';
        return;
      }
      this.clusterErrorMsg = null;
      this.clusterSuccessMsg = null;
      try {
        const res = await API.registerClusterNode({
          node_id: this.newNodeId.trim(),
          node_name: this.newNodeName.trim() || this.newNodeId.trim(),
          role: this.newNodeRole,
          endpoint_url: this.newNodeEndpoint.trim(),
          region: this.newNodeRegion.trim()
        });
        this.clusterSuccessMsg = `Registered node ${(res.node && res.node.node_id) || this.newNodeId}`;
        this.newNodeId = '';
        this.newNodeName = '';
        this.newNodeEndpoint = '';
        await this.loadClusterState();
        setTimeout(() => { this.clusterSuccessMsg = null; }, 3000);
      } catch (e) {
        this.clusterErrorMsg = e.message || String(e);
      }
    },
    async decommissionClusterNode(nodeId) {
      if (!nodeId) return;
      try {
        await API.decommissionClusterNode(nodeId);
        this.clusterSuccessMsg = `Decommissioned node ${nodeId}`;
        await this.loadClusterState();
        setTimeout(() => { this.clusterSuccessMsg = null; }, 3000);
      } catch (e) {
        this.clusterErrorMsg = e.message || String(e);
      }
    },
    async promoteClusterNode(candidateId) {
      if (!candidateId) return;
      try {
        const res = await API.promoteClusterPrimary({ candidate_node_id: candidateId, reason: 'dashboard_switchover', force: true });
        this.clusterSuccessMsg = `Promoted ${candidateId} to primary (Term ${res.new_term})`;
        await this.loadClusterState();
        setTimeout(() => { this.clusterSuccessMsg = null; }, 3000);
      } catch (e) {
        this.clusterErrorMsg = e.message || String(e);
      }
    },
    async triggerClusterSync() {
      this.isSyncingCluster = true;
      this.clusterSuccessMsg = null;
      try {
        const pullRes = await API.pullClusterDeltas({ limit: 50 });
        this.clusterSuccessMsg = `Synced ${(pullRes && pullRes.deltas && pullRes.deltas.length) || 0} deltas across cluster`;
        await this.loadClusterState();
        setTimeout(() => { this.clusterSuccessMsg = null; }, 3000);
      } catch (e) {
        this.clusterErrorMsg = e.message || String(e);
      } finally {
        this.isSyncingCluster = false;
      }
    },
    async loadWebhookState() {
      try {
        const [epRes, delRes, dlqRes] = await Promise.all([
          API.listWebhookEndpoints(),
          API.listWebhookDeliveries({ limit: 25 }),
          API.getWebhookDlq()
        ]);
        this.webhookEndpoints = (epRes && epRes.endpoints) || [];
        this.webhookDeliveries = (delRes && delRes.deliveries) || [];
        this.webhookDlq = (dlqRes && dlqRes.dlq) || [];
      } catch (e) {
        console.warn('Failed to load webhook state', e);
      }
    },
    async createNewWebhookEndpoint() {
      if (!this.newWebhookName.trim() || !this.newWebhookUrl.trim()) {
        this.webhookErrorMsg = 'Endpoint Name and Destination URL are required';
        return;
      }
      this.webhookErrorMsg = null;
      this.webhookSuccessMsg = null;
      try {
        const eventsList = this.newWebhookEvents.split(',').map(s => s.trim()).filter(Boolean);
        const res = await API.registerWebhookEndpoint({
          name: this.newWebhookName.trim(),
          url: this.newWebhookUrl.trim(),
          platform: this.newWebhookPlatform,
          events: eventsList.length ? eventsList : ['*'],
          secret: this.newWebhookSecret.trim() || undefined
        });
        this.webhookSuccessMsg = `Registered webhook endpoint ${(res.endpoint && res.endpoint.name) || this.newWebhookName}`;
        this.newWebhookName = '';
        this.newWebhookUrl = '';
        this.newWebhookSecret = '';
        await this.loadWebhookState();
        setTimeout(() => { this.webhookSuccessMsg = null; }, 3000);
      } catch (e) {
        this.webhookErrorMsg = e.message || String(e);
      }
    },
    async removeWebhookEndpoint(id) {
      if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
      try {
        await API.deleteWebhookEndpoint(id);
        await this.loadWebhookState();
      } catch (e) {
        this.webhookErrorMsg = e.message || String(e);
      }
    },
    async testDispatchWebhook() {
      if (!this.testEventName.trim()) return;
      this.isDispatchingWebhook = true;
      this.webhookErrorMsg = null;
      this.webhookSuccessMsg = null;
      try {
        const res = await API.dispatchWebhookEvent({
          event: this.testEventName.trim(),
          payload: {
            title: this.testPayloadTitle.trim(),
            description: 'Triggered from ProjectBase Webhook Gateway & DLQ console',
            actor: 'System Admin / Flomaster',
            timestamp: new Date().toISOString()
          },
          simulate_network: true
        });
        this.webhookSuccessMsg = `Dispatched '${this.testEventName}' to ${res.dispatched_count || 0} endpoint(s)`;
        await this.loadWebhookState();
        setTimeout(() => { this.webhookSuccessMsg = null; }, 3000);
      } catch (e) {
        this.webhookErrorMsg = e.message || String(e);
      } finally {
        this.isDispatchingWebhook = false;
      }
    },
    async retryDlq(itemId) {
      this.dlqRetrying = true;
      try {
        await API.retryDlqMessage({ item_id: itemId || 'all' });
        await this.loadWebhookState();
      } catch (e) {
        this.webhookErrorMsg = e.message || String(e);
      } finally {
        this.dlqRetrying = false;
      }
    },
    async purgeDlq(itemId) {
      try {
        await API.purgeDlqMessage(itemId || 'all');
        await this.loadWebhookState();
      } catch (e) {
        this.webhookErrorMsg = e.message || String(e);
      }
    },
    async loadTransformPreview() {
      try {
        const res = await API.previewWebhookTransform({
          platform: this.previewPlatform,
          event: this.testEventName.trim() || 'issue.created',
          title: this.testPayloadTitle.trim() || 'Sample Event'
        });
        this.transformPreview = res;
      } catch (e) {
        console.warn('Transform preview failed', e);
      }
    },
    async loadObservabilityState() {
      this.isLoadingObservability = true;
      try {
        const [langRes, metricRes, alertRes, recipeRes] = await Promise.all([
          API.getSdkLanguages(),
          API.getObservabilityMetrics(),
          API.getObservabilityAlerts(),
          API.getIntegrationRecipes()
        ]);
        this.sdkLanguages = (langRes && langRes.languages) || [];
        this.observabilityMetrics = metricRes || null;
        this.observabilityAlerts = (alertRes && alertRes.configs) || [];
        this.observabilityEvents = (alertRes && alertRes.recent_events) || [];
        this.integrationRecipes = (recipeRes && recipeRes.recipes) || [];
        if (this.integrationRecipes.length > 0 && !this.selectedRecipe) {
          this.selectedRecipe = this.integrationRecipes[0];
        }
        await this.generateSdkSnippet();
      } catch (e) {
        console.warn('Failed to load observability state', e);
      } finally {
        this.isLoadingObservability = false;
      }
    },
    async generateSdkSnippet() {
      try {
        const res = await API.generateSdk({
          language: this.selectedSdkLang,
          target_endpoint: this.sdkTargetEndpoint,
          target_tool: this.sdkTargetTool,
          base_url: window.location.origin || 'http://127.0.0.1:8120'
        });
        this.generatedSdkCode = (res && res.code) || '';
        this.sdkCopied = false;
      } catch (e) {
        this.generatedSdkCode = '// Error generating snippet: ' + (e.message || String(e));
      }
    },
    copySdkSnippet() {
      if (!this.generatedSdkCode) return;
      navigator.clipboard.writeText(this.generatedSdkCode).then(() => {
        this.sdkCopied = true;
        setTimeout(() => { this.sdkCopied = false; }, 2000);
      });
    },
    async createObservabilityAlert() {
      this.alertErrorMsg = null;
      this.alertSuccessMsg = null;
      try {
        await API.configureObservabilityAlert({
          name: this.newAlertName,
          metric_name: this.newAlertMetric,
          comparison_operator: this.newAlertOperator,
          threshold_value: parseFloat(this.newAlertThreshold) || 5.0,
          alert_channel: this.newAlertChannel,
          channel_type: this.newAlertChannelType
        });
        this.alertSuccessMsg = 'Alert threshold rule created successfully';
        await this.loadObservabilityState();
        setTimeout(() => { this.alertSuccessMsg = null; }, 3000);
      } catch (e) {
        this.alertErrorMsg = e.message || String(e);
      }
    },
    async triggerAlertEvaluation() {
      this.isEvaluatingAlerts = true;
      this.alertSuccessMsg = null;
      this.alertErrorMsg = null;
      try {
        const res = await API.evaluateObservabilityAlerts();
        this.alertSuccessMsg = `Evaluation complete: ${(res && res.breaches_detected) || 0} breaches detected across ${(res && res.total_rules_evaluated) || 0} rules`;
        await this.loadObservabilityState();
        setTimeout(() => { this.alertSuccessMsg = null; }, 3000);
      } catch (e) {
        this.alertErrorMsg = e.message || String(e);
      } finally {
        this.isEvaluatingAlerts = false;
      }
    },
    async deleteAlertRule(id) {
      if (!confirm('Are you sure you want to delete this alert rule?')) return;
      try {
        await API.deleteObservabilityAlert(id);
        await this.loadObservabilityState();
      } catch (e) {
        console.warn('Failed to delete alert rule', e);
      }
    },
    async loadConsensusState() {
      this.isLoadingConsensus = true;
      try {
        const [gatesRes, metricsRes] = await Promise.all([
          API.getConsensusGates({ limit: 50 }),
          API.getConsensusMetrics()
        ]);
        this.consensusGates = (gatesRes && gatesRes.gates) || [];
        this.consensusMetrics = (metricsRes && metricsRes.metrics) || null;
        if (this.selectedConsensusGate) {
          const updated = this.consensusGates.find(g => g.id === this.selectedConsensusGate.id);
          if (updated) {
            await this.selectConsensusGate(updated);
          }
        } else if (this.consensusGates.length > 0) {
          await this.selectConsensusGate(this.consensusGates[0]);
        }
      } catch (e) {
        console.warn('Failed to load consensus state', e);
      } finally {
        this.isLoadingConsensus = false;
      }
    },
    async selectConsensusGate(gate) {
      this.selectedConsensusGate = gate;
      try {
        const details = await API.getConsensusGate(gate.id);
        this.gateBallots = (details && details.ballots) || [];
      } catch (e) {
        this.gateBallots = [];
      }
    },
    async createConsensusGate() {
      if (!this.newGateTitle && !this.newGateIssueId) {
        this.consensusErrorMsg = 'Please enter a Target Title or Issue ID';
        return;
      }
      try {
        await API.createConsensusGate({
          issue_id: this.newGateIssueId,
          target_type: this.newGateTargetType,
          target_title: this.newGateTitle || `Consensus Gate for ${this.newGateIssueId}`,
          scope: this.newGateScope,
          quorum_size: parseInt(this.newGateQuorum) || 4,
          min_confidence: parseFloat(this.newGateMinConfidence) || 0.85,
          auto_transition: this.newGateAutoTransition
        });
        this.consensusSuccessMsg = 'Consensus gate created successfully';
        this.newGateTitle = '';
        this.newGateIssueId = '';
        await this.loadConsensusState();
        setTimeout(() => { this.consensusSuccessMsg = null; }, 3000);
      } catch (e) {
        this.consensusErrorMsg = e.message || String(e);
      }
    },
    async deleteConsensusGate(id) {
      if (!confirm('Are you sure you want to delete this consensus gate?')) return;
      try {
        await API.deleteConsensusGate(id);
        this.selectedConsensusGate = null;
        this.gateBallots = [];
        await this.loadConsensusState();
      } catch (e) {
        console.warn('Failed to delete consensus gate', e);
      }
    },
    async triggerConsensusDebate(gate) {
      this.isStartingDebate = true;
      try {
        const res = await API.startConsensusDebate({
          gate_id: gate ? gate.id : undefined,
          issue_id: gate ? gate.issue_id : this.newGateIssueId,
          topic: gate ? gate.target_title : (this.newGateTitle || 'Multi-Model Consensus & Peer Review Debate'),
          scope: gate ? gate.scope : this.newGateScope,
          quorum_size: gate ? gate.quorum_size : 4
        });
        this.consensusSuccessMsg = `Consensus debate completed! Verdict: ${(res && res.debate && res.debate.evaluation && res.debate.evaluation.verdict) || 'APPROVED'}`;
        await this.loadConsensusState();
        setTimeout(() => { this.consensusSuccessMsg = null; }, 4000);
      } catch (e) {
        this.consensusErrorMsg = e.message || String(e);
      } finally {
        this.isStartingDebate = false;
      }
    },
    async triggerGateEvaluation(gateId) {
      this.isEvaluatingGate = true;
      try {
        const res = await API.evaluateConsensusGate({ gate_id: gateId });
        this.consensusSuccessMsg = `Gate evaluated! Verdict: ${(res && res.evaluation && res.evaluation.verdict) || 'APPROVED'}`;
        await this.loadConsensusState();
        setTimeout(() => { this.consensusSuccessMsg = null; }, 3000);
      } catch (e) {
        this.consensusErrorMsg = e.message || String(e);
      } finally {
        this.isEvaluatingGate = false;
      }
    },
    async submitManualBallot() {
      if (!this.selectedConsensusGate) return;
      try {
        await API.submitConsensusBallot({
          gate_id: this.selectedConsensusGate.id,
          model_name: this.manualBallotModel,
          persona: this.manualBallotPersona,
          vote: this.manualBallotVote,
          confidence: parseFloat(this.manualBallotConfidence) || 0.90,
          reasoning: this.manualBallotReason || 'Verified requirements and test suite.'
        });
        this.consensusSuccessMsg = 'Cryptographically signed ballot submitted!';
        await this.selectConsensusGate(this.selectedConsensusGate);
        await this.loadConsensusState();
        setTimeout(() => { this.consensusSuccessMsg = null; }, 3000);
      } catch (e) {
        this.consensusErrorMsg = e.message || String(e);
      }
    },
    async loadSsoRbacState() {
      this.isLoadingSsoRbac = true;
      try {
        const [provRes, rolesRes, matrixRes, assignRes, auditRes] = await Promise.all([
          API.getSsoProviders(),
          API.getRbacRoles(),
          API.getRbacMatrix(),
          API.getRbacAssignments(),
          API.getSecurityAuditLogs({ limit: 25 })
        ]);
        this.ssoProviders = (provRes && provRes.providers) || [];
        this.rbacRoles = (rolesRes && rolesRes.roles) || [];
        this.rbacMatrix = (matrixRes && matrixRes.matrix) || [];
        this.rbacAssignments = (assignRes && assignRes.assignments) || [];
        this.rbacAuditLogs = (auditRes && auditRes.audit_logs) || [];
      } catch (e) {
        console.warn('Failed to load SSO/RBAC state', e);
      } finally {
        this.isLoadingSsoRbac = false;
      }
    },
    async saveSsoProvider() {
      if (!this.newSsoProviderKey || !this.newSsoName) {
        this.ssoErrorMsg = 'Provider Key and Name are required';
        return;
      }
      try {
        await API.configureSsoProvider({
          provider_key: this.newSsoProviderKey,
          name: this.newSsoName,
          provider_type: 'oidc',
          issuer_url: this.newSsoIssuerUrl,
          client_id: this.newSsoClientId,
          client_secret: this.newSsoClientSecret,
          discovery_url: this.newSsoDiscoveryUrl,
          scopes: this.newSsoScopes,
          jit_provisioning: this.newSsoJit,
          default_role: this.newSsoDefaultRole,
          enabled: true
        });
        this.ssoSuccessMsg = `Provider '${this.newSsoName}' configured successfully!`;
        this.newSsoName = '';
        this.newSsoClientId = '';
        this.newSsoClientSecret = '';
        await this.loadSsoRbacState();
        setTimeout(() => { this.ssoSuccessMsg = null; }, 3000);
      } catch (e) {
        this.ssoErrorMsg = e.message || String(e);
      }
    },
    async deleteSsoProvider(id) {
      if (!confirm('Delete this SSO provider configuration?')) return;
      try {
        await API.deleteSsoProvider(id);
        await this.loadSsoRbacState();
      } catch (e) {
        this.ssoErrorMsg = e.message || String(e);
      }
    },
    async testSsoExchange(providerKey) {
      this.isTestingSso = true;
      this.ssoTestResult = null;
      try {
        const res = await API.exchangeSsoToken({
          provider_key: providerKey || 'google',
          email: this.ssoTestEmail,
          name: this.ssoTestName,
          role: 'member'
        });
        this.ssoTestResult = res;
      } catch (e) {
        this.ssoTestResult = { success: false, error: e.message || String(e) };
      } finally {
        this.isTestingSso = false;
      }
    },
    async createCustomRole() {
      if (!this.newRoleKey || !this.newRoleName) {
        this.rbacErrorMsg = 'Role key and name are required';
        return;
      }
      try {
        const caps = this.newRoleCapsStr.split(',').map(s => s.trim()).filter(Boolean);
        await API.createRbacRole({
          role_key: this.newRoleKey,
          name: this.newRoleName,
          description: this.newRoleDesc,
          capabilities: caps
        });
        this.rbacSuccessMsg = `Custom role '${this.newRoleName}' created successfully!`;
        this.newRoleKey = '';
        this.newRoleName = '';
        this.newRoleDesc = '';
        await this.loadSsoRbacState();
        setTimeout(() => { this.rbacSuccessMsg = null; }, 3000);
      } catch (e) {
        this.rbacErrorMsg = e.message || String(e);
      }
    },
    async deleteCustomRole(id) {
      if (!confirm('Delete this custom role?')) return;
      try {
        await API.deleteRbacRole(id);
        await this.loadSsoRbacState();
      } catch (e) {
        this.rbacErrorMsg = e.message || String(e);
      }
    },
    async assignUserRole() {
      if (!this.newAssignUser) {
        this.rbacErrorMsg = 'User ID or Agent ID is required';
        return;
      }
      try {
        await API.assignRbacRole({
          user_id: this.newAssignUser,
          role_key: this.newAssignRole,
          project_id: this.newAssignProject,
          user_type: this.newAssignUser.includes('agent') ? 'agent' : 'user'
        });
        this.rbacSuccessMsg = `Role '${this.newAssignRole}' assigned to '${this.newAssignUser}'!`;
        this.newAssignUser = '';
        await this.loadSsoRbacState();
        setTimeout(() => { this.rbacSuccessMsg = null; }, 3000);
      } catch (e) {
        this.rbacErrorMsg = e.message || String(e);
      }
    },
    async revokeUserRole(id) {
      if (!confirm('Revoke this role assignment?')) return;
      try {
        await API.revokeRbacAssignment(id);
        await this.loadSsoRbacState();
      } catch (e) {
        this.rbacErrorMsg = e.message || String(e);
      }
    },
    async checkPermissionTest() {
      if (!this.testRbacActor || !this.testRbacCap) return;
      this.isCheckingRbac = true;
      this.testRbacResult = null;
      try {
        const res = await API.checkRbacPermission({
          actor_id: this.testRbacActor,
          capability: this.testRbacCap,
          project_id: 'all'
        });
        this.testRbacResult = res;
      } catch (e) {
        this.testRbacResult = { allowed: false, reason: e.message || String(e) };
      } finally {
        this.isCheckingRbac = false;
      }
    },
    async exportAuditLogs(fmt) {
      try {
        const res = await API.exportSecurityAuditLogs({ format: fmt });
        if (fmt === 'csv' && res && res.data) {
          const blob = new Blob([res.data], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `projectbase_security_audit_${Date.now()}.csv`;
          a.click();
        } else {
          alert(`Exported ${(res && res.record_count) || 0} audit log entries.`);
        }
      } catch (e) {
        alert('Export failed: ' + (e.message || String(e)));
      }
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
                  {{ activeTab === 'workload' ? 'Workload & Dynamic Autoscaler' : (activeTab === 'anomalies' ? 'Workflow Health & Auto-Heal' : (activeTab === 'throughput' ? 'Persona Throughput & MTTC' : (activeTab === 'federation' ? 'Multi-Host Federation Sync' : (activeTab === 'cluster' ? 'Distributed Cluster & Edge Sync' : (activeTab === 'webhooks' ? 'Outbound Webhook Security Gateway & DLQ' : (activeTab === 'observability' ? 'OpenAPI SDK Generator & Webhook Observability' : (activeTab === 'consensus' ? 'Autonomous Multi-Model Consensus & Peer Review Gate Engine' : (activeTab === 'sso_rbac' ? 'Enterprise SSO Federation & Granular RBAC Matrix' : (selectedSession ? (selectedSession.short_name || 'Session') : 'Agent Command Center'))))))))) }}
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
                  @click="activeTab = 'workload'; loadWorkload(); loadLiveBenchmarks();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'workload' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >⚡ Workload & Autoscaler</button>
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
                <button
                  @click="activeTab = 'cluster'; loadClusterState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
                  :class="activeTab === 'cluster' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🌐 Cluster & Edge</button>
                <button
                  @click="activeTab = 'webhooks'; loadWebhookState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
                  :class="activeTab === 'webhooks' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >📡 Webhooks & DLQ</button>
                <button
                  @click="activeTab = 'observability'; loadObservabilityState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'observability' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >📚 SDK & Observability</button>
                <button
                  @click="activeTab = 'consensus'; loadConsensusState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'consensus' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >⚖️ Consensus & Gates</button>
                <button
                  @click="activeTab = 'sso_rbac'; loadSsoRbacState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'sso_rbac' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🛡️ Identity & RBAC</button>
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

        <!-- Tab View 5: Workload, Autoscaler & Self-Healing -->
        <div v-else-if="activeTab === 'workload'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">⚡ Workload, Dynamic Autoscaler & Workflow Self-Healing</h3>
              <p class="text-[11px] text-zinc-500">Autonomous concurrency optimization, queue saturation balancing, and zero-downtime auto-remediation</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="loadWorkload(); loadLiveBenchmarks();"
                class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
              >🔄 Refresh</button>
              <button
                @click="runSelfHeal(true)"
                :disabled="isHealing"
                class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                <span>🛠️ Auto-Heal</span>
              </button>
            </div>
          </div>

          <div v-if="healSuccess" class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono">
            {{ healSuccess }}
          </div>

          <div v-if="autoscaleSuccess" class="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-mono">
            {{ autoscaleSuccess }}
          </div>

          <!-- Top Metric Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Queue Saturation</div>
              <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {{ workloadData ? (workloadData.workload_metrics?.saturation_percent || 0) : 0 }}%
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">
                Risk: <span class="font-bold uppercase" :class="(workloadData && workloadData.workload_metrics?.sla_risk === 'high') ? 'text-rose-500' : 'text-emerald-500'">{{ workloadData ? (workloadData.workload_metrics?.sla_risk || 'low') : 'low' }}</span>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Pending Backlog</div>
              <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {{ workloadData ? (workloadData.workload_metrics?.pending_backlog_count || 0) : 0 }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Est. ~{{ workloadData ? (workloadData.workload_metrics?.estimated_clearance_minutes || 0) : 0 }}m clearance</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Active Leases & Slots</div>
              <div class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {{ workloadData ? (workloadData.active_leases_count || 0) : 0 }} / {{ workloadData ? (workloadData.capacity?.total_reserved_slots || 0) : 0 }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Reserved worker slots</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Live Latency p50</div>
              <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {{ benchmarksData ? (benchmarksData.benchmark_metrics?.latency_ms?.p50 || 0) : 0 }} ms
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">{{ benchmarksData ? (benchmarksData.benchmark_metrics?.concurrency_status || 'optimal') : 'optimal' }}</div>
            </div>
          </div>

          <!-- Persona Queues & Autoscaler Recommendation -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Persona Queues Breakdown -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Persona Queue Saturation</h4>
              <div v-if="workloadData && workloadData.persona_queue_depth" class="space-y-2">
                <div v-for="(cnt, pName) in workloadData.persona_queue_depth" :key="pName" class="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-xs">
                  <span class="font-medium text-zinc-800 dark:text-zinc-200 capitalize font-mono">{{ pName }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-zinc-500 text-[11px]">{{ cnt }} pending</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      :class="cnt > 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'">
                      {{ cnt > 3 ? 'High Load' : 'Normal' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Autoscaler Scaling Plan Card -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Dynamic Scaling Optimizer</h4>
                <span v-if="autoscalePlan" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                  :class="autoscalePlan.autoscale_decision === 'scale_up' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'">
                  {{ autoscalePlan.autoscale_decision }}
                </span>
              </div>
              <p class="text-[11px] text-zinc-500">Autonomous evaluation of worker concurrency targets based on backlog pressure.</p>

              <div class="flex items-center gap-2 pt-1">
                <button
                  @click="runAutoscale(false)"
                  :disabled="isAutoscaling"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold disabled:opacity-50"
                >Calculate Plan</button>
                <button
                  @click="runAutoscale(true)"
                  :disabled="isAutoscaling"
                  class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
                >🚀 Apply Scaling</button>
              </div>

              <div v-if="autoscalePlan" class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-1">
                <div class="text-zinc-700 dark:text-zinc-300 font-bold">Target Workers: {{ autoscalePlan.total_recommended_workers }}</div>
                <div class="text-[11px] text-zinc-500">Strategy: {{ autoscalePlan.scaling_plan?.strategy }}</div>
                <div class="text-[10px] text-zinc-400 mt-1">Allocations: {{ JSON.stringify(autoscalePlan.persona_allocations) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab View 6: Distributed Cluster & Edge Replication -->
        <div
          v-if="activeTab === 'cluster'"
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30"
        >
          <!-- Cluster Quorum & Leadership Status Header -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Primary Leader</div>
              <div class="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5 truncate">
                {{ clusterState ? clusterState.primary_node : 'local-primary' }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5 font-mono">Term: {{ clusterState ? clusterState.term : 1 }}</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Quorum Health</div>
              <div class="text-base font-bold flex items-center gap-1.5 mt-0.5"
                :class="(clusterState && clusterState.is_quorum_ok) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">
                <span>{{ (clusterState && clusterState.is_quorum_ok) ? '✅ Quorum OK' : '⚠️ Degraded' }}</span>
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Threshold: {{ clusterState ? (clusterState.quorum_threshold || 1) : 1 }}</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Active Peer Nodes</div>
              <div class="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {{ clusterNodes.length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Edge + Replicas</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Fencing Guard</div>
              <div class="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" :title="clusterState ? clusterState.fencing_token : 'PB-FENCE-T1'">
                {{ clusterState ? clusterState.fencing_token : 'PB-FENCE-T1' }}
              </div>
              <div class="text-[10px] text-emerald-500 mt-0.5">Split-Brain Protected</div>
            </div>
          </div>

          <div v-if="clusterSuccessMsg" class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            {{ clusterSuccessMsg }}
          </div>
          <div v-if="clusterErrorMsg" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-semibold">
            {{ clusterErrorMsg }}
          </div>

          <!-- Nodes Fleet Table -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Cluster Peer & Edge Nodes</h4>
              <div class="flex items-center gap-2">
                <button
                  @click="triggerClusterSync"
                  :disabled="isSyncingCluster"
                  class="px-2.5 py-1 text-xs rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium transition-colors"
                >
                  {{ isSyncingCluster ? 'Syncing...' : '🔄 Pull Deltas' }}
                </button>
                <button
                  @click="loadClusterState"
                  class="px-2.5 py-1 text-xs rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div v-if="clusterNodes.length === 0" class="py-6 text-center text-xs text-zinc-500">
              No cluster peers registered yet. Add a node below to initiate cross-host replication.
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-[10px] uppercase">
                    <th class="pb-2 font-semibold">Node ID</th>
                    <th class="pb-2 font-semibold">Role</th>
                    <th class="pb-2 font-semibold">Region</th>
                    <th class="pb-2 font-semibold">Endpoint</th>
                    <th class="pb-2 font-semibold">Status</th>
                    <th class="pb-2 font-semibold">Lag</th>
                    <th class="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  <tr v-for="node in clusterNodes" :key="node.id" class="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td class="py-2.5 font-mono font-bold text-zinc-800 dark:text-zinc-200">{{ node.node_id }}</td>
                    <td class="py-2.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                        :class="node.role === 'primary' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'">
                        {{ node.role }}
                      </span>
                    </td>
                    <td class="py-2.5 text-zinc-600 dark:text-zinc-400 font-mono">{{ node.region || 'default' }}</td>
                    <td class="py-2.5 text-zinc-500 font-mono text-[11px] max-w-[150px] truncate" :title="node.endpoint_url">{{ node.endpoint_url }}</td>
                    <td class="py-2.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="node.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'">
                        {{ node.status }}
                      </span>
                    </td>
                    <td class="py-2.5 font-mono text-[11px] text-zinc-500">{{ node.lag_ms || 0 }}ms</td>
                    <td class="py-2.5 text-right space-x-1">
                      <button
                        v-if="node.role !== 'primary'"
                        @click="promoteClusterNode(node.node_id)"
                        class="px-2 py-0.5 rounded text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
                        title="Promote to primary leader"
                      >
                        Promote
                      </button>
                      <button
                        @click="decommissionClusterNode(node.node_id)"
                        class="px-2 py-0.5 rounded text-[10px] bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold transition-colors"
                        title="Decommission node"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Register Node Form -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Register Cluster Node</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <input
                v-model="newNodeId"
                type="text"
                placeholder="Node ID (e.g. vps-node-1)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
              />
              <input
                v-model="newNodeName"
                type="text"
                placeholder="Node Name"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
              />
              <input
                v-model="newNodeEndpoint"
                type="text"
                placeholder="Endpoint (https://node.lan:8120)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
              />
              <select
                v-model="newNodeRole"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
              >
                <option value="replica">Replica</option>
                <option value="edge">Edge Client</option>
                <option value="primary">Primary</option>
                <option value="witness">Witness</option>
              </select>
            </div>
            <button
              @click="registerNewClusterNode"
              class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Add Node
            </button>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- TAB: OUTBOUND WEBHOOK SECURITY GATEWAY & DLQ              -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'webhooks'"
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30"
        >
          <!-- Status Messages -->
          <div v-if="webhookSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
            <span>{{ webhookSuccessMsg }}</span>
            <button @click="webhookSuccessMsg = null" class="text-emerald-500 hover:text-emerald-400 font-bold">&times;</button>
          </div>
          <div v-if="webhookErrorMsg" class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
            <span>{{ webhookErrorMsg }}</span>
            <button @click="webhookErrorMsg = null" class="text-red-500 hover:text-red-400 font-bold">&times;</button>
          </div>

          <!-- Webhook Gateway Status Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Endpoints Fleet</div>
              <div class="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {{ webhookEndpoints.length }} Active
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Slack, Discord, Telegram, Agent</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Delivery Log</div>
              <div class="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {{ webhookDeliveries.length }} Dispatches
              </div>
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Audit Trail Active</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Dead-Letter Queue (DLQ)</div>
              <div class="text-base font-bold font-mono mt-0.5" :class="webhookDlq.length > 0 ? 'text-amber-500' : 'text-zinc-900 dark:text-zinc-100'">
                {{ webhookDlq.length }} Failed
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Exponential Backoff + Jitter</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Security Gateway</div>
              <div class="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                HMAC-SHA256
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">300s Replay Protection</div>
            </div>
          </div>

          <!-- Dispatcher & Transformation Testing Console -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                ⚡ Interactive Event Dispatcher & Payload Previewer
              </h3>
              <div class="flex items-center gap-2">
                <button
                  @click="loadWebhookState"
                  class="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                v-model="testEventName"
                type="text"
                placeholder="Event Name (e.g. issue.created)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
              />
              <input
                v-model="testPayloadTitle"
                type="text"
                placeholder="Payload Title / Summary"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
              />
              <div class="flex items-center gap-2">
                <select
                  v-model="previewPlatform"
                  class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="slack">Slack (Blocks)</option>
                  <option value="discord">Discord (Embeds)</option>
                  <option value="telegram">Telegram (HTML)</option>
                  <option value="agent">Agent / REST (JSON)</option>
                </select>
                <button
                  @click="testDispatchWebhook"
                  :disabled="isDispatchingWebhook"
                  class="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors truncate"
                >
                  {{ isDispatchingWebhook ? 'Dispatching...' : 'Dispatch Event' }}
                </button>
                <button
                  @click="loadTransformPreview"
                  class="px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
                >
                  Preview
                </button>
              </div>
            </div>

            <!-- Transformation Preview Modal/Box -->
            <div v-if="transformPreview" class="p-3 rounded-lg bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto space-y-1 border border-zinc-800">
              <div class="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1">
                <span>Transformed Payload ({{ transformPreview.platform }})</span>
                <span v-if="transformPreview.headers && transformPreview.headers['X-ProjectBase-Signature']" class="text-[10px] text-zinc-500 font-mono">{{ transformPreview.headers['X-ProjectBase-Signature'].substring(0, 24) }}...</span>
              </div>
              <pre class="mt-1 text-[10px] leading-relaxed">{{ JSON.stringify(transformPreview.transformed_payload, null, 2) }}</pre>
            </div>
          </div>

          <!-- Registered Endpoints Table -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              Registered Outbound Webhook Endpoints
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th class="py-2 px-2">Name</th>
                    <th class="py-2 px-2">Platform</th>
                    <th class="py-2 px-2">URL</th>
                    <th class="py-2 px-2">Events</th>
                    <th class="py-2 px-2">Dispatches</th>
                    <th class="py-2 px-2">Status</th>
                    <th class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  <tr v-if="webhookEndpoints.length === 0">
                    <td colspan="7" class="py-4 text-center text-zinc-400 font-sans">
                      No webhook endpoints configured yet. Register one below.
                    </td>
                  </tr>
                  <tr v-for="ep in webhookEndpoints" :key="ep.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td class="py-2 px-2 font-bold text-zinc-900 dark:text-zinc-100">{{ ep.name }}</td>
                    <td class="py-2 px-2">
                      <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold"
                        :class="ep.platform === 'slack' ? 'bg-amber-500/20 text-amber-500' : (ep.platform === 'discord' ? 'bg-indigo-500/20 text-indigo-400' : (ep.platform === 'telegram' ? 'bg-sky-500/20 text-sky-400' : 'bg-zinc-500/20 text-zinc-400'))">
                        {{ ep.platform }}
                      </span>
                    </td>
                    <td class="py-2 px-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]" :title="ep.url">{{ ep.url }}</td>
                    <td class="py-2 px-2 text-zinc-500 text-[11px]">{{ Array.isArray(ep.events) ? ep.events.join(', ') : ep.events }}</td>
                    <td class="py-2 px-2 text-zinc-500">{{ ep.stats ? ep.stats.total_dispatched : 0 }}</td>
                    <td class="py-2 px-2">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="ep.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'">
                        {{ ep.active ? 'Active' : 'Disabled' }}
                      </span>
                    </td>
                    <td class="py-2 px-2 text-right">
                      <button
                        @click="removeWebhookEndpoint(ep.id)"
                        class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Dead-Letter Queue (DLQ) Inspector -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  Dead-Letter Queue (DLQ) & Failure Diagnostic
                </h3>
                <span v-if="webhookDlq.length > 0" class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                  {{ webhookDlq.length }} Pending Replay
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="webhookDlq.length > 0"
                  @click="retryDlq('all')"
                  :disabled="dlqRetrying"
                  class="px-2.5 py-1 text-[11px] rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
                >
                  {{ dlqRetrying ? 'Replaying...' : 'Replay All' }}
                </button>
                <button
                  v-if="webhookDlq.length > 0"
                  @click="purgeDlq('all')"
                  class="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500/20 text-zinc-600 dark:text-zinc-400 hover:text-red-500 font-medium transition-colors"
                >
                  Flush DLQ
                </button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th class="py-2 px-2">Delivery ID</th>
                    <th class="py-2 px-2">Endpoint</th>
                    <th class="py-2 px-2">Event</th>
                    <th class="py-2 px-2">Error Reason</th>
                    <th class="py-2 px-2">Retries</th>
                    <th class="py-2 px-2">Status</th>
                    <th class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  <tr v-if="webhookDlq.length === 0">
                    <td colspan="7" class="py-4 text-center text-zinc-400 font-sans">
                      DLQ is empty. All webhook deliveries operating nominally.
                    </td>
                  </tr>
                  <tr v-for="item in webhookDlq" :key="item.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td class="py-2 px-2 font-bold text-zinc-900 dark:text-zinc-100">{{ item.delivery_id }}</td>
                    <td class="py-2 px-2 text-zinc-600 dark:text-zinc-400">{{ item.endpoint_name || item.endpoint_id }}</td>
                    <td class="py-2 px-2 text-indigo-500 font-bold">{{ item.event }}</td>
                    <td class="py-2 px-2 text-red-500 truncate max-w-[200px]" :title="item.error_message">{{ item.error_message }}</td>
                    <td class="py-2 px-2 text-zinc-500">{{ item.retry_count }}/{{ item.max_retries || 3 }}</td>
                    <td class="py-2 px-2">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="item.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">
                        {{ item.status }}
                      </span>
                    </td>
                    <td class="py-2 px-2 text-right space-x-1">
                      <button
                        v-if="item.status !== 'resolved'"
                        @click="retryDlq(item.id)"
                        class="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-[10px] font-semibold transition-colors"
                      >
                        Replay
                      </button>
                      <button
                        @click="purgeDlq(item.id)"
                        class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-semibold transition-colors"
                      >
                        Purge
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Register Outbound Webhook Form -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Register New Outbound Webhook Endpoint</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <input
                v-model="newWebhookName"
                type="text"
                placeholder="Endpoint Name (e.g. Slack Ops)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
              />
              <input
                v-model="newWebhookUrl"
                type="text"
                placeholder="Destination URL (https://hooks.slack.com/...)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
              />
              <select
                v-model="newWebhookPlatform"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
              >
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
                <option value="telegram">Telegram</option>
                <option value="agent">Agent / REST</option>
                <option value="custom">Custom Webhook</option>
              </select>
              <input
                v-model="newWebhookEvents"
                type="text"
                placeholder="Events (e.g. issue.*, dag.*, *)"
                class="p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
              />
            </div>
            <button
              @click="createNewWebhookEndpoint"
              class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Register Webhook
            </button>
          </div>
        </div>

        <!-- TAB 7: SDK GENERATOR, INTERACTIVE DOCS & OBSERVABILITY (EPIC 17) -->
        <div
          v-if="activeTab === 'observability'"
          class="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4"
        >
          <!-- Top Bar: Overview & Quick Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📚</span>
                <span>OpenAPI SDK Generator & Webhook Observability</span>
              </h2>
              <p class="text-xs text-zinc-500 mt-0.5">
                Generate production-ready typed client SDKs, monitor live p95 latency, configure automated alert thresholds, and explore agent recipes.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="triggerAlertEvaluation"
                :disabled="isEvaluatingAlerts"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span>⚡</span>
                <span>{{ isEvaluatingAlerts ? 'Evaluating...' : 'Evaluate SLA Rules' }}</span>
              </button>
              <button
                @click="loadObservabilityState"
                class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <!-- Alert Notifications Banner -->
          <div v-if="alertSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-between">
            <span>✅ {{ alertSuccessMsg }}</span>
            <button @click="alertSuccessMsg = null" class="text-emerald-500 hover:text-emerald-600 font-bold text-xs">✕</button>
          </div>
          <div v-if="alertErrorMsg" class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-between">
            <span>❌ {{ alertErrorMsg }}</span>
            <button @click="alertErrorMsg = null" class="text-rose-500 hover:text-rose-600 font-bold text-xs">✕</button>
          </div>

          <!-- Live Observability KPI Metrics -->
          <div v-if="observabilityMetrics" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">P95 Delivery Latency</div>
              <div class="text-xl font-bold font-mono text-indigo-500 mt-1">
                {{ observabilityMetrics.latency ? observabilityMetrics.latency.p95_ms : 0 }} <span class="text-xs font-normal text-zinc-400">ms</span>
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">Avg: {{ observabilityMetrics.latency ? observabilityMetrics.latency.avg_ms : 0 }}ms</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Delivery Success Rate</div>
              <div class="text-xl font-bold font-mono text-emerald-500 mt-1">
                {{ observabilityMetrics.summary ? observabilityMetrics.summary.success_rate_pct : 100 }}%
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">{{ observabilityMetrics.summary ? observabilityMetrics.summary.successful_deliveries : 0 }} / {{ observabilityMetrics.summary ? observabilityMetrics.summary.total_requests : 0 }} events</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Webhook Throughput</div>
              <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {{ observabilityMetrics.summary ? observabilityMetrics.summary.throughput_per_min : 0 }} <span class="text-xs font-normal text-zinc-400">req/min</span>
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">Status: <span class="uppercase font-bold" :class="observabilityMetrics.health_status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'">{{ observabilityMetrics.health_status }}</span></div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Active Alert Rules</div>
              <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {{ observabilityAlerts.length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">{{ observabilityEvents.length }} breaches recorded</div>
            </div>
          </div>

          <!-- Section 1: Interactive Client SDK Generator -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>💻</span>
                <span>Interactive Client SDK Generator</span>
              </h3>
              <div class="flex items-center gap-2">
                <select
                  v-model="selectedSdkLang"
                  @change="generateSdkSnippet"
                  class="p-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                >
                  <option value="python">Python 3 (httpx/requests)</option>
                  <option value="typescript">TypeScript / Node.js</option>
                  <option value="javascript">JavaScript (ESM)</option>
                  <option value="curl">cURL CLI</option>
                  <option value="agent_tool">Agent Tool Schema (FastMCP/OpenAI)</option>
                </select>
                <button
                  @click="copySdkSnippet"
                  class="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span>{{ sdkCopied ? '✅ Copied!' : '📋 Copy Code' }}</span>
                </button>
              </div>
            </div>

            <!-- Endpoint or Tool Target Configuration -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-bold text-zinc-400 uppercase">REST Endpoint Target</label>
                <input
                  v-model="sdkTargetEndpoint"
                  @input="generateSdkSnippet"
                  type="text"
                  placeholder="/api/collections/issues/records or /api/projectbase/dag/decompose"
                  class="w-full mt-1 p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
                />
              </div>
              <div>
                <label class="text-[10px] font-bold text-zinc-400 uppercase">FastMCP Tool Target (Optional)</label>
                <input
                  v-model="sdkTargetTool"
                  @input="generateSdkSnippet"
                  type="text"
                  placeholder="decompose_task_graph, acquire_task_lease, etc."
                  class="w-full mt-1 p-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono"
                />
              </div>
            </div>

            <!-- Generated Code Display -->
            <div class="relative">
              <pre class="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto max-h-72 border border-zinc-800">{{ generatedSdkCode }}</pre>
            </div>
          </div>

          <!-- Section 2: Observability Alert Rules & Breaches -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Configured Rules -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>🚨</span>
                <span>Configured Alert Rules</span>
              </h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">
                      <th class="py-1.5 px-2">Rule Name</th>
                      <th class="py-1.5 px-2">Metric</th>
                      <th class="py-1.5 px-2">Condition</th>
                      <th class="py-1.5 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                    <tr v-if="observabilityAlerts.length === 0">
                      <td colspan="4" class="py-3 text-center text-zinc-400 font-sans">No alert rules configured.</td>
                    </tr>
                    <tr v-for="rule in observabilityAlerts" :key="rule.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td class="py-1.5 px-2 font-bold text-zinc-900 dark:text-zinc-100 font-sans">{{ rule.name }}</td>
                      <td class="py-1.5 px-2 text-indigo-500 font-semibold">{{ rule.metric_name }}</td>
                      <td class="py-1.5 px-2 text-zinc-600 dark:text-zinc-400">{{ rule.comparison_operator }} {{ rule.threshold_value }}</td>
                      <td class="py-1.5 px-2 text-right">
                        <button @click="deleteAlertRule(rule.id)" class="text-rose-500 hover:text-rose-600 text-xs font-bold">Delete</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Create Alert Rule Inline Form -->
              <div class="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2 font-sans">
                <h4 class="text-[10px] font-bold uppercase text-zinc-400">Add SLA Alert Threshold</h4>
                <div class="grid grid-cols-2 gap-2">
                  <input v-model="newAlertName" type="text" placeholder="Rule Name" class="p-1.5 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800" />
                  <select v-model="newAlertMetric" class="p-1.5 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono">
                    <option value="error_rate_pct">error_rate_pct</option>
                    <option value="p95_latency_ms">p95_latency_ms</option>
                    <option value="failure_count">failure_count</option>
                  </select>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <select v-model="newAlertOperator" class="p-1.5 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono">
                    <option value="gt">&gt; (greater)</option>
                    <option value="gte">&gt;= (greater/equal)</option>
                    <option value="lt">&lt; (less)</option>
                  </select>
                  <input v-model="newAlertThreshold" type="number" step="0.1" placeholder="Threshold" class="p-1.5 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono" />
                  <button @click="createObservabilityAlert" class="px-2 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Save Rule</button>
                </div>
              </div>
            </div>

            <!-- Recent Alert Breaches -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Recent Alert Breach Events</span>
              </h3>
              <div class="overflow-x-auto max-h-64">
                <table class="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">
                      <th class="py-1.5 px-2">Metric</th>
                      <th class="py-1.5 px-2">Value</th>
                      <th class="py-1.5 px-2">Status</th>
                      <th class="py-1.5 px-2">Message</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                    <tr v-if="observabilityEvents.length === 0">
                      <td colspan="4" class="py-3 text-center text-zinc-400 font-sans">No breach events recorded.</td>
                    </tr>
                    <tr v-for="ev in observabilityEvents" :key="ev.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td class="py-1.5 px-2 text-rose-500 font-bold">{{ ev.metric_name }}</td>
                      <td class="py-1.5 px-2 text-zinc-700 dark:text-zinc-300">{{ ev.current_value }}</td>
                      <td class="py-1.5 px-2">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">{{ ev.status }}</span>
                      </td>
                      <td class="py-1.5 px-2 text-zinc-500 truncate max-w-[150px] font-sans" :title="ev.message">{{ ev.message }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Section 3: Interactive Integration Recipes -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>📖</span>
              <span>Autonomous Agent Integration Recipes</span>
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="rec in integrationRecipes"
                :key="rec.id"
                @click="selectedRecipe = rec"
                class="p-3 rounded-lg border cursor-pointer transition-all"
                :class="selectedRecipe && selectedRecipe.id === rec.id ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ rec.title }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">{{ rec.category }}</span>
                </div>
                <p class="text-xs text-zinc-500 mt-1">{{ rec.description }}</p>
                <div v-if="selectedRecipe && selectedRecipe.id === rec.id && rec.steps" class="mt-2 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 font-mono text-xs">
                  <div v-for="st in rec.steps" :key="st.step" class="bg-zinc-950 text-zinc-300 p-2 rounded text-[11px]">
                    <div class="font-bold text-indigo-400 font-sans">Step {{ st.step }}: {{ st.title }}</div>
                    <pre class="mt-1 overflow-x-auto">{{ st.code }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- TAB 8: AUTONOMOUS MULTI-MODEL CONSENSUS & PEER REVIEW GATE ENGINE (EPIC 18) -->
        <div
          v-if="activeTab === 'consensus'"
          class="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4"
        >
          <!-- Top Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>⚖️</span>
                <span>Multi-Model Consensus & Peer Review Gates</span>
              </h2>
              <p class="text-xs text-zinc-500 mt-0.5">
                Native multi-model AI consensus verification with verifiable cryptographic signed ballots, quorum thresholds, and automated debate arbitration.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="triggerConsensusDebate(selectedConsensusGate)"
                :disabled="isStartingDebate"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span>⚡</span>
                <span>{{ isStartingDebate ? 'Orchestrating Debate...' : '1-Click Multi-Model Debate' }}</span>
              </button>
              <button
                @click="loadConsensusState"
                class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <!-- Alert/Success messages -->
          <div v-if="consensusSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <span>✅</span>
            <span>{{ consensusSuccessMsg }}</span>
          </div>
          <div v-if="consensusErrorMsg" class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <span>❌</span>
            <span>{{ consensusErrorMsg }}</span>
          </div>

          <!-- Live KPI Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-zinc-400">Total Gates</div>
              <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{{ (consensusMetrics && consensusMetrics.total_gates) || consensusGates.length }}</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Configured quorums</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-emerald-500">Approved Gates</div>
              <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ (consensusMetrics && consensusMetrics.approved_gates) || 0 }}</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Quorum cleared</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-indigo-500">Approval Rate</div>
              <div class="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{{ (consensusMetrics && consensusMetrics.approval_rate_pct) || 100 }}%</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Consensus ratio</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-purple-500">Mean Confidence</div>
              <div class="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">{{ Math.round(((consensusMetrics && consensusMetrics.avg_consensus_score) || 0.92) * 100) }}%</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Persona certainty</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-bold text-amber-500">Divergence Index</div>
              <div class="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{{ Math.round(((consensusMetrics && consensusMetrics.avg_divergence_score) || 0.08) * 100) }}%</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Stance entropy</div>
            </div>
          </div>

          <!-- Main Layout: 2 Columns (Gates & Inspector) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <!-- Left Column: Gate Creator & List (5 cols) -->
            <div class="lg:col-span-5 space-y-4">
              <!-- Create Gate Form -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>➕ Create Consensus Gate</span>
                  <span class="text-[10px] font-mono text-indigo-500">Zero-Trust Peer Review</span>
                </h3>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Issue Identifier / ID</label>
                    <input
                      v-model="newGateIssueId"
                      type="text"
                      placeholder="e.g. PB-12"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Target Type</label>
                    <select
                      v-model="newGateTargetType"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="pull_request">Pull Request / Merge</option>
                      <option value="issue">Issue Release Gate</option>
                      <option value="release">Production Release</option>
                      <option value="architecture_rfc">Architecture RFC</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-1">Gate Title / Scope</label>
                  <input
                    v-model="newGateTitle"
                    type="text"
                    placeholder="e.g. Epic 18 Consensus Engine Release Audit"
                    class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Quorum Size</label>
                    <input
                      v-model.number="newGateQuorum"
                      type="number"
                      min="2"
                      max="10"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Min Confidence Threshold</label>
                    <input
                      v-model.number="newGateMinConfidence"
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="1.0"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  @click="createConsensusGate"
                  class="w-full py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors"
                >
                  Create Gate
                </button>
              </div>

              <!-- Gate List Card -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Configured Consensus Gates</h3>
                  <span class="text-[10px] text-zinc-400 font-mono">{{ consensusGates.length }} total</span>
                </div>

                <div v-if="consensusGates.length === 0" class="text-center py-6 text-xs text-zinc-400">
                  No consensus gates created yet. Click "1-Click Multi-Model Debate" above to generate one.
                </div>

                <div class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  <div
                    v-for="gate in consensusGates"
                    :key="gate.id"
                    @click="selectConsensusGate(gate)"
                    class="p-3 rounded-lg border cursor-pointer transition-all"
                    :class="selectedConsensusGate && selectedConsensusGate.id === gate.id ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ gate.target_title }}</span>
                        <span v-if="gate.issue_id" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{{ gate.issue_id }}</span>
                      </div>
                      <span
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        :class="gate.verdict === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : (gate.verdict === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20')"
                      >
                        {{ gate.verdict || gate.status }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
                      <div class="flex items-center gap-2">
                        <span>Quorum: {{ (gate.tallies && gate.tallies.approve) || 0 }}/{{ gate.quorum_size }}</span>
                        <span>•</span>
                        <span>Confidence: {{ Math.round((gate.consensus_score || 0) * 100) }}%</span>
                      </div>
                      <button
                        @click.stop="deleteConsensusGate(gate.id)"
                        class="text-red-500 hover:text-red-700 transition-colors"
                        title="Delete Gate"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Gate Inspector & Ballots (7 cols) -->
            <div class="lg:col-span-7 space-y-4">
              <div v-if="!selectedConsensusGate" class="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                Select a consensus gate from the left panel or start a new debate.
              </div>

              <div v-else class="space-y-4">
                <!-- Gate Inspector Header -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedConsensusGate.target_title }}</h3>
                        <span
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          :class="selectedConsensusGate.verdict === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : (selectedConsensusGate.verdict === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')"
                        >
                          {{ selectedConsensusGate.verdict }}
                        </span>
                      </div>
                      <p class="text-xs text-zinc-500 mt-0.5">{{ selectedConsensusGate.scope }}</p>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        @click="triggerGateEvaluation(selectedConsensusGate.id)"
                        :disabled="isEvaluatingGate"
                        class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {{ isEvaluatingGate ? 'Evaluating...' : '⚖️ Evaluate Quorum' }}
                      </button>
                      <button
                        @click="triggerConsensusDebate(selectedConsensusGate)"
                        :disabled="isStartingDebate"
                        class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        ⚡ Re-Debate
                      </button>
                    </div>
                  </div>

                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 text-xs space-y-1">
                    <div class="font-semibold text-zinc-800 dark:text-zinc-200">Arbitration Summary:</div>
                    <div class="text-zinc-600 dark:text-zinc-400">{{ (selectedConsensusGate.summary && selectedConsensusGate.summary.description) || 'Awaiting ballots for arbitration evaluation.' }}</div>
                  </div>
                </div>

                <!-- Signed Ballots List -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>🛡️ Verifiable Cryptographic Ballots</span>
                      <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">{{ gateBallots.length }} submitted</span>
                    </h3>
                  </div>

                  <div v-if="gateBallots.length === 0" class="text-center py-6 text-xs text-zinc-400">
                    No ballots submitted for this gate yet. Run 1-Click Multi-Model Debate or submit a ballot below.
                  </div>

                  <div class="space-y-2.5">
                    <div
                      v-for="ballot in gateBallots"
                      :key="ballot.id"
                      class="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ ballot.model_name }}</span>
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">{{ ballot.persona }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span
                            class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                            :class="ballot.vote === 'approve' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : (ballot.vote === 'reject' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-zinc-500/10 text-zinc-400')"
                          >
                            {{ ballot.vote }}
                          </span>
                          <span class="text-[10px] font-mono text-zinc-400">Conf: {{ Math.round((ballot.confidence || 0) * 100) }}%</span>
                        </div>
                      </div>

                      <p class="text-xs text-zinc-600 dark:text-zinc-300">{{ ballot.reasoning }}</p>

                      <div v-if="ballot.findings && ballot.findings.length > 0" class="space-y-1 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                        <div v-for="(f, fi) in ballot.findings" :key="fi" class="text-[11px] text-zinc-500 flex items-center gap-1.5">
                          <span>{{ f.level === 'pass' ? '✅' : (f.level === 'info' ? 'ℹ️' : '⚠️') }}</span>
                          <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ f.title || f.note }}</span>
                        </div>
                      </div>

                      <div class="flex items-center justify-between text-[9px] font-mono text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                        <span class="truncate max-w-[280px]">Sig: {{ ballot.signature }}</span>
                        <span class="text-emerald-500 font-semibold">✓ SHA-256 Valid</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Submit Manual Ballot Box -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>✍️ Cast Verifiable Review Ballot</span>
                    <span class="text-[10px] text-zinc-400">Peer Reviewer / External Agent</span>
                  </h3>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-1">Model Name</label>
                      <select
                        v-model="manualBallotModel"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none"
                      >
                        <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="deepseek-r1">deepseek-r1</option>
                        <option value="llama-3.3-70b">llama-3.3-70b</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-1">Persona</label>
                      <select
                        v-model="manualBallotPersona"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none"
                      >
                        <option value="SecurityAuditor">SecurityAuditor</option>
                        <option value="ArchitecturePragmatist">ArchitecturePragmatist</option>
                        <option value="QASRE">QASRE</option>
                        <option value="BenchmarkAnalyst">BenchmarkAnalyst</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-1">Vote</label>
                      <select
                        v-model="manualBallotVote"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none"
                      >
                        <option value="approve">APPROVE</option>
                        <option value="reject">REJECT</option>
                        <option value="abstain">ABSTAIN</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Review Rationale / Reasoning</label>
                    <textarea
                      v-model="manualBallotReason"
                      rows="2"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                    ></textarea>
                  </div>

                  <button
                    @click="submitManualBallot"
                    class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                  >
                    Submit & Cryptographically Sign Ballot
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2J: ENTERPRISE SSO FEDERATION & GRANULAR RBAC MATRIX -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'sso_rbac'"
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/40"
        >
          <!-- Top KPI / Metric Banner -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">🛡️</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">SSO Providers</div>
                <div class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ ssoProviders.length }} Configured</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">👥</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">RBAC Roles</div>
                <div class="text-base font-bold text-indigo-600 dark:text-indigo-400">{{ rbacRoles.length }} Roles Active</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">🔑</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Assignments</div>
                <div class="text-base font-bold text-emerald-600 dark:text-emerald-400">{{ rbacAssignments.length }} Grantees</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">📜</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Audit Events</div>
                <div class="text-base font-bold text-amber-600 dark:text-amber-400">{{ rbacAuditLogs.length }} Logged</div>
              </div>
            </div>
          </div>

          <!-- Alert Messages -->
          <div v-if="ssoSuccessMsg" class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <span>✓</span> {{ ssoSuccessMsg }}
          </div>
          <div v-if="ssoErrorMsg" class="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <span>⚠️</span> {{ ssoErrorMsg }}
          </div>
          <div v-if="rbacSuccessMsg" class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <span>✓</span> {{ rbacSuccessMsg }}
          </div>
          <div v-if="rbacErrorMsg" class="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <span>⚠️</span> {{ rbacErrorMsg }}
          </div>

          <!-- Main 2-Column Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <!-- Left Column: SSO Identity Providers & JIT Provisioning (5 cols) -->
            <div class="lg:col-span-5 space-y-4">
              <!-- Configured SSO Providers Card -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🌐 Enterprise Identity Providers</span>
                    <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">{{ ssoProviders.length }}</span>
                  </h3>
                  <button
                    @click="loadSsoRbacState"
                    class="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    🔄 Refresh
                  </button>
                </div>

                <div class="space-y-2">
                  <div
                    v-for="prov in ssoProviders"
                    :key="prov.id"
                    class="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-base">{{ prov.provider_key.includes('google') ? '🔴' : (prov.provider_key.includes('github') ? '🐙' : (prov.provider_key.includes('okta') ? '🔷' : '🔑')) }}</span>
                        <div>
                          <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ prov.name }}</div>
                          <div class="text-[10px] text-zinc-400 font-mono">{{ prov.provider_key }} ({{ prov.provider_type.toUpperCase() }})</div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span
                          class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                          :class="prov.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'"
                        >
                          {{ prov.enabled ? 'Active' : 'Disabled' }}
                        </span>
                        <button
                          @click="testSsoExchange(prov.provider_key)"
                          class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-semibold"
                          title="Test Token Exchange"
                        >
                          ⚡ Test
                        </button>
                      </div>
                    </div>

                    <div class="text-[10px] text-zinc-500 dark:text-zinc-400 space-y-0.5 font-mono">
                      <div><span class="text-zinc-400">Issuer:</span> {{ prov.issuer_url || '—' }}</div>
                      <div><span class="text-zinc-400">JIT Provisioning:</span> {{ prov.jit_provisioning ? '✓ Enabled' : '✗ Disabled' }} (Default Role: <span class="text-indigo-500 font-semibold">{{ prov.default_role }}</span>)</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 1-Click SSO Token Exchange Simulator -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>🧪 SSO JIT Exchange Simulator</span>
                  <span class="text-[10px] text-zinc-400">Mock Provider Token</span>
                </h3>
                <div class="space-y-2 text-xs">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">User Email to Provision</label>
                    <input
                      v-model="ssoTestEmail"
                      type="email"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Display Name</label>
                    <input
                      v-model="ssoTestName"
                      type="text"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    @click="testSsoExchange('google')"
                    :disabled="isTestingSso"
                    class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {{ isTestingSso ? 'Authenticating...' : 'Simulate Google OIDC Exchange & Provision JIT' }}
                  </button>

                  <div v-if="ssoTestResult" class="p-3 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[10px] space-y-1 mt-2">
                    <div class="text-emerald-400 font-bold">✓ Token Exchange Succeeded:</div>
                    <div>User: {{ ssoTestResult.user && ssoTestResult.user.email }}</div>
                    <div>Role: {{ ssoTestResult.user && ssoTestResult.user.role }}</div>
                    <div>Token: {{ ssoTestResult.token || ssoTestResult.session_token }}</div>
                  </div>
                </div>
              </div>

              <!-- Configure New Provider Card -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Add Enterprise Provider</h3>
                <div class="space-y-2 text-xs">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Provider Type / Key</label>
                    <input
                      v-model="newSsoProviderKey"
                      placeholder="e.g. okta-staging, azure-ad, auth0"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Display Name</label>
                    <input
                      v-model="newSsoName"
                      placeholder="e.g. Corporate Okta SSO"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-1">Issuer Base URL</label>
                    <input
                      v-model="newSsoIssuerUrl"
                      placeholder="https://auth.company.com"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-1">Client ID</label>
                      <input
                        v-model="newSsoClientId"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-1">Default Role</label>
                      <select
                        v-model="newSsoDefaultRole"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none"
                      >
                        <option value="member">member</option>
                        <option value="maintainer">maintainer</option>
                        <option value="admin">admin</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </div>
                  </div>
                  <button
                    @click="saveSsoProvider"
                    class="w-full py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors mt-2"
                  >
                    Save SSO Provider
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Column: Visual RBAC Matrix, Assignments & Audit Logs (7 cols) -->
            <div class="lg:col-span-7 space-y-4">
              <!-- Interactive Visual RBAC Matrix -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🛡️ Granular RBAC Permissions Matrix</span>
                    <span class="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold">{{ rbacRoles.length }} Roles</span>
                  </h3>
                </div>

                <div class="overflow-x-auto max-h-[300px] border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-zinc-100 dark:bg-zinc-800/80 sticky top-0 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase">
                      <tr>
                        <th class="p-2">Capability</th>
                        <th v-for="r in rbacRoles" :key="r.role_key" class="p-2 text-center">{{ r.role_key }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono text-[10px]">
                      <tr v-for="row in rbacMatrix" :key="row.capability_key" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td class="p-2 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                          <div>{{ row.name }}</div>
                          <div class="text-[9px] text-zinc-400 font-mono">{{ row.capability_key }}</div>
                        </td>
                        <td v-for="r in rbacRoles" :key="r.role_key" class="p-2 text-center">
                          <span v-if="row.access && row.access[r.role_key]" class="text-emerald-500 font-bold">✓</span>
                          <span v-else class="text-zinc-300 dark:text-zinc-700">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Permission Checker Simulator & Role Assignment -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <!-- 1-Click Permission Checker -->
                <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">🔍 Live Permission Evaluator</h4>
                  <div class="space-y-1.5 text-xs">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Actor (User/Agent ID)</label>
                      <input
                        v-model="testRbacActor"
                        class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Required Capability</label>
                      <input
                        v-model="testRbacCap"
                        placeholder="e.g. issues:create, agents:dispatch"
                        class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                    </div>
                    <button
                      @click="checkPermissionTest"
                      :disabled="isCheckingRbac"
                      class="w-full py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                    >
                      Evaluate Permission
                    </button>
                    <div v-if="testRbacResult" class="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border text-[10px] font-mono" :class="testRbacResult.allowed ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'border-red-500/30 text-red-600 dark:text-red-400'">
                      {{ testRbacResult.allowed ? '✓ PERMISSION ALLOWED' : '✗ PERMISSION DENIED' }}: {{ testRbacResult.reason }}
                    </div>
                  </div>
                </div>

                <!-- User Role Assignment Card -->
                <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">👥 Assign User / Agent Role</h4>
                  <div class="space-y-1.5 text-xs">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Grantee (User Email or Agent ID)</label>
                      <input
                        v-model="newAssignUser"
                        placeholder="agent-orchestrator or dev@flow.com"
                        class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Role</label>
                      <select
                        v-model="newAssignRole"
                        class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        <option v-for="r in rbacRoles" :key="r.role_key" :value="r.role_key">{{ r.name }} ({{ r.role_key }})</option>
                      </select>
                    </div>
                    <button
                      @click="assignUserRole"
                      class="w-full py-1 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold transition-colors"
                    >
                      Assign Role
                    </button>
                  </div>
                </div>
              </div>

              <!-- Security & Access Audit Log Viewer -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>📜 Security & Access Audit Trail</span>
                    <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">{{ rbacAuditLogs.length }} events</span>
                  </h3>
                  <div class="flex items-center gap-1.5">
                    <button
                      @click="exportAuditLogs('json')"
                      class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-[10px] font-medium"
                    >
                      JSON
                    </button>
                    <button
                      @click="exportAuditLogs('csv')"
                      class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-[10px] font-medium"
                    >
                      CSV
                    </button>
                  </div>
                </div>

                <div class="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  <div v-if="rbacAuditLogs.length === 0" class="text-center py-4 text-xs text-zinc-400">
                    No security audit events recorded yet.
                  </div>
                  <div
                    v-for="log in rbacAuditLogs"
                    :key="log.id"
                    class="p-2 rounded bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/60 flex items-center justify-between text-[10px] font-mono"
                  >
                    <div class="flex items-center gap-2">
                      <span :class="log.status === 'success' ? 'text-emerald-500' : 'text-red-500'">{{ log.status === 'success' ? '●' : '▲' }}</span>
                      <div>
                        <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ log.event_type }}</span>
                        <span class="text-zinc-400"> by {{ log.actor_id }}</span>
                      </div>
                    </div>
                    <span class="text-zinc-400">{{ fmtTime(log.created) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>
    </div>
  `
};
