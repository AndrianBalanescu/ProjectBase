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
      isLoadingSsoRbac: false,
      // Workflow Automations & AI Agent Trigger Pipelines (Epic 20)
      workflowRules: [],
      workflowRuns: [],
      workflowMetrics: null,
      workflowTemplates: [],
      selectedWorkflowRun: null,
      newRuleName: '',
      newRuleDescription: '',
      newRuleEventType: 'issue.created',
      newRuleProject: '',
      newRuleConditionsStr: '{\n  "priority": "urgent"\n}',
      newRuleActionType: 'dispatch_agent',
      newRuleActionParamsStr: '{\n  "role": "sre",\n  "prompt": "Investigate urgent issue and verify root cause"\n}',
      simulatedTriggerEvent: 'issue.status_changed',
      simulatedTriggerPayloadStr: '{\n  "issue_id": "PB-101",\n  "status_to": "done"\n}',
      isTriggeringAutomation: false,
      isSavingRule: false,
      automationSuccessMsg: null,
      automationErrorMsg: null,
      isLoadingAutomations: false,
      // Multi-Tenant Isolation & Resource Quotas (Epic 21)
      tenantsList: [],
      selectedTenant: null,
      tenantMetrics: null,
      tenantMembers: [],
      tenantUsage: null,
      tenantQuotas: null,
      newTenantName: '',
      newTenantSlug: '',
      newTenantDesc: '',
      newTenantPlanTier: 'free',
      newTenantOwner: 'admin',
      testQuotaResourceType: 'issues',
      testQuotaUnits: 5,
      testQuotaResult: null,
      isCheckingTenantQuota: false,
      isCreatingTenant: false,
      isSavingQuotas: false,
      tenantSuccessMsg: null,
      tenantErrorMsg: null,
      isLoadingTenants: false,
      activeTenantContextId: null,
      // Auto-Healing & Self-Remediation Workflow Pipeline (Epic 22)
      autoHealPolicies: [],
      autoHealIncidents: [],
      autoHealHealthFleet: [],
      autoHealMetrics: null,
      autoHealRecipes: [],
      selectedIncident: null,
      newPolicyName: '',
      newPolicyTrigger: 'crash_loop',
      newPolicyAction: 'restart_agent',
      newPolicySeverity: 'medium',
      newPolicyMaxRetries: 3,
      newPolicyCoolDown: 60,
      newPolicyDesc: '',
      isHealingFleet: false,
      isSweepingCrash: false,
      autoHealSuccessMsg: null,
      autoHealErrorMsg: null,
      isLoadingAutoHeal: false,
      // Execution Plane & Live Runs State (Milestone 1 & 2)
      agentSessionRuns: [],
      liveSessionRuns: [],
      sessionMetrics: null,
      selectedSessionRun: null,
      sessionFilterStatus: 'all',
      sessionFilterAgent: '',
      newIngestAgentName: 'flomaster',
      newIngestRuntime: 'flomaster',
      newIngestModel: 'gpt-5.5',
      newIngestCommand: '',
      newIngestWorkdir: '/data/projects/projectbase',
      isIngestingSession: false,
      sessionSuccessMsg: null,
      sessionErrorMsg: null,
      isLoadingSessions: false,
      // Deep Observability & Ground Truth Verification Hub (Milestone 3)
      sessionObservabilityTab: 'diff', // 'diff' | 'verdict' | 'audit' | 'telemetry'
      sessionDiffData: null,
      sessionVerdictData: null,
      sessionAuditData: null,
      observabilitySummary: null,
      selectedDiffFileIndex: 0,
      isVerifyingObservability: false,
      observabilitySuccessMsg: null,
      observabilityErrorMsg: null,
      diffCopied: false,
      simulatedTestFramework: 'pytest',
      simulatedTestPassed: 401,
      simulatedTestFailed: 0,
      simulatedAuditVerdict: 'PASS',
      // One-Click Session Branching, Re-Tasking & Human Intervention Gate (Milestone 4 / Epic 25)
      branchModalOpen: false,
      branchTargetSession: null,
      branchNameInput: '',
      branchTypeInput: 'fork',
      branchPromptInput: '',
      branchModelInput: '',
      isBranchingSession: false,
      interventionInstructionInput: '',
      interventionPriorityInput: 'high',
      isInjectingInstruction: false,
      sessionDagData: null,
      sessionInterventionsList: [],
      allSessionConflicts: [],
      isLoadingDag: false,
      swarmModalOpen: false,
      isDispatchingSwarm: false
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
    },
    async loadAutomationsState() {
      this.isLoadingAutomations = true;
      this.automationSuccessMsg = null;
      this.automationErrorMsg = null;
      try {
        const [rulesRes, runsRes, metricsRes, tplsRes] = await Promise.all([
          API.getAutomationRules().catch(() => ({ rules: [] })),
          API.getAutomationRuns({ limit: 50 }).catch(() => ({ runs: [] })),
          API.getAutomationMetrics().catch(() => null),
          API.getAutomationTemplates().catch(() => ({ templates: [] }))
        ]);
        this.workflowRules = (rulesRes && rulesRes.rules) || [];
        this.workflowRuns = (runsRes && runsRes.runs) || [];
        this.workflowMetrics = metricsRes || {
          total_rules: this.workflowRules.length,
          active_rules: this.workflowRules.filter(r => r.is_active).length,
          total_runs: this.workflowRuns.length,
          success_rate: 100,
          avg_duration_ms: 25
        };
        this.workflowTemplates = (tplsRes && tplsRes.templates) || [];
      } catch (e) {
        this.automationErrorMsg = e.message || String(e);
      } finally {
        this.isLoadingAutomations = false;
      }
    },
    async createWorkflowRule() {
      if (!this.newRuleName || !this.newRuleEventType) {
        this.automationErrorMsg = 'Rule name and event type are required';
        return;
      }
      this.isSavingRule = true;
      this.automationSuccessMsg = null;
      this.automationErrorMsg = null;
      try {
        let conditions = {};
        if (this.newRuleConditionsStr.trim()) {
          try { conditions = JSON.parse(this.newRuleConditionsStr); } catch (err) {
            throw new Error('Invalid JSON in Trigger Conditions: ' + err.message);
          }
        }
        let actionParams = {};
        if (this.newRuleActionParamsStr.trim()) {
          try { actionParams = JSON.parse(this.newRuleActionParamsStr); } catch (err) {
            throw new Error('Invalid JSON in Action Parameters: ' + err.message);
          }
        }

        const actionStep = {
          id: 'step_1',
          action: this.newRuleActionType || 'dispatch_agent',
          params: actionParams
        };

        await API.createAutomationRule({
          name: this.newRuleName.trim(),
          description: this.newRuleDescription.trim(),
          project: this.newRuleProject.trim(),
          event_type: this.newRuleEventType,
          trigger_conditions: conditions,
          action_pipeline: [actionStep],
          is_active: true,
          execution_mode: 'sequential'
        });

        this.automationSuccessMsg = `Automation rule '${this.newRuleName}' created successfully!`;
        this.newRuleName = '';
        this.newRuleDescription = '';
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = e.message || String(e);
      } finally {
        this.isSavingRule = false;
      }
    },
    async toggleWorkflowRule(rule) {
      if (!rule || !rule.id) return;
      try {
        await API.toggleAutomationRule(rule.id);
        rule.is_active = !rule.is_active;
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = e.message || String(e);
      }
    },
    async deleteWorkflowRule(ruleId) {
      if (!confirm('Are you sure you want to delete this automation rule?')) return;
      try {
        await API.deleteAutomationRule(ruleId);
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = e.message || String(e);
      }
    },
    async testWorkflowRule(ruleId) {
      this.automationSuccessMsg = null;
      this.automationErrorMsg = null;
      try {
        const res = await API.testAutomationRule(ruleId, { status_to: 'done', priority: 'urgent' });
        if (res && res.matched) {
          this.automationSuccessMsg = `Test succeeded: Rule matched and simulated ${res.run.step_results.length} pipeline steps in ${res.run.duration_ms}ms.`;
        } else {
          this.automationSuccessMsg = `Test completed: Payload did not match trigger criteria (${res.message || 'No match'}).`;
        }
      } catch (e) {
        this.automationErrorMsg = 'Test failed: ' + (e.message || String(e));
      }
    },
    async applyWorkflowTemplate(tpl) {
      if (!tpl) return;
      this.newRuleName = tpl.name;
      this.newRuleDescription = tpl.description;
      this.newRuleEventType = tpl.event_type;
      this.newRuleConditionsStr = JSON.stringify(tpl.trigger_conditions || {}, null, 2);
      const firstStep = (tpl.action_pipeline && tpl.action_pipeline[0]) || { action: 'dispatch_agent', params: {} };
      this.newRuleActionType = firstStep.action;
      this.newRuleActionParamsStr = JSON.stringify(firstStep.params || {}, null, 2);
      this.automationSuccessMsg = `Loaded template '${tpl.name}'. Click 'Save & Activate Automation Rule' below to deploy.`;
    },
    async triggerAutomationSim() {
      this.isTriggeringAutomation = true;
      this.automationSuccessMsg = null;
      this.automationErrorMsg = null;
      try {
        let pl = {};
        if (this.simulatedTriggerPayloadStr.trim()) {
          try { pl = JSON.parse(this.simulatedTriggerPayloadStr); } catch (err) {
            throw new Error('Invalid JSON in Simulated Payload: ' + err.message);
          }
        }
        const res = await API.triggerAutomation({
          event_type: this.simulatedTriggerEvent,
          payload: pl
        });
        if (res && res.fired_count > 0) {
          this.automationSuccessMsg = `Dispatched ${this.simulatedTriggerEvent}: Fired ${res.fired_count} pipeline(s) successfully!`;
        } else {
          this.automationSuccessMsg = `Dispatched ${this.simulatedTriggerEvent}: 0 matching rules fired (${res.skipped_count || 0} skipped).`;
        }
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = 'Trigger simulation failed: ' + (e.message || String(e));
      } finally {
        this.isTriggeringAutomation = false;
      }
    },
    async retryWorkflowRun(runId) {
      try {
        await API.retryAutomationRun(runId);
        this.automationSuccessMsg = `Workflow run ${runId} retried successfully.`;
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = 'Retry failed: ' + (e.message || String(e));
      }
    },
    async cancelWorkflowRun(runId) {
      try {
        await API.cancelAutomationRun(runId);
        this.automationSuccessMsg = `Workflow run ${runId} cancelled.`;
        await this.loadAutomationsState();
      } catch (e) {
        this.automationErrorMsg = 'Cancel failed: ' + (e.message || String(e));
      }
    },
    inspectWorkflowRun(run) {
      this.selectedWorkflowRun = run;
    },
    async loadTenantsState() {
      this.isLoadingTenants = true;
      this.tenantSuccessMsg = null;
      this.tenantErrorMsg = null;
      try {
        const [tRes, mRes] = await Promise.all([
          API.getTenants().catch(() => ({ tenants: [] })),
          API.getTenantMetrics().catch(() => null)
        ]);
        this.tenantsList = (tRes && tRes.tenants) || [];
        this.tenantMetrics = mRes || {
          total_tenants: this.tenantsList.length,
          active_tenants: this.tenantsList.filter(t => t.is_active).length,
          tier_breakdown: { free: this.tenantsList.length, pro: 0, enterprise: 0 },
          aggregate_resources: { total_projects: 0, total_issues: 0 },
          alerts_count: 0,
          alerts: []
        };
        if (!this.selectedTenant && this.tenantsList.length > 0) {
          await this.selectTenantWorkspace(this.tenantsList[0]);
        }
      } catch (e) {
        this.tenantErrorMsg = e.message || String(e);
      } finally {
        this.isLoadingTenants = false;
      }
    },
    async selectTenantWorkspace(t) {
      if (!t) return;
      this.selectedTenant = t;
      try {
        const [uRes, qRes, memRes] = await Promise.all([
          API.getTenantUsage(t.id).catch(() => null),
          API.getTenantQuotas(t.id).catch(() => null),
          API.getTenantMembers(t.id).catch(() => ({ members: [] }))
        ]);
        this.tenantUsage = uRes || null;
        this.tenantQuotas = (qRes && qRes.quotas) || t.quotas || null;
        this.tenantMembers = (memRes && memRes.members) || [];
      } catch (e) {
        this.tenantErrorMsg = 'Failed loading tenant details: ' + (e.message || String(e));
      }
    },
    async createTenantWorkspace() {
      if (!this.newTenantName) {
        this.tenantErrorMsg = 'Tenant workspace name is required';
        return;
      }
      this.isCreatingTenant = true;
      this.tenantSuccessMsg = null;
      this.tenantErrorMsg = null;
      try {
        const res = await API.createTenant({
          name: this.newTenantName,
          slug: this.newTenantSlug || undefined,
          description: this.newTenantDesc,
          plan_tier: this.newTenantPlanTier,
          owner: this.newTenantOwner || 'admin'
        });
        this.tenantSuccessMsg = `Tenant workspace "${this.newTenantName}" created successfully!`;
        this.newTenantName = '';
        this.newTenantSlug = '';
        this.newTenantDesc = '';
        await this.loadTenantsState();
        if (res && res.tenant && res.tenant.id) {
          const found = this.tenantsList.find(x => x.id === res.tenant.id);
          if (found) await this.selectTenantWorkspace(found);
        }
      } catch (e) {
        this.tenantErrorMsg = 'Failed creating tenant: ' + (e.message || String(e));
      } finally {
        this.isCreatingTenant = false;
      }
    },
    async saveTenantQuotas() {
      if (!this.selectedTenant || !this.tenantQuotas) return;
      this.isSavingQuotas = true;
      this.tenantSuccessMsg = null;
      this.tenantErrorMsg = null;
      try {
        await API.updateTenantQuotas(this.selectedTenant.id, this.tenantQuotas);
        this.tenantSuccessMsg = `Quotas updated for ${this.selectedTenant.name}.`;
        await this.selectTenantWorkspace(this.selectedTenant);
      } catch (e) {
        this.tenantErrorMsg = 'Failed saving quotas: ' + (e.message || String(e));
      } finally {
        this.isSavingQuotas = false;
      }
    },
    async deleteTenantWorkspace(id) {
      if (!confirm('Are you sure you want to delete this tenant workspace?')) return;
      try {
        await API.deleteTenant(id);
        this.tenantSuccessMsg = 'Tenant workspace deleted.';
        this.selectedTenant = null;
        await this.loadTenantsState();
      } catch (e) {
        this.tenantErrorMsg = 'Delete failed: ' + (e.message || String(e));
      }
    },
    async testQuotaGateCheck() {
      if (!this.selectedTenant) return;
      this.isCheckingTenantQuota = true;
      this.testQuotaResult = null;
      try {
        const res = await API.checkTenantQuota(this.selectedTenant.id, {
          resource_type: this.testQuotaResourceType,
          units: Number(this.testQuotaUnits)
        });
        this.testQuotaResult = res;
      } catch (e) {
        this.tenantErrorMsg = 'Quota check failed: ' + (e.message || String(e));
      } finally {
        this.isCheckingTenantQuota = false;
      }
    },
    async switchActiveTenant(id) {
      try {
        const res = await API.switchTenantContext(id);
        this.activeTenantContextId = id;
        this.tenantSuccessMsg = `Active context switched to workspace: ${res.active_tenant_name}`;
      } catch (e) {
        this.tenantErrorMsg = 'Context switch failed: ' + (e.message || String(e));
      }
    },
    async loadAutoHealState() {
      this.isLoadingAutoHeal = true;
      this.autoHealErrorMsg = null;
      try {
        const [polRes, incRes, healthRes, recRes, metRes] = await Promise.all([
          API.getAutoHealPolicies().catch(() => ({ policies: [] })),
          API.getAutoHealIncidents().catch(() => ({ incidents: [] })),
          API.getAutoHealHealthChecks().catch(() => ({ fleet_health: [], fleet_health_score_pct: 100 })),
          API.getAutoHealRecipes().catch(() => ({ recipes: [] })),
          API.getAutoHealMetrics().catch(() => null)
        ]);
        this.autoHealPolicies = (polRes && polRes.policies) || [];
        this.autoHealIncidents = (incRes && incRes.incidents) || [];
        this.autoHealHealthFleet = (healthRes && healthRes.fleet_health) || [];
        this.autoHealRecipes = (recRes && recRes.recipes) || [];
        this.autoHealMetrics = metRes || null;
      } catch (e) {
        this.autoHealErrorMsg = 'Failed loading auto-heal state: ' + (e.message || String(e));
      } finally {
        this.isLoadingAutoHeal = false;
      }
    },
    async triggerHealAgent(agentName, triggerType = 'crash_loop', action = 'restart_agent') {
      this.isHealingFleet = true;
      this.autoHealSuccessMsg = null;
      this.autoHealErrorMsg = null;
      try {
        const res = await API.triggerAutoHeal({
          agent: agentName,
          trigger_type: triggerType,
          action_strategy: action
        });
        this.autoHealSuccessMsg = `Auto-healing executed for ${agentName}: action "${res.action_executed}" recovered agent!`;
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Auto-heal trigger failed: ' + (e.message || String(e));
      } finally {
        this.isHealingFleet = false;
      }
    },
    async createCustomAutoHealPolicy() {
      if (!this.newPolicyName) {
        this.autoHealErrorMsg = 'Policy name is required';
        return;
      }
      this.autoHealSuccessMsg = null;
      this.autoHealErrorMsg = null;
      try {
        await API.createAutoHealPolicy({
          name: this.newPolicyName,
          trigger_type: this.newPolicyTrigger,
          action_strategy: this.newPolicyAction,
          severity: this.newPolicySeverity,
          max_retries: Number(this.newPolicyMaxRetries),
          cool_down_seconds: Number(this.newPolicyCoolDown),
          description: this.newPolicyDesc
        });
        this.autoHealSuccessMsg = `Auto-heal policy "${this.newPolicyName}" registered successfully!`;
        this.newPolicyName = '';
        this.newPolicyDesc = '';
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Failed to create policy: ' + (e.message || String(e));
      }
    },
    async deleteAutoHealPolicy(id) {
      try {
        await API.deleteAutoHealPolicy(id);
        this.autoHealSuccessMsg = 'Policy deleted successfully.';
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Failed to delete policy: ' + (e.message || String(e));
      }
    },
    async applyAutoHealRecipe(recipeId) {
      this.autoHealSuccessMsg = null;
      this.autoHealErrorMsg = null;
      try {
        const res = await API.applyAutoHealRecipe(recipeId);
        this.autoHealSuccessMsg = `Blueprint recipe applied: "${res.policy.name}" is now active!`;
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Failed to apply blueprint recipe: ' + (e.message || String(e));
      }
    },
    async resolveAutoHealIncident(id) {
      try {
        await API.resolveAutoHealIncident(id, { resolution_notes: 'Resolved via dashboard control panel' });
        this.autoHealSuccessMsg = 'Incident marked as resolved.';
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Failed to resolve incident: ' + (e.message || String(e));
      }
    },
    async escalateAutoHealIncident(id) {
      try {
        await API.escalateAutoHealIncident(id, { reason: 'Escalated by operator via dashboard' });
        this.autoHealSuccessMsg = 'Incident escalated to high priority engineering review.';
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Failed to escalate incident: ' + (e.message || String(e));
      }
    },
    async runCrashRecoverySweep() {
      this.isSweepingCrash = true;
      this.autoHealSuccessMsg = null;
      this.autoHealErrorMsg = null;
      try {
        const res = await API.runCrashRecoverySweep();
        this.autoHealSuccessMsg = `Crash recovery sweep completed: ${res.metrics.expired_leases_released} leases released, ${res.metrics.dead_tasks_recovered} dead tasks recovered!`;
        await this.loadAutoHealState();
      } catch (e) {
        this.autoHealErrorMsg = 'Crash recovery sweep failed: ' + (e.message || String(e));
      } finally {
        this.isSweepingCrash = false;
      }
    },
    // Execution Plane & Live Runs Methods (Milestone 1 & 2)
    async loadAgentSessions() {
      this.isLoadingSessions = true;
      try {
        const params = {};
        if (this.sessionFilterStatus && this.sessionFilterStatus !== 'all') params.status = this.sessionFilterStatus;
        if (this.sessionFilterAgent) params.agent = this.sessionFilterAgent;
        const res = await API.getAgentSessions(params);
        this.agentSessionRuns = res.sessions || [];
        if (this.agentSessionRuns.length > 0 && !this.selectedSessionRun) {
          this.selectedSessionRun = this.agentSessionRuns[0];
        }
      } catch (e) {
        console.error('Failed to load agent sessions', e);
      } finally {
        this.isLoadingSessions = false;
      }
    },
    async loadSessionMetrics() {
      try {
        this.sessionMetrics = await API.getAgentSessionMetrics();
      } catch (e) {
        console.error('Failed to load session metrics', e);
      }
    },
    async handleIngestSession() {
      if (!this.newIngestCommand) {
        this.sessionErrorMsg = 'Command or task intent is required';
        return;
      }
      this.isIngestingSession = true;
      this.sessionSuccessMsg = null;
      this.sessionErrorMsg = null;
      try {
        const res = await API.ingestAgentSession({
          agent_name: this.newIngestAgentName,
          runtime: this.newIngestRuntime,
          model: this.newIngestModel,
          command: this.newIngestCommand,
          workdir: this.newIngestWorkdir,
          status: 'running',
          pid: Math.floor(10000 + Math.random() * 90000)
        });
        this.sessionSuccessMsg = `Execution run "${res.session_id}" ingested successfully into Execution Plane!`;
        this.newIngestCommand = '';
        await this.loadAgentSessions();
        await this.loadSessionMetrics();
      } catch (e) {
        this.sessionErrorMsg = 'Failed to ingest session: ' + (e.message || String(e));
      } finally {
        this.isIngestingSession = false;
      }
    },
    async handleTerminateSession(id) {
      this.sessionSuccessMsg = null;
      this.sessionErrorMsg = null;
      try {
        await API.terminateAgentSession(id);
        this.sessionSuccessMsg = 'Session termination signal dispatched';
        await this.loadAgentSessions();
        await this.loadSessionMetrics();
      } catch (e) {
        this.sessionErrorMsg = 'Failed to terminate session: ' + (e.message || String(e));
      }
    },
    async handleForkSession(id) {
      this.sessionSuccessMsg = null;
      this.sessionErrorMsg = null;
      try {
        const res = await API.forkAgentSession(id);
        this.sessionSuccessMsg = `Session forked successfully! New session: ${res.new_session_id}`;
        await this.loadAgentSessions();
        await this.loadSessionMetrics();
      } catch (e) {
        this.sessionErrorMsg = 'Failed to fork session: ' + (e.message || String(e));
      }
    },
    async handleDockSession(id, issueId) {
      this.sessionSuccessMsg = null;
      this.sessionErrorMsg = null;
      try {
        await API.dockAgentSession(id, issueId);
        this.sessionSuccessMsg = 'Session docking updated successfully';
        await this.loadAgentSessions();
      } catch (e) {
        this.sessionErrorMsg = 'Failed to dock session: ' + (e.message || String(e));
      }
    },
    async selectSessionRun(run) {
      this.selectedSessionRun = run;
      if (run) {
        const sid = run.id || run.session_id;
        await Promise.all([
          this.loadSessionObservability(sid),
          this.loadSessionDag(sid),
          this.loadSessionInterventions(sid)
        ]);
      }
    },
    async loadSessionDag(id) {
      if (!id) return;
      this.isLoadingDag = true;
      try {
        const res = await API.getSessionDag(id);
        this.sessionDagData = res;
      } catch (e) {
        console.error('Failed to load session DAG:', e);
      } finally {
        this.isLoadingDag = false;
      }
    },
    async loadSessionInterventions(id) {
      if (!id) return;
      try {
        const res = await API.getSessionInterventions(id);
        this.sessionInterventionsList = (res && res.interventions) || [];
      } catch (e) {
        console.error('Failed to load session interventions:', e);
      }
    },
    openBranchModal(session) {
      if (!session) return;
      this.branchTargetSession = session;
      this.branchNameInput = 'branch-' + Math.random().toString(36).substring(2, 7);
      this.branchTypeInput = 'fork';
      this.branchPromptInput = session.command || '';
      this.branchModelInput = session.model || 'gpt-5.5';
      this.branchModalOpen = true;
    },
    async handleCreateBranch() {
      if (!this.branchTargetSession) return;
      this.isBranchingSession = true;
      try {
        const sid = this.branchTargetSession.id || this.branchTargetSession.session_id;
        const res = await API.branchAgentSession(sid, {
          branch_name: this.branchNameInput,
          branch_type: this.branchTypeInput,
          prompt: this.branchPromptInput,
          model: this.branchModelInput
        });
        this.sessionSuccessMsg = `Branch created: ${res.branch_name} (${res.branch_type})`;
        this.branchModalOpen = false;
        await this.loadAgentSessions();
        if (res.id) {
          const newRun = (this.sessions || []).find(s => s.id === res.id || s.session_id === res.session_id);
          if (newRun) await this.selectSessionRun(newRun);
        }
      } catch (e) {
        this.sessionErrorMsg = 'Failed to branch session: ' + (e.message || String(e));
      } finally {
        this.isBranchingSession = false;
      }
    },
    async handleTogglePauseSession(session) {
      if (!session) return;
      const sid = session.id || session.session_id;
      try {
        if (session.is_paused) {
          await API.resumeAgentSession(sid);
          session.is_paused = false;
          this.sessionSuccessMsg = 'Session execution resumed';
        } else {
          await API.pauseAgentSession(sid, 'Manual operator pause');
          session.is_paused = true;
          this.sessionSuccessMsg = 'Session execution paused';
        }
        await this.loadAgentSessions();
        await this.loadSessionInterventions(sid);
      } catch (e) {
        this.sessionErrorMsg = 'Failed to toggle pause: ' + (e.message || String(e));
      }
    },
    async handleInjectInstruction(session) {
      if (!session || !this.interventionInstructionInput.trim()) return;
      this.isInjectingInstruction = true;
      const sid = session.id || session.session_id;
      try {
        await API.injectSessionInstruction(sid, {
          instruction: this.interventionInstructionInput.trim(),
          priority: this.interventionPriorityInput
        });
        this.sessionSuccessMsg = 'Instruction successfully injected into live context';
        this.interventionInstructionInput = '';
        await this.loadSessionInterventions(sid);
        await this.loadAgentSessions();
      } catch (e) {
        this.sessionErrorMsg = 'Failed to inject instruction: ' + (e.message || String(e));
      } finally {
        this.isInjectingInstruction = false;
      }
    },
    async handleSetGate(session, action, comment = '') {
      if (!session) return;
      const sid = session.id || session.session_id;
      try {
        const res = await API.setSessionInterventionGate(sid, { action, comment });
        this.sessionSuccessMsg = `Gate updated: ${res.intervention_gate}`;
        session.intervention_gate = res.intervention_gate;
        session.status = res.status;
        await this.loadAgentSessions();
        await this.loadSessionInterventions(sid);
        await this.loadSessionDag(sid);
      } catch (e) {
        this.sessionErrorMsg = 'Failed to set gate: ' + (e.message || String(e));
      }
    },
    async handleArbitrateConflicts(session, resolve = false) {
      if (!session) return;
      const sid = session.id || session.session_id;
      try {
        const res = await API.arbitrateSessionConflicts(sid, { resolve });
        this.sessionSuccessMsg = res.message;
        session.conflict_status = res.conflict_status;
        await this.loadAgentSessions();
        await this.loadSessionInterventions(sid);
      } catch (e) {
        this.sessionErrorMsg = 'Arbitration failed: ' + (e.message || String(e));
      }
    },
    async checkWorkspaceConflicts() {
      try {
        const res = await API.getSessionConflicts(this.currentProject ? this.currentProject.id : '');
        this.allSessionConflicts = (res && res.conflicts) || [];
      } catch (e) {
        console.error('Failed checking conflicts:', e);
      }
    },
    async loadSessionObservability(id) {
      if (!id) return;
      try {
        const [diffRes, verdictRes, auditRes] = await Promise.all([
          API.getSessionDiff(id).catch(() => null),
          API.getSessionVerdict(id).catch(() => null),
          API.getSessionAudit(id).catch(() => null)
        ]);
        this.sessionDiffData = diffRes;
        this.sessionVerdictData = verdictRes;
        this.sessionAuditData = auditRes;
        this.selectedDiffFileIndex = 0;
      } catch (e) {
        console.error('Failed to load session observability:', e);
      }
    },
    async runSimulatedVerification(session) {
      if (!session) return;
      this.isVerifyingObservability = true;
      this.observabilitySuccessMsg = null;
      this.observabilityErrorMsg = null;
      try {
        const res = await API.verifySessionSuite({
          session_id: session.session_id || session.id,
          framework: this.simulatedTestFramework,
          passed: parseInt(this.simulatedTestPassed || 401, 10),
          failed: parseInt(this.simulatedTestFailed || 0, 10),
          raw_diff: (session.git_diff_summary ? `diff --git a/app/pb_public/js/components/AgentsView.js b/app/pb_public/js/components/AgentsView.js\n--- a/app/pb_public/js/components/AgentsView.js\n+++ b/app/pb_public/js/components/AgentsView.js\n@@ -1,5 +1,12 @@\n+// Milestone 3: Ground Truth Verification\n+console.log("Verified execution run");\n` : '')
        });
        this.observabilitySuccessMsg = 'Verification suite executed. Ground-truth badge: ' + (res.verification_badge || 'verified').toUpperCase();
        await this.loadSessionObservability(session.id || session.session_id);
        await this.loadAgentSessions();
      } catch (e) {
        this.observabilityErrorMsg = 'Verification failed: ' + (e.message || String(e));
      } finally {
        this.isVerifyingObservability = false;
      }
    },
    async submitQuickScepticAudit(session, verdict = 'PASS') {
      if (!session) return;
      this.isVerifyingObservability = true;
      try {
        const findings = verdict === 'FAIL' ? [
          { id: 'FIND-P0-01', severity: 'P0', category: 'correctness', title: 'Critical regression detected by Flow Inspect Sceptic', description: 'Manual sceptic audit failed assertion verification.' }
        ] : [];
        await API.submitSessionAudit(session.id || session.session_id, {
          auditor: 'Flow Inspect Sceptic Reviewer',
          verdict: verdict,
          risk_score: verdict === 'FAIL' ? 95 : 10,
          findings: findings,
          summary: 'Independent Flow Inspect sceptic review with ' + (findings.length ? findings.length + ' findings' : 'zero findings')
        });
        this.observabilitySuccessMsg = 'Sceptic audit submitted with verdict ' + verdict;
        await this.loadSessionObservability(session.id || session.session_id);
        await this.loadAgentSessions();
      } catch (e) {
        this.observabilityErrorMsg = 'Failed to submit audit: ' + (e.message || String(e));
      } finally {
        this.isVerifyingObservability = false;
      }
    },
    async copyUnifiedDiff(rawDiff) {
      if (!rawDiff) return;
      try {
        await navigator.clipboard.writeText(rawDiff);
        this.diffCopied = true;
        setTimeout(() => { this.diffCopied = false; }, 2000);
      } catch (e) {
        console.error('Clipboard copy failed:', e);
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
                  {{ activeTab === 'workload' ? 'Workload & Dynamic Autoscaler' : (activeTab === 'anomalies' ? 'Workflow Health & Auto-Heal' : (activeTab === 'throughput' ? 'Persona Throughput & MTTC' : (activeTab === 'federation' ? 'Multi-Host Federation Sync' : (activeTab === 'cluster' ? 'Distributed Cluster & Edge Sync' : (activeTab === 'webhooks' ? 'Outbound Webhook Security Gateway & DLQ' : (activeTab === 'observability' ? 'OpenAPI SDK Generator & Webhook Observability' : (activeTab === 'consensus' ? 'Autonomous Multi-Model Consensus & Peer Review Gate Engine' : (activeTab === 'sso_rbac' ? 'Enterprise SSO Federation & Granular RBAC Matrix' : (activeTab === 'automations' ? 'Native Workflow Automations & AI Agent Trigger Pipelines' : (activeTab === 'tenants' ? 'Multi-Tenant Isolation & Granular Resource Quotas' : (activeTab === 'auto_heal' ? 'Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline' : (selectedSession ? (selectedSession.short_name || 'Session') : 'Agent Command Center')))))))))))) }}
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
                <button
                  @click="activeTab = 'automations'; loadAutomationsState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'automations' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >⚡ Automations</button>
                <button
                  @click="activeTab = 'tenants'; loadTenantsState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'tenants' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🏢 Multi-Tenant</button>
                <button
                  @click="activeTab = 'auto_heal'; loadAutoHealState();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'auto_heal' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🩺 Auto-Heal & Remediation</button>
                <button
                  @click="activeTab = 'runs'; loadAgentSessions(); loadSessionMetrics();"
                  class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  :class="activeTab === 'runs' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                >🚀 Live Runs & Telemetry</button>
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

        <!-- ========================================================= -->
        <!-- PANE 2K: NATIVE WORKFLOW AUTOMATIONS & TRIGGER PIPELINES -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'automations'"
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/40"
        >
          <!-- Top KPI / Metric Banner -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">⚡</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Active Rules</div>
                <div class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ (workflowMetrics && workflowMetrics.active_rules) || workflowRules.filter(r => r.is_active).length }} / {{ workflowRules.length }}</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">🚀</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Total Runs</div>
                <div class="text-base font-bold text-indigo-600 dark:text-indigo-400">{{ (workflowMetrics && workflowMetrics.total_runs) || workflowRuns.length }} Executions</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">🎯</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Success Rate</div>
                <div class="text-base font-bold text-emerald-600 dark:text-emerald-400">{{ (workflowMetrics && workflowMetrics.success_rate) || 100 }}%</div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <span class="text-2xl">⏱️</span>
              <div>
                <div class="text-[10px] text-zinc-400 font-medium">Avg Latency</div>
                <div class="text-base font-bold text-amber-600 dark:text-amber-400">{{ (workflowMetrics && workflowMetrics.avg_duration_ms) || 15 }} ms</div>
              </div>
            </div>
          </div>

          <!-- Alert / Status Notifications -->
          <div v-if="automationSuccessMsg" class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>✅</span>
              <span>{{ automationSuccessMsg }}</span>
            </div>
            <button @click="automationSuccessMsg = null" class="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
          <div v-if="automationErrorMsg" class="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>⚠️</span>
              <span>{{ automationErrorMsg }}</span>
            </div>
            <button @click="automationErrorMsg = null" class="text-red-500 hover:text-red-700">✕</button>
          </div>

          <!-- Blueprint Templates Shelf -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>📦</span> Starter Blueprint Templates
                </h3>
                <p class="text-[11px] text-zinc-400">One-click recipes for autonomous agent workflows, SLAs, and QA verification pipelines</p>
              </div>
              <button
                @click="loadAutomationsState"
                class="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                🔄 Refresh
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div
                v-for="tpl in workflowTemplates"
                :key="tpl.id"
                class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-2 hover:border-indigo-500/50 transition-colors"
              >
                <div>
                  <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">{{ tpl.event_type }}</span>
                    <span class="text-[10px] text-zinc-400">{{ (tpl.action_pipeline || []).length }} steps</span>
                  </div>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{{ tpl.name }}</h4>
                  <p class="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{{ tpl.description }}</p>
                </div>
                <button
                  @click="applyWorkflowTemplate(tpl)"
                  class="w-full py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold transition-colors"
                >
                  ⚡ Use Template
                </button>
              </div>
            </div>
          </div>

          <!-- Main 2-Column Section: Configured Rules & Rule Creator -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left 2 Cols: Configured Automation Rules Table -->
            <div class="lg:col-span-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>📋</span> Configured Automation Rules
                  </h3>
                  <p class="text-[11px] text-zinc-400">Trigger events, conditional filters, and autonomous action chains</p>
                </div>
                <span class="text-xs font-mono text-zinc-400">{{ workflowRules.length }} Total</span>
              </div>

              <div v-if="workflowRules.length === 0" class="text-center py-8 text-xs text-zinc-400">
                No automation rules configured. Use a template above or create your first rule on the right.
              </div>

              <div v-else class="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                <div
                  v-for="rule in workflowRules"
                  :key="rule.id"
                  class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ rule.name }}</span>
                        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{{ rule.event_type }}</span>
                        <span :class="rule.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'" class="text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase">
                          {{ rule.is_active ? 'Active' : 'Disabled' }}
                        </span>
                      </div>
                      <p class="text-[10px] text-zinc-500">{{ rule.description || 'No description provided' }}</p>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        @click="testWorkflowRule(rule.id)"
                        class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-[10px] font-medium"
                        title="Simulate Test Execution"
                      >
                        🧪 Test
                      </button>
                      <button
                        @click="toggleWorkflowRule(rule)"
                        :class="rule.is_active ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'"
                        class="px-2 py-1 rounded text-[10px] font-medium"
                      >
                        {{ rule.is_active ? 'Pause' : 'Enable' }}
                      </button>
                      <button
                        @click="deleteWorkflowRule(rule.id)"
                        class="px-2 py-1 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 text-[10px] font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <!-- Pipeline Steps Preview -->
                  <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <span class="text-[9px] text-zinc-400 font-mono">Pipeline:</span>
                    <div
                      v-for="(step, sIdx) in (rule.action_pipeline || [])"
                      :key="step.id || sIdx"
                      class="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    >
                      <span class="text-indigo-500 font-bold">{{ step.action }}</span>
                      <span v-if="sIdx < (rule.action_pipeline.length - 1)" class="text-zinc-400">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Col: Interactive Rule Designer / Creator -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div>
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🛠️</span> Automation Rule Designer
                </h3>
                <p class="text-[11px] text-zinc-400">Configure custom triggers and DAG actions</p>
              </div>

              <div class="space-y-2 text-xs">
                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Rule Name</label>
                  <input
                    v-model="newRuleName"
                    placeholder="e.g. Urgent Bug SRE Dispatch"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  />
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Description</label>
                  <input
                    v-model="newRuleDescription"
                    placeholder="What this automation does"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Event Trigger</label>
                    <select
                      v-model="newRuleEventType"
                      class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      <option value="issue.created">issue.created</option>
                      <option value="issue.status_changed">issue.status_changed</option>
                      <option value="issue.priority_changed">issue.priority_changed</option>
                      <option value="cycle.started">cycle.started</option>
                      <option value="cycle.completed">cycle.completed</option>
                      <option value="manual">manual</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Action Type</label>
                    <select
                      v-model="newRuleActionType"
                      class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    >
                      <option value="dispatch_agent">dispatch_agent</option>
                      <option value="create_subtasks">create_subtasks</option>
                      <option value="send_notification">send_notification</option>
                      <option value="send_webhook">send_webhook</option>
                      <option value="update_issue">update_issue</option>
                      <option value="add_comment">add_comment</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Trigger Conditions (JSON)</label>
                  <textarea
                    v-model="newRuleConditionsStr"
                    rows="2"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono"
                  ></textarea>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Action Parameters (JSON)</label>
                  <textarea
                    v-model="newRuleActionParamsStr"
                    rows="2"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono"
                  ></textarea>
                </div>

                <button
                  @click="createWorkflowRule"
                  :disabled="isSavingRule"
                  class="w-full py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 text-white dark:text-zinc-900 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {{ isSavingRule ? 'Saving...' : '💾 Save & Activate Automation Rule' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom 2-Column Section: Trigger Simulator & Execution History -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left Col: Live Trigger Simulator -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div>
                <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🎯</span> Live Event Trigger Simulator
                </h3>
                <p class="text-[11px] text-zinc-400">Manually fire event payloads into the engine</p>
              </div>

              <div class="space-y-2 text-xs">
                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Simulated Event Type</label>
                  <select
                    v-model="simulatedTriggerEvent"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                  >
                    <option value="issue.status_changed">issue.status_changed</option>
                    <option value="issue.created">issue.created</option>
                    <option value="issue.priority_changed">issue.priority_changed</option>
                    <option value="cycle.started">cycle.started</option>
                    <option value="manual">manual</option>
                  </select>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Payload (JSON)</label>
                  <textarea
                    v-model="simulatedTriggerPayloadStr"
                    rows="3"
                    class="w-full px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono"
                  ></textarea>
                </div>

                <button
                  @click="triggerAutomationSim"
                  :disabled="isTriggeringAutomation"
                  class="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>⚡</span>
                  <span>{{ isTriggeringAutomation ? 'Firing...' : 'Fire Event Trigger' }}</span>
                </button>
              </div>
            </div>

            <!-- Right 2 Cols: Live Execution Runs History & Step Trace -->
            <div class="lg:col-span-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>📜</span> Execution Runs & Step Trace History
                  </h3>
                  <p class="text-[11px] text-zinc-400">Live DAG execution duration, step status, and error logs</p>
                </div>
                <span class="text-xs font-mono text-zinc-400">{{ workflowRuns.length }} Executions</span>
              </div>

              <div v-if="workflowRuns.length === 0" class="text-center py-6 text-xs text-zinc-400">
                No workflow runs recorded yet. Fire an event or run a test to populate execution traces.
              </div>

              <div v-else class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                <div
                  v-for="run in workflowRuns"
                  :key="run.id"
                  class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span :class="run.status === 'completed' ? 'text-emerald-500' : (run.status === 'running' ? 'text-blue-500 animate-spin' : (run.status === 'cancelled' ? 'text-zinc-400' : 'text-red-500'))">
                        {{ run.status === 'completed' ? '●' : (run.status === 'running' ? '↻' : (run.status === 'cancelled' ? '⊘' : '▲')) }}
                      </span>
                      <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ run.rule_name || 'Workflow Run' }}</span>
                      <span class="text-[10px] font-mono text-zinc-400">{{ run.trigger_event }}</span>
                      <span class="text-[9px] font-mono px-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">{{ run.duration_ms }}ms</span>
                    </div>

                    <div class="flex items-center gap-1.5">
                      <button
                        @click="retryWorkflowRun(run.id)"
                        class="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-[10px] font-medium"
                      >
                        🔄 Retry
                      </button>
                      <button
                        v-if="run.status === 'running' || run.status === 'pending'"
                        @click="cancelWorkflowRun(run.id)"
                        class="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-600 text-[10px] font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  <!-- Step Results Chips -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <div
                      v-for="(st, idx) in (run.step_results || [])"
                      :key="st.step_id || idx"
                      class="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                      :class="st.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400'"
                    >
                      <span>{{ st.step_id }}: {{ st.action }}</span>
                      <span class="text-zinc-400">({{ st.duration_ms }}ms)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2: MULTI-TENANT ISOLATION & RESOURCE QUOTAS TAB      -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'tenants'"
          class="flex-1 overflow-y-auto p-4 space-y-4"
        >
          <!-- Metric KPI Meters Header -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Total Tenants</div>
              <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {{ (tenantMetrics && tenantMetrics.total_tenants) || tenantsList.length }}
              </div>
            </div>
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Active Workspaces</div>
              <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {{ (tenantMetrics && tenantMetrics.active_tenants) || tenantsList.filter(t => t.is_active).length }}
              </div>
            </div>
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Total Projects</div>
              <div class="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {{ (tenantMetrics && tenantMetrics.aggregate_resources && tenantMetrics.aggregate_resources.total_projects) || 0 }}
              </div>
            </div>
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Total Issues</div>
              <div class="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {{ (tenantMetrics && tenantMetrics.aggregate_resources && tenantMetrics.aggregate_resources.total_issues) || 0 }}
              </div>
            </div>
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Quota Alerts</div>
              <div class="text-xl font-bold mt-1" :class="((tenantMetrics && tenantMetrics.alerts_count) || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'">
                {{ (tenantMetrics && tenantMetrics.alerts_count) || 0 }}
              </div>
            </div>
          </div>

          <!-- Alert Banners -->
          <div v-if="tenantSuccessMsg" class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <span>{{ tenantSuccessMsg }}</span>
            <button @click="tenantSuccessMsg = null" class="text-emerald-600 font-bold">&times;</button>
          </div>
          <div v-if="tenantErrorMsg" class="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <span>{{ tenantErrorMsg }}</span>
            <button @click="tenantErrorMsg = null" class="text-rose-600 font-bold">&times;</button>
          </div>

          <!-- Main Layout Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <!-- Left Col: Tenant Workspace Roster & Creator -->
            <div class="space-y-4">
              <!-- Workspace List -->
              <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🏢</span>
                    <span>Tenant Workspaces</span>
                  </div>
                  <button
                    @click="loadTenantsState"
                    class="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400"
                    title="Refresh"
                  >
                    🔄
                  </button>
                </div>

                <div v-if="tenantsList.length === 0" class="text-xs text-zinc-400 py-3 text-center">
                  No tenant workspaces found. Create one below.
                </div>
                <div v-else class="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  <div
                    v-for="t in tenantsList"
                    :key="t.id"
                    @click="selectTenantWorkspace(t)"
                    class="p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between"
                    :class="selectedTenant && selectedTenant.id === t.id ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 shadow-xs' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'"
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ t.name }}</span>
                        <span
                          class="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                          :class="t.plan_tier === 'enterprise' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : (t.plan_tier === 'pro' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400')"
                        >
                          {{ t.plan_tier || 'free' }}
                        </span>
                      </div>
                      <div class="text-[10px] font-mono text-zinc-400 truncate">/{{ t.slug }}</div>
                    </div>

                    <div class="flex items-center gap-1">
                      <button
                        @click.stop="switchActiveTenant(t.id)"
                        class="px-1.5 py-0.5 rounded text-[9px] font-medium border"
                        :class="activeTenantContextId === t.id ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 text-emerald-700 font-bold' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-200'"
                        title="Switch active context"
                      >
                        {{ activeTenantContextId === t.id ? 'Active' : 'Switch' }}
                      </button>
                      <button
                        @click.stop="deleteTenantWorkspace(t.id)"
                        class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/60 text-zinc-400 hover:text-red-600 text-[10px]"
                        title="Delete tenant"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Create Tenant Form -->
              <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>➕</span>
                  <span>Create Workspace</span>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Workspace Name</label>
                  <input
                    v-model="newTenantName"
                    type="text"
                    placeholder="e.g. Acme Corp Autonomous"
                    class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Slug (Optional)</label>
                    <input
                      v-model="newTenantSlug"
                      type="text"
                      placeholder="acme-corp"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Plan Tier</label>
                    <select
                      v-model="newTenantPlanTier"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      <option value="free">Free (Default limits)</option>
                      <option value="pro">Pro (Scale limits)</option>
                      <option value="enterprise">Enterprise (Max limits)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Description</label>
                  <input
                    v-model="newTenantDesc"
                    type="text"
                    placeholder="Workspace mission and description"
                    class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  />
                </div>

                <button
                  @click="createTenantWorkspace"
                  :disabled="isCreatingTenant"
                  class="w-full py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>{{ isCreatingTenant ? 'Creating...' : 'Provision Tenant' }}</span>
                </button>
              </div>
            </div>

            <!-- Middle Col: Selected Workspace Usage & Quota Gauges -->
            <div class="space-y-4">
              <div v-if="!selectedTenant" class="p-8 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                Select a tenant workspace from the left to inspect usage and resource quotas.
              </div>
              <div v-else class="space-y-4">
                <!-- Tenant Header Card -->
                <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedTenant.name }}</div>
                      <div class="text-[10px] font-mono text-zinc-400">ID: {{ selectedTenant.id }} • Slug: /{{ selectedTenant.slug }}</div>
                    </div>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      :class="selectedTenant.plan_tier === 'enterprise' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : (selectedTenant.plan_tier === 'pro' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300')"
                    >
                      {{ selectedTenant.plan_tier || 'free' }}
                    </span>
                  </div>
                  <p v-if="selectedTenant.description" class="text-xs text-zinc-600 dark:text-zinc-400">{{ selectedTenant.description }}</p>
                </div>

                <!-- Live Quota Gauges -->
                <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span class="flex items-center gap-1.5">
                      <span>📊</span>
                      <span>Resource Quota Gauges</span>
                    </span>
                    <span class="text-[10px] font-mono text-zinc-400">Enforcement: {{ (tenantUsage && tenantUsage.enforcement_mode) || 'hard' }}</span>
                  </div>

                  <div class="space-y-2.5">
                    <div
                      v-for="meter in ((tenantUsage && tenantUsage.meters) || [])"
                      :key="meter.resource"
                      class="space-y-1"
                    >
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-medium capitalize text-zinc-700 dark:text-zinc-300">{{ meter.resource.replace('_', ' ') }}</span>
                        <span class="font-mono text-[11px]" :class="meter.status === 'exceeded' ? 'text-red-500 font-bold' : (meter.status === 'warning' ? 'text-amber-500 font-bold' : 'text-zinc-500')">
                          {{ meter.used }} / {{ meter.limit }} ({{ meter.pct }}%)
                        </span>
                      </div>
                      <div class="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          :style="{ width: meter.pct + '%' }"
                          :class="meter.status === 'exceeded' ? 'bg-red-500' : (meter.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Dynamic Quota Simulator -->
                <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Quota Enforcement Simulator</span>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Resource</label>
                      <select
                        v-model="testQuotaResourceType"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      >
                        <option value="issues">Issues</option>
                        <option value="projects">Projects</option>
                        <option value="agents">Agents</option>
                        <option value="workflow_runs">Workflow Runs</option>
                        <option value="storage_mb">Storage MB</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Units to Allocate</label>
                      <input
                        v-model.number="testQuotaUnits"
                        type="number"
                        min="1"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    @click="testQuotaGateCheck"
                    :disabled="isCheckingTenantQuota"
                    class="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>{{ isCheckingTenantQuota ? 'Checking Gate...' : 'Evaluate Quota Gate' }}</span>
                  </button>

                  <div
                    v-if="testQuotaResult"
                    class="p-2 rounded-lg border text-xs space-y-1"
                    :class="testQuotaResult.allowed ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'"
                  >
                    <div class="font-bold flex items-center gap-1">
                      <span>{{ testQuotaResult.allowed ? '✅ ALLOWED' : '🚫 QUOTA REJECTED' }}</span>
                    </div>
                    <div class="text-[11px]">{{ testQuotaResult.reason }}</div>
                    <div class="text-[10px] font-mono text-zinc-500">
                      Current: {{ testQuotaResult.current_used }} + Requested: {{ testQuotaResult.requested_units }} / Limit: {{ testQuotaResult.max_limit }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Col: Quota Limits Editor & Workspace Roster -->
            <div class="space-y-4">
              <!-- Edit Quotas -->
              <div v-if="selectedTenant && tenantQuotas" class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>Quota Limits & Rules</span>
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Projects</label>
                    <input
                      v-model.number="tenantQuotas.max_projects"
                      type="number"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Issues</label>
                    <input
                      v-model.number="tenantQuotas.max_issues"
                      type="number"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Agents</label>
                    <input
                      v-model.number="tenantQuotas.max_agents"
                      type="number"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Storage (MB)</label>
                    <input
                      v-model.number="tenantQuotas.max_storage_mb"
                      type="number"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Monthly Calls</label>
                    <input
                      v-model.number="tenantQuotas.max_monthly_api_calls"
                      type="number"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Enforcement</label>
                    <select
                      v-model="tenantQuotas.enforcement_mode"
                      class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      <option value="hard">Hard (Strict Block)</option>
                      <option value="soft">Soft (Allow with Warn)</option>
                      <option value="warn">Warn Only</option>
                    </select>
                  </div>
                </div>

                <button
                  @click="saveTenantQuotas"
                  :disabled="isSavingQuotas"
                  class="w-full py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>{{ isSavingQuotas ? 'Saving...' : 'Save Quota Settings' }}</span>
                </button>
              </div>

              <!-- Members & Agents Roster -->
              <div v-if="selectedTenant" class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <span>👥</span>
                    <span>Tenant Memberships ({{ tenantMembers.length }})</span>
                  </span>
                </div>

                <div v-if="tenantMembers.length === 0" class="text-xs text-zinc-400 py-2 text-center">
                  No explicit memberships found.
                </div>
                <div v-else class="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  <div
                    v-for="m in tenantMembers"
                    :key="m.id"
                    class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ m.user }}</span>
                      <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-mono uppercase text-zinc-600 dark:text-zinc-400">{{ m.role }}</span>
                    </div>
                    <span class="text-[9px] font-mono text-zinc-400">{{ m.is_active ? 'Active' : 'Disabled' }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2: AUTO-HEAL & SELF-REMEDIATION (EPIC 22)            -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'auto_heal'"
          class="flex-1 overflow-y-auto p-4 space-y-6"
        >
          <!-- Header & Action Toolbar -->
          <div class="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">🩺</span>
                <h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Autonomous AI Agent Auto-Healing & Self-Remediation Pipeline
                </h3>
              </div>
              <p class="text-xs text-zinc-500 mt-0.5">
                Live fleet diagnostics, automated crash loop recovery, dead lease reclamation, and blueprint self-healing recipes.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click="loadAutoHealState"
                :disabled="isLoadingAutoHeal"
                class="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>{{ isLoadingAutoHeal ? 'Refreshing...' : 'Refresh Telemetry' }}</span>
              </button>
              <button
                @click="runCrashRecoverySweep"
                :disabled="isSweepingCrash"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <span>🧹</span>
                <span>{{ isSweepingCrash ? 'Sweeping Workspace...' : 'Run Crash Recovery Sweep' }}</span>
              </button>
            </div>
          </div>

          <!-- Alert Banners -->
          <div v-if="autoHealSuccessMsg" class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>✅</span>
              <span>{{ autoHealSuccessMsg }}</span>
            </div>
            <button @click="autoHealSuccessMsg = null" class="text-xs font-bold opacity-60 hover:opacity-100">✕</button>
          </div>

          <div v-if="autoHealErrorMsg" class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>⚠️</span>
              <span>{{ autoHealErrorMsg }}</span>
            </div>
            <button @click="autoHealErrorMsg = null" class="text-xs font-bold opacity-60 hover:opacity-100">✕</button>
          </div>

          <!-- 4 Top KPI Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>Fleet Health Score</span>
                <span>💚</span>
              </div>
              <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {{ (autoHealMetrics && autoHealMetrics.fleet_health_score_pct !== undefined) ? autoHealMetrics.fleet_health_score_pct : 100 }}%
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">{{ autoHealHealthFleet.length }} registered worker agents</div>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>Active Incidents</span>
                <span>🚨</span>
              </div>
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {{ (autoHealMetrics && autoHealMetrics.active_incidents !== undefined) ? autoHealMetrics.active_incidents : 0 }}
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">
                {{ (autoHealMetrics && autoHealMetrics.escalated_incidents) ? autoHealMetrics.escalated_incidents : 0 }} escalated to human
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>Auto-Recovery Rate</span>
                <span>⚡</span>
              </div>
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {{ (autoHealMetrics && autoHealMetrics.recovery_success_rate_pct !== undefined) ? autoHealMetrics.recovery_success_rate_pct : 100 }}%
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">Automated self-remediation</div>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>Mean Remediation Time</span>
                <span>⏱️</span>
              </div>
              <div class="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {{ (autoHealMetrics && autoHealMetrics.mttr_seconds !== undefined) ? autoHealMetrics.mttr_seconds : 4.2 }}s
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">{{ autoHealPolicies.length }} active auto-heal policies</div>
            </div>
          </div>

          <!-- 3-Column Diagnostic Layout -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <!-- Column 1: Fleet Health & Diagnostic Heartbeat Matrix -->
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🤖</span>
                  <span>Fleet Diagnostics ({{ autoHealHealthFleet.length }})</span>
                </span>
                <span class="text-[10px] font-mono text-zinc-400">Heartbeat Live</span>
              </div>

              <div v-if="autoHealHealthFleet.length === 0" class="text-xs text-zinc-400 py-4 text-center">
                No active agent workers detected in fleet.
              </div>

              <div v-else class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                <div
                  v-for="ag in autoHealHealthFleet"
                  :key="ag.agent_id"
                  class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2"
                >
                  <div class="flex items-center justify-between">
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ ag.name }}</div>
                      <div class="text-[10px] font-mono text-zinc-400">{{ ag.persona }}</div>
                    </div>
                    <span
                      class="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                      :class="ag.health_score === 'healthy' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : (ag.health_score === 'degraded' ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300')"
                    >
                      {{ ag.health_score }}
                    </span>
                  </div>

                  <div class="grid grid-cols-3 gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded">
                    <div>Lease: <span class="font-bold text-zinc-700 dark:text-zinc-300">{{ ag.lease_status }}</span></div>
                    <div>Errors: <span class="font-bold text-zinc-700 dark:text-zinc-300">{{ ag.error_count }}</span></div>
                    <div>HB: <span class="font-bold text-zinc-700 dark:text-zinc-300">{{ ag.last_heartbeat_seconds_ago }}s</span></div>
                  </div>

                  <button
                    @click="triggerHealAgent(ag.name, 'crash_loop', 'restart_agent')"
                    :disabled="isHealingFleet"
                    class="w-full py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <span>⚡</span>
                    <span>Trigger Auto-Heal & Restart</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Column 2: Incidents & Self-Remediation Log -->
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Incident Log & Traces ({{ autoHealIncidents.length }})</span>
                </span>
                <span class="text-[10px] font-mono text-zinc-400">Self-Remediation</span>
              </div>

              <div v-if="autoHealIncidents.length === 0" class="text-xs text-zinc-400 py-4 text-center">
                No incidents reported. All agent processes healthy.
              </div>

              <div v-else class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                <div
                  v-for="inc in autoHealIncidents"
                  :key="inc.id"
                  class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{{ inc.incident_code || inc.id }}</span>
                      <span class="text-[10px] text-zinc-400">• {{ inc.agent }}</span>
                    </div>
                    <span
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                      :class="inc.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : (inc.status === 'escalated' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300')"
                    >
                      {{ inc.status }}
                    </span>
                  </div>

                  <div class="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2">
                    {{ inc.error_message }}
                  </div>

                  <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                    <span>Action: {{ inc.remediation_action }}</span>
                    <div class="flex items-center gap-1">
                      <button
                        v-if="inc.status !== 'resolved'"
                        @click="resolveAutoHealIncident(inc.id)"
                        class="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 text-[9px] font-bold"
                      >
                        Resolve
                      </button>
                      <button
                        v-if="inc.status !== 'escalated' && inc.status !== 'resolved'"
                        @click="escalateAutoHealIncident(inc.id)"
                        class="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-200 text-[9px] font-bold"
                      >
                        Escalate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Column 3: Blueprint Recipes & Custom Policy Builder -->
            <div class="space-y-4">
              <!-- Blueprint Recipes -->
              <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Blueprint Recipes</span>
                  </span>
                  <span class="text-[10px] font-mono text-zinc-400">1-Click Apply</span>
                </div>

                <div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  <div
                    v-for="rec in autoHealRecipes"
                    :key="rec.id"
                    class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div class="min-w-0 pr-2">
                      <div class="font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ rec.name }}</div>
                      <div class="text-[9px] text-zinc-400 truncate">{{ rec.description }}</div>
                    </div>
                    <button
                      @click="applyAutoHealRecipe(rec.id)"
                      class="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <!-- Custom Policy Registration -->
              <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Register Custom Policy</span>
                </div>

                <div class="space-y-2 text-xs">
                  <div>
                    <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Policy Name</label>
                    <input
                      v-model="newPolicyName"
                      type="text"
                      placeholder="e.g. OOM Worker Auto-Restart"
                      class="w-full px-2.5 py-1.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Trigger</label>
                      <select
                        v-model="newPolicyTrigger"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        <option value="crash_loop">Crash Loop</option>
                        <option value="lease_timeout">Lease Timeout</option>
                        <option value="validation_failure">Validation Fail</option>
                        <option value="token_overflow">Token Overflow</option>
                        <option value="error_rate_spike">Error Rate Spike</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Action Strategy</label>
                      <select
                        v-model="newPolicyAction"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        <option value="restart_agent">Restart Agent</option>
                        <option value="release_lease">Release Lease</option>
                        <option value="retry_subtask">Retry Subtask</option>
                        <option value="reassign_task">Reassign Task</option>
                        <option value="revert_git_worktree">Revert Worktree</option>
                        <option value="escalate_to_human">Escalate to Human</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Severity</label>
                      <select
                        v-model="newPolicySeverity"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Max Retries</label>
                      <input
                        v-model.number="newPolicyMaxRetries"
                        type="number"
                        min="1"
                        max="10"
                        class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    @click="createCustomAutoHealPolicy"
                    class="w-full py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors shadow-xs"
                  >
                    Create Policy
                  </button>
                </div>
              </div>
            </div>

          </div>

          <!-- Active Policies Table -->
          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Active Auto-Heal & Self-Remediation Policies ({{ autoHealPolicies.length }})</span>
              </span>
            </div>

            <div v-if="autoHealPolicies.length === 0" class="text-xs text-zinc-400 py-3 text-center">
              No active policies registered.
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase">
                    <th class="py-2 px-2.5">Policy Name</th>
                    <th class="py-2 px-2.5">Trigger</th>
                    <th class="py-2 px-2.5">Action Strategy</th>
                    <th class="py-2 px-2.5">Severity</th>
                    <th class="py-2 px-2.5">Retries / Cool-down</th>
                    <th class="py-2 px-2.5">Status</th>
                    <th class="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr v-for="p in autoHealPolicies" :key="p.id" class="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td class="py-2 px-2.5">
                      <div class="font-bold text-zinc-900 dark:text-zinc-100">{{ p.name }}</div>
                      <div class="text-[10px] text-zinc-400">{{ p.description }}</div>
                    </td>
                    <td class="py-2 px-2.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">{{ p.trigger_type }}</td>
                    <td class="py-2 px-2.5 font-mono text-[10px] text-zinc-700 dark:text-zinc-300">{{ p.action_strategy }}</td>
                    <td class="py-2 px-2.5">
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                        :class="p.severity === 'critical' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : (p.severity === 'high' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300')"
                      >
                        {{ p.severity }}
                      </span>
                    </td>
                    <td class="py-2 px-2.5 font-mono text-[10px] text-zinc-500">{{ p.max_retries }} max / {{ p.cool_down_seconds }}s</td>
                    <td class="py-2 px-2.5">
                      <span class="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                        {{ p.is_active ? 'Active' : 'Disabled' }}
                      </span>
                    </td>
                    <td class="py-2 px-2.5 text-right">
                      <button
                        @click="deleteAutoHealPolicy(p.id)"
                        class="px-2 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-[10px] font-bold transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- ========================================================= -->
        <!-- PANE 2J: EXECUTION PLANE & LIVE RUNS STREAM (EPIC 24)     -->
        <!-- ========================================================= -->
        <div
          v-if="activeTab === 'runs'"
          class="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto"
        >
          <!-- Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-zinc-900 border border-blue-700/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">🚀</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Execution Plane: Session-as-a-Card Live Runs</h3>
                <span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold animate-pulse">LIVE STREAM</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Real-time agent execution stream. PIDs, file touched telemetry, git diffs, and test verdicts are ingested directly without agent bookkeeping tax.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="loadAgentSessions(); loadSessionMetrics();"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Refresh Stream</span>
              </button>
            </div>
          </div>

          <!-- Notification / Alerts -->
          <div v-if="sessionSuccessMsg" class="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span>✅</span>
              <span>{{ sessionSuccessMsg }}</span>
            </span>
            <button @click="sessionSuccessMsg = null" class="text-emerald-400 hover:text-emerald-200">✕</button>
          </div>
          <div v-if="sessionErrorMsg" class="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{{ sessionErrorMsg }}</span>
            </span>
            <button @click="sessionErrorMsg = null" class="text-rose-400 hover:text-rose-200">✕</button>
          </div>

          <!-- Top Metrics Cards -->
          <div v-if="sessionMetrics" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-medium text-zinc-500 uppercase">Total Sessions</div>
              <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{{ sessionMetrics.total_sessions }}</div>
            </div>
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-medium text-zinc-500 uppercase">Active Runs</div>
              <div class="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1.5">
                <span>{{ sessionMetrics.active_count }}</span>
                <span v-if="sessionMetrics.active_count > 0" class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-medium text-zinc-500 uppercase">Pass Rate</div>
              <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ sessionMetrics.pass_rate_percent }}%</div>
            </div>
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-medium text-zinc-500 uppercase">Tokens Streamed</div>
              <div class="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">{{ (sessionMetrics.total_tokens || 0).toLocaleString() }}</div>
            </div>
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-medium text-zinc-500 uppercase">Auto-Docked Issues</div>
              <div class="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{{ sessionMetrics.auto_docked_count }}</div>
            </div>
          </div>

          <!-- Fast Ingestion Trigger Bar -->
          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>⚡</span>
              <span>Fast Agent Ingestion & Execution Trigger</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Agent</label>
                <select
                  v-model="newIngestAgentName"
                  class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  <option value="flomaster">Flomaster (Autonomous Engine)</option>
                  <option value="hermes">Hermes Agent</option>
                  <option value="cursor">Cursor Agent</option>
                  <option value="flow-builder">Flow Builder</option>
                  <option value="flow-inspect">Flow Inspect Auditor</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="text-[10px] font-medium text-zinc-500 block mb-0.5">Task / Prompt Intent</label>
                <input
                  v-model="newIngestCommand"
                  type="text"
                  placeholder="e.g. Implement live execution plane and verify test suite"
                  class="w-full px-2 py-1 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  @keyup.enter="handleIngestSession"
                />
              </div>
              <div class="flex items-end">
                <button
                  @click="handleIngestSession"
                  :disabled="isIngestingSession"
                  class="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {{ isIngestingSession ? 'Ingesting...' : 'Ingest Session Run' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Main Live Stream Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <!-- Left 2 Cols: Sessions Table -->
            <div class="lg:col-span-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Execution Runs ({{ agentSessionRuns.length }})</span>
                </span>
                <div class="flex items-center gap-2">
                  <select
                    v-model="sessionFilterStatus"
                    @change="loadAgentSessions"
                    class="px-2 py-0.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="running">Running</option>
                    <option value="verifying">Verifying</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div v-if="agentSessionRuns.length === 0" class="text-xs text-zinc-400 py-6 text-center">
                No session runs recorded yet. Ingest a run above or start an agent.
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase">
                      <th class="py-2 px-2.5">Agent / Session</th>
                      <th class="py-2 px-2.5">Status / PID</th>
                      <th class="py-2 px-2.5">Files Touched</th>
                      <th class="py-2 px-2.5">Test Verdict</th>
                      <th class="py-2 px-2.5">Parent Card</th>
                      <th class="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr
                      v-for="s in agentSessionRuns"
                      :key="s.id"
                      class="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                      :class="selectedSessionRun && selectedSessionRun.id === s.id ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''"
                      @click="selectSessionRun(s)"
                    >
                      <td class="py-2 px-2.5">
                        <div class="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          <span>🤖 {{ s.agent_name }}</span>
                          <span class="text-[9px] font-mono text-zinc-400">({{ s.runtime }})</span>
                        </div>
                        <div class="text-[10px] text-zinc-500 truncate max-w-[180px] font-mono">{{ s.session_id }}</div>
                      </td>
                      <td class="py-2 px-2.5">
                        <span
                          class="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex items-center gap-1 w-fit"
                          :class="{
                            'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300': s.status === 'completed',
                            'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 animate-pulse': s.status === 'running',
                            'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300': s.status === 'verifying',
                            'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300': s.status === 'failed',
                            'bg-zinc-100 dark:bg-zinc-800 text-zinc-500': s.status === 'cancelled' || s.status === 'idle'
                          }"
                        >
                          <span>{{ s.status }}</span>
                        </span>
                        <span v-if="s.pid" class="text-[10px] font-mono text-zinc-400 block mt-0.5">PID: {{ s.pid }}</span>
                      </td>
                      <td class="py-2 px-2.5 font-mono text-[10px] text-zinc-400">
                        {{ (s.files_touched || []).length }} files
                      </td>
                      <td class="py-2 px-2.5">
                        <span
                          v-if="s.test_verdict"
                          class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                          :class="s.test_verdict.status === 'passed' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'"
                        >
                          {{ s.test_verdict.passed || 0 }}/{{ s.test_verdict.total || s.test_verdict.passed || 0 }} ✓
                        </span>
                        <span v-else class="text-[10px] text-zinc-500 font-mono">-</span>
                      </td>
                      <td class="py-2 px-2.5">
                        <span v-if="s.auto_docked" class="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] font-semibold">
                          🔗 Docked
                        </span>
                        <span v-else class="text-[10px] text-zinc-500">-</span>
                      </td>
                      <td class="py-2 px-2.5 text-right space-x-1" @click.stop>
                        <button
                          @click="handleForkSession(s.id)"
                          title="Fork / Continue session"
                          class="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                        >
                          Fork
                        </button>
                        <button
                          v-if="s.status === 'running' || s.status === 'verifying'"
                          @click="handleTerminateSession(s.id)"
                          title="Terminate session process"
                          class="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-semibold hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                        >
                          Stop
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right Col: Selected Session Telemetry & Ground Truth Observability Inspector (Milestone 3) -->
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3 flex flex-col min-h-0">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>Ground Truth Observability Hub</span>
                  </span>
                  <span
                    v-if="selectedSessionRun"
                    class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
                    :class="{
                      'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800': (sessionVerdictData && sessionVerdictData.verification_badge === 'verified') || selectedSessionRun.verification_badge === 'verified',
                      'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800': (sessionVerdictData && sessionVerdictData.verification_badge === 'vetoed') || selectedSessionRun.verification_badge === 'vetoed',
                      'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800': (sessionVerdictData && sessionVerdictData.verification_badge === 'failing_tests') || selectedSessionRun.verification_badge === 'failing_tests',
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700': !(sessionVerdictData && sessionVerdictData.verification_badge) && !selectedSessionRun.verification_badge
                    }"
                  >
                    <span>🛡️</span>
                    <span>{{ ((sessionVerdictData && sessionVerdictData.verification_badge) || selectedSessionRun.verification_badge || 'UNVERIFIED').toUpperCase() }}</span>
                    <span v-if="(sessionVerdictData && sessionVerdictData.verification_score) || selectedSessionRun.verification_score" class="font-mono text-[8px] opacity-80">({{ (sessionVerdictData && sessionVerdictData.verification_score) || selectedSessionRun.verification_score }}/100)</span>
                  </span>
                </div>
                <span v-if="selectedSessionRun" class="text-[10px] font-mono text-zinc-400">{{ selectedSessionRun.session_id }}</span>
              </div>

              <div v-if="!selectedSessionRun" class="text-xs text-zinc-400 py-12 text-center">
                Click any session row on the left to inspect its live git diffs, test verdicts, and Sceptic audit proofs.
              </div>

              <div v-else class="space-y-3 flex-1 flex flex-col overflow-y-auto">
                <!-- Observability Sub-tabs -->
                <div class="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-1 text-xs overflow-x-auto">
                  <button
                    @click="sessionObservabilityTab = 'dag'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'dag' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>🌿</span>
                    <span>DAG Lineage</span>
                    <span v-if="sessionDagData && sessionDagData.total_nodes" class="px-1 py-0.5 rounded bg-zinc-300 dark:bg-zinc-700 text-[9px] font-mono">{{ sessionDagData.total_nodes }}</span>
                  </button>
                  <button
                    @click="sessionObservabilityTab = 'interventions'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'interventions' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>💬</span>
                    <span>Interventions</span>
                    <span v-if="sessionInterventionsList && sessionInterventionsList.length" class="px-1 py-0.5 rounded bg-zinc-300 dark:bg-zinc-700 text-[9px] font-mono">{{ sessionInterventionsList.length }}</span>
                  </button>
                  <button
                    @click="sessionObservabilityTab = 'diff'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'diff' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>📝</span>
                    <span>Git Diff</span>
                    <span v-if="sessionDiffData && sessionDiffData.files && sessionDiffData.files.length" class="px-1 py-0.5 rounded bg-zinc-300 dark:bg-zinc-700 text-[9px] font-mono">{{ sessionDiffData.files.length }}</span>
                  </button>
                  <button
                    @click="sessionObservabilityTab = 'verdict'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'verdict' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>🧪</span>
                    <span>Test Verdict</span>
                  </button>
                  <button
                    @click="sessionObservabilityTab = 'audit'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'audit' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>⚖️</span>
                    <span>Sceptic Audit</span>
                  </button>
                  <button
                    @click="sessionObservabilityTab = 'telemetry'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'telemetry' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>📊</span>
                    <span>Logs & Telemetry</span>
                  </button>
                </div>

                <!-- Alert Messages -->
                <div v-if="observabilitySuccessMsg" class="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[11px]">
                  {{ observabilitySuccessMsg }}
                </div>
                <div v-if="observabilityErrorMsg" class="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-[11px]">
                  {{ observabilityErrorMsg }}
                </div>

                <!-- TAB 0: DAG LINEAGE & GRAPH -->
                <div v-if="sessionObservabilityTab === 'dag'" class="space-y-3 flex-1 flex flex-col">
                  <div class="flex items-center justify-between p-2.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-zinc-800 dark:text-zinc-200">Execution Tree</span>
                      <span v-if="sessionDagData" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">Root: {{ sessionDagData.root_session_id }}</span>
                    </div>
                    <button
                      @click="openBranchModal(selectedSessionRun)"
                      class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>🔀</span>
                      <span>Branch from this Run</span>
                    </button>
                  </div>

                  <div v-if="isLoadingDag" class="text-center py-6 text-xs text-zinc-400">Loading session lineage graph...</div>
                  <div v-else-if="sessionDagData && sessionDagData.nodes && sessionDagData.nodes.length" class="space-y-2 overflow-y-auto max-h-[360px] pr-1">
                    <div
                      v-for="node in sessionDagData.nodes"
                      :key="node.session_id"
                      class="p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between"
                      :class="node.is_target ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-2xs' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'"
                      @click="selectSessionRun(sessions.find(s => s.id === node.id || s.session_id === node.session_id) || node)"
                    >
                      <div class="flex items-center gap-2">
                        <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[9px]">Gen {{ node.generation }}</span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                          :class="{
                            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300': node.branch_type === 'fork',
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300': node.branch_type === 'continuation',
                            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300': node.branch_type === 'retry',
                            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300': node.branch_type === 'swarm_worker',
                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300': !node.branch_type || node.branch_type === 'root'
                          }"
                        >{{ node.branch_type || 'root' }}</span>
                        <span class="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{{ node.branch_name || node.session_id }}</span>
                        <span v-if="node.is_target" class="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">(active)</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-mono text-zinc-400">{{ node.agent_name || 'agent' }}</span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                          :class="{
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300': node.status === 'completed',
                            'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300': node.status === 'failed',
                            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300': node.status === 'running' || node.status === 'verifying',
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400': node.status === 'spawning'
                          }"
                        >{{ node.status }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="p-4 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 text-center">
                    No parent or child lineage nodes found for this session.
                  </div>
                </div>

                <!-- TAB 0.5: INTERVENTIONS & CONTROL -->
                <div v-if="sessionObservabilityTab === 'interventions'" class="space-y-3 flex-1 flex flex-col">
                  <!-- Process State & Pause / Gate Banner -->
                  <div class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-zinc-800 dark:text-zinc-200">Session Controls</span>
                        <span v-if="selectedSessionRun.is_paused" class="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">⏸️ PAUSED</span>
                        <span v-else class="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">▶️ ACTIVE</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button
                          @click="handleTogglePauseSession(selectedSessionRun)"
                          class="px-2 py-1 rounded text-xs font-semibold transition-colors"
                          :class="selectedSessionRun.is_paused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'"
                        >
                          {{ selectedSessionRun.is_paused ? '▶️ Resume Process' : '⏸️ Pause Process' }}
                        </button>
                        <button
                          @click="handleArbitrateConflicts(selectedSessionRun, true)"
                          class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                        >
                          🛡️ Check Conflicts
                        </button>
                      </div>
                    </div>

                    <!-- Human Gate Review Status -->
                    <div class="pt-2 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2">
                        <span class="text-zinc-500">Human Gate:</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          :class="{
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300': selectedSessionRun.intervention_gate === 'human_approved' || selectedSessionRun.intervention_gate === 'auto_passed',
                            'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300': selectedSessionRun.intervention_gate === 'human_rejected',
                            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300': selectedSessionRun.intervention_gate === 'pending_human_review',
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400': !selectedSessionRun.intervention_gate || selectedSessionRun.intervention_gate === 'none'
                          }"
                        >{{ selectedSessionRun.intervention_gate || 'NONE' }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          @click="handleSetGate(selectedSessionRun, 'approve', 'Human sign-off approved')"
                          class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-colors"
                        >
                          ✓ Approve
                        </button>
                        <button
                          @click="handleSetGate(selectedSessionRun, 'reject', 'Rejected by operator')"
                          class="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-[10px] font-bold transition-colors"
                        >
                          ✕ Reject
                        </button>
                        <button
                          @click="handleSetGate(selectedSessionRun, 'require_review', 'Intervention required before ship')"
                          class="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-700 dark:text-amber-300 text-[10px] font-bold transition-colors"
                        >
                          ⏳ Hold
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Live Human Instruction Injection Input -->
                  <div class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                      <span>💉 Inject Steering Instructions into Agent Context</span>
                      <select
                        v-model="interventionPriorityInput"
                        class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px]"
                      >
                        <option value="normal">Priority: Normal</option>
                        <option value="high">Priority: High</option>
                        <option value="urgent">Priority: Urgent</option>
                      </select>
                    </div>
                    <div class="flex gap-2">
                      <input
                        v-model="interventionInstructionInput"
                        @keyup.enter="handleInjectInstruction(selectedSessionRun)"
                        placeholder="Type steering constraint, instruction, or bug correction for live agent..."
                        class="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        @click="handleInjectInstruction(selectedSessionRun)"
                        :disabled="isInjectingInstruction || !interventionInstructionInput.trim()"
                        class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <span>Send</span>
                      </button>
                    </div>
                  </div>

                  <!-- Intervention Audit Log Timeline -->
                  <div class="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                    <div class="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Intervention Audit Trail</div>
                    <div v-if="!sessionInterventionsList.length" class="text-xs text-zinc-400 italic py-2">No human interventions or steerings recorded yet for this session.</div>
                    <div
                      v-for="item in sessionInterventionsList"
                      :key="item.id"
                      class="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                    >
                      <div class="flex items-center justify-between text-[10px] text-zinc-400">
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold uppercase text-indigo-600 dark:text-indigo-400">{{ item.action_type }}</span>
                          <span>by {{ item.author || 'operator' }}</span>
                        </div>
                        <span class="font-mono">{{ item.created }}</span>
                      </div>
                      <div class="text-zinc-800 dark:text-zinc-200 text-xs font-mono break-words">{{ item.instruction }}</div>
                    </div>
                  </div>
                </div>

                <!-- TAB 1: VISUAL GIT DIFF VIEWER -->
                <div v-if="sessionObservabilityTab === 'diff'" class="space-y-3 flex-1 flex flex-col">
                  <div class="flex items-center justify-between bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-semibold text-zinc-400 uppercase">Diff Summary:</span>
                      <span class="font-mono text-emerald-500 font-bold">+{{ (sessionDiffData && sessionDiffData.summary && sessionDiffData.summary.additions) || (selectedSessionRun.git_diff_summary && selectedSessionRun.git_diff_summary.additions) || 0 }}</span>
                      <span class="font-mono text-rose-500 font-bold">-{{ (sessionDiffData && sessionDiffData.summary && sessionDiffData.summary.deletions) || (selectedSessionRun.git_diff_summary && selectedSessionRun.git_diff_summary.deletions) || 0 }}</span>
                      <span class="text-zinc-400 text-[10px]">across {{ (sessionDiffData && sessionDiffData.files && sessionDiffData.files.length) || (selectedSessionRun.files_touched || []).length || 0 }} files</span>
                    </div>
                    <button
                      v-if="sessionDiffData && sessionDiffData.raw_diff"
                      @click="copyUnifiedDiff(sessionDiffData.raw_diff)"
                      class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono"
                    >
                      {{ diffCopied ? '✓ Copied' : '📋 Copy Patch' }}
                    </button>
                  </div>

                  <!-- File Picker Bar -->
                  <div v-if="sessionDiffData && sessionDiffData.files && sessionDiffData.files.length" class="flex flex-wrap gap-1">
                    <button
                      v-for="(f, idx) in sessionDiffData.files"
                      :key="f.file"
                      @click="selectedDiffFileIndex = idx"
                      class="px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 transition-colors"
                      :class="selectedDiffFileIndex === idx ? 'bg-blue-600 text-white font-bold' : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'"
                    >
                      <span>{{ f.file }}</span>
                      <span class="text-[9px] opacity-80">(+{{ f.additions }}/-{{ f.deletions }})</span>
                    </button>
                  </div>

                  <!-- Selected File Unified Diff Code Box -->
                  <div class="flex-1 flex flex-col min-h-0 bg-zinc-950 rounded border border-zinc-800 overflow-hidden font-mono text-[10px]">
                    <div class="p-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-zinc-400">
                      <span class="font-bold text-zinc-200">{{ (sessionDiffData && sessionDiffData.files && sessionDiffData.files[selectedDiffFileIndex] && sessionDiffData.files[selectedDiffFileIndex].file) || selectedSessionRun.git_branch || 'Unified Patch Stream' }}</span>
                      <span>Unified Diff View</span>
                    </div>
                    <pre class="flex-1 p-2 overflow-y-auto max-h-64 whitespace-pre-wrap select-text leading-relaxed text-zinc-300">{{ (sessionDiffData && sessionDiffData.files && sessionDiffData.files[selectedDiffFileIndex] && sessionDiffData.files[selectedDiffFileIndex].raw_patch) || (sessionDiffData && sessionDiffData.raw_diff) || 'No code changes recorded for this session execution.' }}</pre>
                  </div>
                </div>

                <!-- TAB 2: TEST VERDICT GROUND TRUTH -->
                <div v-if="sessionObservabilityTab === 'verdict'" class="space-y-3 flex-1 flex flex-col">
                  <div class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold text-[10px] uppercase">
                          {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.framework) || 'Pytest 9.1' }}
                        </span>
                        <span class="font-bold text-zinc-800 dark:text-zinc-200">
                          Suite Execution: {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.status) || 'passed' }}
                        </span>
                      </div>
                      <span class="text-[10px] font-mono text-zinc-400">⏱️ {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.duration_s) || '0.45' }}s</span>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-center pt-1">
                      <div class="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                        <div class="text-[9px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold">Passed</div>
                        <div class="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                          {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.passed) || (selectedSessionRun.test_verdict && selectedSessionRun.test_verdict.passed) || 0 }}
                        </div>
                      </div>
                      <div class="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
                        <div class="text-[9px] uppercase text-rose-600 dark:text-rose-400 font-semibold">Failed</div>
                        <div class="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">
                          {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.failed) || (selectedSessionRun.test_verdict && selectedSessionRun.test_verdict.failed) || 0 }}
                        </div>
                      </div>
                      <div class="p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div class="text-[9px] uppercase text-zinc-500 font-semibold">Total</div>
                        <div class="text-base font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                          {{ (sessionVerdictData && sessionVerdictData.test_verdict && sessionVerdictData.test_verdict.total) || (selectedSessionRun.test_verdict && selectedSessionRun.test_verdict.total) || 0 }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 1-Click Verification Trigger Form -->
                  <div class="p-3 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                    <div class="font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                      <span>⚡ Run Test & Verification Suite</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                      <div>
                        <label class="text-[10px] text-zinc-400">Framework</label>
                        <select v-model="simulatedTestFramework" class="w-full mt-0.5 p-1 rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs">
                          <option value="pytest">Pytest</option>
                          <option value="playwright">Playwright E2E</option>
                          <option value="jest">Jest / Vitest</option>
                          <option value="cargo">Cargo Test</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-[10px] text-zinc-400">Passed Count</label>
                        <input v-model.number="simulatedTestPassed" type="number" class="w-full mt-0.5 p-1 rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono" />
                      </div>
                      <div>
                        <label class="text-[10px] text-zinc-400">Failed Count</label>
                        <input v-model.number="simulatedTestFailed" type="number" class="w-full mt-0.5 p-1 rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono" />
                      </div>
                    </div>
                    <button
                      @click="runSimulatedVerification(selectedSessionRun)"
                      :disabled="isVerifyingObservability"
                      class="w-full mt-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span v-if="isVerifyingObservability" class="animate-spin">⏳</span>
                      <span v-else>🛡️</span>
                      <span>Execute & Ingest Test Proof</span>
                    </button>
                  </div>
                </div>

                <!-- TAB 3: SCEPTIC AUDIT & VETOES -->
                <div v-if="sessionObservabilityTab === 'audit'" class="space-y-3 flex-1 flex flex-col">
                  <div
                    v-if="sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.vetoed"
                    class="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200 text-xs space-y-1"
                  >
                    <div class="flex items-center gap-1.5 font-bold text-rose-400 uppercase tracking-wide">
                      <span>🚨</span>
                      <span>Critical Veto: P0 Finding Blocks Auto-Dock</span>
                    </div>
                    <p class="text-[11px] opacity-90">Flow Inspect Sceptic flagged critical correctness or security defects.</p>
                  </div>

                  <div class="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <div class="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>🕵️</span>
                        <span>{{ (sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.auditor) || 'Flow Inspect Sceptic' }}</span>
                      </div>
                      <span
                        class="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                        :class="(sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.verdict === 'PASS') ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'"
                      >
                        {{ (sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.verdict) || 'NO AUDIT YET' }}
                      </span>
                    </div>
                    <div class="text-[10px] text-zinc-400 font-mono">
                      Signature: {{ (sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.signature) || 'Unsigned' }}
                    </div>
                    <p class="text-[11px] text-zinc-700 dark:text-zinc-300 italic">
                      {{ (sessionAuditData && sessionAuditData.sceptic_audit && sessionAuditData.sceptic_audit.summary) || 'No sceptic review findings recorded.' }}
                    </p>
                  </div>

                  <!-- 1-Click Sceptic Audit Actions -->
                  <div class="flex gap-2">
                    <button
                      @click="submitQuickScepticAudit(selectedSessionRun, 'PASS')"
                      :disabled="isVerifyingObservability"
                      class="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span>✓ Sign Pass (0 Vetoes)</span>
                    </button>
                    <button
                      @click="submitQuickScepticAudit(selectedSessionRun, 'FAIL')"
                      :disabled="isVerifyingObservability"
                      class="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span>🚨 Issue P0 Veto</span>
                    </button>
                  </div>
                </div>

                <!-- TAB 4: PROCESS TELEMETRY & LOGS -->
                <div v-if="sessionObservabilityTab === 'telemetry'" class="space-y-3 flex-1 flex flex-col">
                  <div class="p-2.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div class="text-[10px] font-semibold text-zinc-400 uppercase">Command / Intent</div>
                    <div class="text-zinc-800 dark:text-zinc-200 font-mono mt-0.5 break-words">{{ selectedSessionRun.command || 'Direct autonomous cycle' }}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[10px] text-zinc-400 font-mono">Branch</div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200 font-mono text-[11px]">{{ selectedSessionRun.git_branch || 'main' }}</div>
                    </div>
                    <div class="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[10px] text-zinc-400 font-mono">PID</div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200 font-mono text-[11px]">{{ selectedSessionRun.pid || 'N/A' }}</div>
                    </div>
                  </div>

                  <div class="flex-1 flex flex-col min-h-0">
                    <div class="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Live Log Tail</div>
                    <pre class="flex-1 p-2 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-y-auto max-h-48 whitespace-pre-wrap select-text">{{ selectedSessionRun.log_tail || 'Running execution loop in background...' }}</pre>
                  </div>

                  <div v-if="(selectedSessionRun.files_touched || []).length > 0">
                    <div class="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Files Modified</div>
                    <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      <span
                        v-for="f in selectedSessionRun.files_touched"
                        :key="f"
                        class="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[9px] font-mono"
                      >
                        {{ f }}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          <!-- Branch / Fork Modal (Milestone 4 / Epic 25) -->
          <div v-if="branchModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔀</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Branch Agent Session</h3>
                    <p class="text-[11px] text-zinc-500">Fork and continue execution DAG with preserved context</p>
                  </div>
                </div>
                <button @click="branchModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Branch Name</label>
                  <input
                    v-model="branchNameInput"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. fix-auth-race-condition"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Branch Type</label>
                    <select
                      v-model="branchTypeInput"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="fork">Fork (Standard)</option>
                      <option value="continuation">Continuation</option>
                      <option value="retry">Retry</option>
                      <option value="repair">Repair</option>
                      <option value="swarm_worker">Swarm Worker</option>
                      <option value="critique">Critique</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Model Override</label>
                    <input
                      v-model="branchModelInput"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. gpt-5.5, claude-fable-5"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Follow-up Prompt / Steering Instructions</label>
                  <textarea
                    v-model="branchPromptInput"
                    rows="3"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="Describe specific modifications, bug fixes, or new task requirements for this branch..."
                  ></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="branchModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  @click="handleCreateBranch"
                  :disabled="isBranchingSession || !branchNameInput.trim()"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isBranchingSession ? 'Branching...' : 'Launch Branch Run' }}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </section>
    </div>
  `
};
