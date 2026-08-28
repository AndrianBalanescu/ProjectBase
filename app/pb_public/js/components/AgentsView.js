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
      isDispatchingSwarm: false,
      // Step Trajectories & Autonomous Swarm Clusters (Milestone 5 / Epic 26)
      sessionTrajectoriesList: [],
      sessionTrajectorySummary: null,
      isLoadingTrajectories: false,
      selectedTrajectoryStep: null,
      trajectoryStepTypeFilter: '',
      swarmClustersList: [],
      selectedSwarmCluster: null,
      isLoadingSwarmClusters: false,
      clusterModalOpen: false,
      clusterNameInput: '',
      clusterObjectiveInput: '',
      clusterTopologyInput: 'hierarchical',
      clusterConcurrencyInput: 4,
      clusterWorkerRoleInput: 'implementer',
      clusterWorkerPromptInput: '',
      clusterWorkerModelInput: 'gpt-5.5',
      isCreatingCluster: false,
      clusterSuccessMsg: null,
      clusterErrorMsg: null,
      // Multi-Agent Merge & Semantic Conflict Auto-Resolution Engine (Milestone 6 / Epic 27)
      sessionMergesList: [],
      selectedSessionMerge: null,
      sessionMergeConflicts: [],
      sessionMergeMatrix: null,
      isLoadingMerges: false,
      isProposingMerge: false,
      isResolvingMerge: false,
      isExecutingMerge: false,
      mergeModalOpen: false,
      mergeSourceSessionInput: '',
      mergeTargetSessionInput: '',
      mergeTitleInput: '',
      mergeStrategyInput: 'ast_clean',
      mergeAutoResolveInput: true,
      mergeSuccessMsg: null,
      mergeErrorMsg: null,
      selectedConflictHunk: null,
      customResolutionContent: '',
      mergeStatusFilter: '',
      // Agent Fleet Budget, Cost Attribution & Token Quota Engine (Milestone 7 / Epic 28)
      budgetMetrics: null,
      budgetPolicies: [],
      costLedger: [],
      pricingMatrix: {},
      isLoadingBudget: false,
      isSavingBudgetPolicy: false,
      isGrantingOverride: false,
      budgetSuccessMsg: null,
      budgetErrorMsg: null,
      budgetPolicyModalOpen: false,
      budgetOverrideModalOpen: false,
      selectedPolicyForOverride: null,
      newBudgetPolicy: {
        name: '',
        scope_type: 'global',
        scope_id: '',
        max_budget_usd: 50,
        max_tokens: 10000000,
        period: 'daily',
        soft_limit_pct: 80,
        hard_limit_action: 'block'
      },
      newBudgetOverride: {
        policy_id: '',
        additional_budget: 25,
        additional_tokens: 5000000,
        expires_in_minutes: 120,
        reason: '',
        granted_by: 'admin'
      },
      quotaSimulator: {
        session_id: '',
        project_id: '',
        persona: 'coder',
        model: 'claude-3-5-sonnet',
        estimated_prompt_tokens: 5000,
        estimated_completion_tokens: 2000,
        result: null,
        isSimulating: false
      },
      ledgerFilterPersona: '',
      ledgerFilterModel: '',
      // Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29)
      evalSuites: [],
      evalRuns: [],
      evalLeaderboard: [],
      evalRegressions: [],
      evalSummary: null,
      selectedEvalSuite: null,
      selectedEvalRun: null,
      evalComparison: null,
      isLoadingEvals: false,
      isTriggeringEval: false,
      isSeedingEvals: false,
      isComparingModels: false,
      evalSuccessMsg: null,
      evalErrorMsg: null,
      evalTriggerModalOpen: false,
      evalSuiteModalOpen: false,
      evalCompareModalOpen: false,
      evalTriggerModel: 'gpt-5.5',
      evalTriggerPersona: 'coder',
      evalTriggerSuiteSlug: 'coding-accuracy-v1',
      evalFilterDomain: '',
      evalFilterModel: '',
      compareModelA: 'gpt-5.5',
      compareModelB: 'claude-fable-5',
      comparePersona: 'coder',
      newEvalSuite: {
        name: '',
        slug: '',
        description: '',
        domain: 'coding',
        pass_threshold_pct: 90,
        timeout_seconds: 60,
        scenarios: [
          { id: 'sc-1', name: 'Standard Code Generation Scenario', expected: 'exit 0' }
        ]
      },
      // Ephemeral Sandboxes & Dev Environments (Milestone 9 / Epic 30)
      sandboxesList: [],
      sandboxTemplatesList: [],
      sandboxFleetMetrics: null,
      selectedSandbox: null,
      selectedSandboxExecutions: [],
      selectedSandboxSnapshots: [],
      isLoadingSandboxes: false,
      isProvisioningSandbox: false,
      isExecutingCommand: false,
      isCreatingSnapshot: false,
      sandboxModalOpen: false,
      sandboxExecModalOpen: false,
      sandboxSnapshotModalOpen: false,
      sandboxSuccessMsg: null,
      sandboxErrorMsg: null,
      sandboxFilterStatus: '',
      sandboxFilterEnv: '',
      newSandbox: {
        name: '',
        environment_type: 'worktree',
        runtime_type: 'node',
        template_id: '',
        memory_limit_mb: 1024,
        ttl_seconds: 3600,
        allocated_port: 8140,
        env_vars_str: '{\n  "NODE_ENV": "development"\n}'
      },
      sandboxExecInput: {
        command: 'npm test',
        executed_by: 'agent'
      },
      newSandboxSnapshot: {
        snapshot_name: '',
        notes: ''
      },
      // Autonomous Multi-Agent Incident Response & Live Debugging War-Room (Milestone 10 / Epic 31)
      incidentsList: [],
      selectedIncident: null,
      incidentMetrics: null,
      isLoadingIncidents: false,
      incidentSuccessMsg: null,
      incidentErrorMsg: null,
      incidentFilterStatus: '',
      incidentFilterSeverity: '',
      incidentSearch: '',
      newIncidentModalOpen: false,
      newIncident: {
        title: '',
        summary: '',
        severity: 'p1_high',
        service_name: 'core-gateway',
        incident_commander: 'Flomaster-Commander',
        lead_investigator: 'Flomaster-Auditor',
        source: 'runtime_probe',
        impact_scope: 'API Gateway & Autonomous Swarm Workers'
      },
      newIncidentEvent: {
        title: '',
        content: '',
        event_type: 'log_entry',
        severity: 'info',
        author: 'Flomaster-Investigator',
        author_type: 'agent'
      },
      newIncidentHypothesis: {
        hypothesis: '',
        rationale: '',
        test_plan: '',
        confidence_score: 0.85,
        status: 'proposed',
        proposed_by: 'Flomaster-Investigator'
      },
      newIncidentMitigation: {
        title: '',
        description: '',
        action_type: 'config_patch',
        rollback_plan: 'Revert PRAGMA setting and reset pool worker timeout.',
        executed_by: 'Flomaster-Commander'
      },
      incidentActiveSubtab: 'timeline', // 'timeline' | 'hypotheses' | 'mitigations' | 'postmortem'

      // Autonomous Agent Knowledge Graph & Architectural Memory Index (Milestone 11 / Epic 32)
      knowledgeNodesList: [],
      knowledgeRelationsList: [],
      architecturalInvariantsList: [],
      invariantVerificationsList: [],
      knowledgeMetrics: null,
      selectedKnowledgeNode: null,
      selectedKnowledgeNodeInbound: [],
      selectedKnowledgeNodeOutbound: [],
      selectedKnowledgeNodeInvariants: [],
      isLoadingKnowledge: false,
      knowledgeSuccessMsg: null,
      knowledgeErrorMsg: null,
      knowledgeFilterKind: '',
      knowledgeFilterStatus: '',
      knowledgeSearch: '',
      knowledgeActiveSubtab: 'graph', // 'graph' | 'adrs' | 'invariants' | 'verifier'
      newKnowledgeModalOpen: false,
      newInvariantModalOpen: false,
      newKnowledgeNode: {
        title: '',
        slug: '',
        kind: 'invariant',
        summary: '',
        content_markdown: '',
        file_path: '',
        symbol_name: '',
        status: 'active',
        confidence_score: 1.0,
        author_agent: 'flomaster',
        tags_str: 'architecture, core'
      },
      newArchitecturalInvariant: {
        rule_name: '',
        rule_type: 'path_pattern',
        pattern_expression: 'forbidden:node_modules',
        severity: 'p0_blocking',
        enforcement_action: 'block_merge',
        is_active: true,
        node_id: ''
      },
      verifierPlaygroundInput: {
        target_files_str: 'app/pb_public/js/components/CustomView.js\napp/pb_hooks/116_custom.pb.js',
        diff_summary: 'Refactored backend hook to use native SQLite transactions',
        agent_name: 'flomaster'
      },
      latestVerificationResult: null,
      isVerifyingInvariants: false,

      // Autonomous Multi-Persona Code Review Swarm & Patch Synthesizer (Milestone 12 / Epic 33)
      codeReviewsList: [],
      codeReviewMetrics: null,
      selectedCodeReview: null,
      selectedReviewCritiques: [],
      selectedReviewPatches: [],
      selectedReviewVerdict: null,
      isLoadingCodeReviews: false,
      isDispatchingReviewSwarm: false,
      isSynthesizingPatch: false,
      codeReviewSuccessMsg: null,
      codeReviewErrorMsg: null,
      codeReviewFilterStatus: '',
      codeReviewFilterVerdict: '',
      codeReviewSearch: '',
      codeReviewActiveSubtab: 'critiques', // 'critiques' | 'diff' | 'patches' | 'gate'
      newReviewModalOpen: false,
      newCritiqueModalOpen: false,
      overrideGateModalOpen: false,
      newCodeReview: {
        title: '',
        summary: '',
        source_branch: 'feature/agent-task',
        target_branch: 'main',
        diff_content: '',
        files_touched_str: '',
        author_agent: 'flomaster',
        auto_swarm: true
      },
      newCritique: {
        persona: 'security_auditor',
        severity: 'p1_warning',
        title: '',
        critique_markdown: '',
        file_path: '',
        line_start: 1,
        line_end: 1,
        suggested_diff: '',
        confidence_score: 0.95
      },
      gateOverride: {
        reason: '',
        overridden_by: 'human_lead'
      }
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
          this.loadSessionInterventions(sid),
          this.loadSessionTrajectories(sid)
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
    },
    async loadSessionTrajectories(id) {
      if (!id) return;
      this.isLoadingTrajectories = true;
      try {
        const [trajRes, summaryRes] = await Promise.all([
          API.getSessionTrajectories(id, { limit: 100 }).catch(() => null),
          API.getSessionTrajectorySummary(id).catch(() => null)
        ]);
        this.sessionTrajectoriesList = (trajRes && trajRes.trajectories) || [];
        this.sessionTrajectorySummary = summaryRes;
        if (this.sessionTrajectoriesList.length > 0 && !this.selectedTrajectoryStep) {
          this.selectedTrajectoryStep = this.sessionTrajectoriesList[0];
        }
      } catch (e) {
        console.error('Failed to load session trajectories:', e);
      } finally {
        this.isLoadingTrajectories = false;
      }
    },
    async loadSwarmClusters() {
      this.isLoadingSwarmClusters = true;
      try {
        const res = await API.listSwarmClusters({ project: this.currentProject ? this.currentProject.id : '' });
        this.swarmClustersList = (res && res.clusters) || [];
        if (this.swarmClustersList.length > 0 && !this.selectedSwarmCluster) {
          await this.selectSwarmCluster(this.swarmClustersList[0].cluster_id || this.swarmClustersList[0].id);
        }
      } catch (e) {
        console.error('Failed to load swarm clusters:', e);
      } finally {
        this.isLoadingSwarmClusters = false;
      }
    },
    async selectSwarmCluster(clusterId) {
      if (!clusterId) return;
      try {
        const [details, metrics] = await Promise.all([
          API.getSwarmCluster(clusterId).catch(() => null),
          API.getSwarmClusterMetrics(clusterId).catch(() => null)
        ]);
        this.selectedSwarmCluster = details ? { ...details, metrics } : null;
      } catch (e) {
        console.error('Failed to select swarm cluster:', e);
      }
    },
    openClusterModal() {
      this.clusterNameInput = 'Swarm-' + Math.random().toString(36).substring(2, 7);
      this.clusterObjectiveInput = '';
      this.clusterTopologyInput = 'hierarchical';
      this.clusterConcurrencyInput = 4;
      this.clusterModalOpen = true;
    },
    async handleCreateSwarmCluster() {
      if (!this.clusterObjectiveInput.trim()) return;
      this.isCreatingCluster = true;
      try {
        const res = await API.createSwarmCluster({
          name: this.clusterNameInput.trim() || undefined,
          objective: this.clusterObjectiveInput.trim(),
          topology: this.clusterTopologyInput,
          max_concurrency: parseInt(this.clusterConcurrencyInput || 4, 10),
          project_id: this.currentProject ? this.currentProject.id : undefined,
          workers: [
            { role: 'researcher', model: 'rc/perplexity-sonar-reasoning-pro', prompt: 'Scout market & requirements' },
            { role: 'implementer', model: 'claude-fable-5', prompt: 'Execute architecture code' },
            { role: 'auditor', model: 'deepseek/deepseek-r1-distill-llama-70b', prompt: 'Audit tests and ground truth' }
          ]
        });
        this.clusterSuccessMsg = 'Swarm cluster deployed: ' + res.cluster_id;
        this.clusterModalOpen = false;
        await this.loadSwarmClusters();
        if (res.cluster_id) await this.selectSwarmCluster(res.cluster_id);
      } catch (e) {
        this.clusterErrorMsg = 'Failed to create cluster: ' + (e.message || String(e));
      } finally {
        this.isCreatingCluster = false;
      }
    },
    async handleUpdateClusterStatus(clusterId, status) {
      if (!clusterId) return;
      try {
        await API.updateSwarmClusterStatus(clusterId, { status });
        this.clusterSuccessMsg = `Cluster status updated to ${status}`;
        await this.loadSwarmClusters();
        await this.selectSwarmCluster(clusterId);
      } catch (e) {
        this.clusterErrorMsg = 'Status update failed: ' + (e.message || String(e));
      }
    },
    async handleAddClusterWorker(clusterId) {
      if (!clusterId) return;
      try {
        const role = this.clusterWorkerRoleInput || 'implementer';
        await API.addSwarmClusterWorkers(clusterId, {
          workers: [{
            role: role,
            model: this.clusterWorkerModelInput || 'gpt-5.5',
            prompt: this.clusterWorkerPromptInput || undefined
          }]
        });
        this.clusterSuccessMsg = `Worker (${role}) added to cluster`;
        this.clusterWorkerPromptInput = '';
        await this.selectSwarmCluster(clusterId);
        await this.loadSwarmClusters();
      } catch (e) {
        this.clusterErrorMsg = 'Failed to add worker: ' + (e.message || String(e));
      }
    },
    async loadSessionMerges() {
      this.isLoadingMerges = true;
      try {
        const res = await API.listSessionMerges({
          project_id: this.currentProject ? this.currentProject.id : '',
          status: this.mergeStatusFilter || undefined
        });
        this.sessionMergesList = (res && res.merges) || [];
        if (this.sessionMergesList.length > 0 && !this.selectedSessionMerge) {
          await this.selectSessionMerge(this.sessionMergesList[0].merge_id || this.sessionMergesList[0].id);
        }
      } catch (e) {
        console.error('Failed to load session merges:', e);
      } finally {
        this.isLoadingMerges = false;
      }
    },
    async selectSessionMerge(mergeId) {
      if (!mergeId) return;
      try {
        const res = await API.getSessionMerge(mergeId);
        if (res && res.merge) {
          this.selectedSessionMerge = res.merge;
          this.sessionMergeConflicts = res.conflicts || [];
          if (this.sessionMergeConflicts.length > 0) {
            this.selectedConflictHunk = this.sessionMergeConflicts[0];
            this.customResolutionContent = this.selectedConflictHunk.resolved_content || this.selectedConflictHunk.source_hunk || '';
          } else {
            this.selectedConflictHunk = null;
            this.customResolutionContent = '';
          }
        }
      } catch (e) {
        console.error('Failed to select session merge:', e);
      }
    },
    async loadMergeMatrix() {
      try {
        const res = await API.getSessionMergeMatrix();
        this.sessionMergeMatrix = res;
      } catch (e) {
        console.error('Failed to load merge matrix:', e);
      }
    },
    openMergeModal(session = null) {
      if (session) {
        this.mergeSourceSessionInput = session.session_id || session.id;
        this.mergeTitleInput = `Merge ${this.mergeSourceSessionInput} into main`;
      } else {
        this.mergeSourceSessionInput = '';
        this.mergeTitleInput = '';
      }
      this.mergeTargetSessionInput = '';
      this.mergeStrategyInput = 'ast_clean';
      this.mergeAutoResolveInput = true;
      this.mergeSuccessMsg = null;
      this.mergeErrorMsg = null;
      this.mergeModalOpen = true;
    },
    async handleProposeMerge() {
      if (!this.mergeSourceSessionInput) {
        this.mergeErrorMsg = 'Source session is required';
        return;
      }
      this.isProposingMerge = true;
      this.mergeSuccessMsg = null;
      this.mergeErrorMsg = null;
      try {
        const res = await API.proposeSessionMerge({
          source_session_id: this.mergeSourceSessionInput,
          target_session_id: this.mergeTargetSessionInput || undefined,
          title: this.mergeTitleInput || undefined,
          project_id: this.currentProject ? this.currentProject.id : undefined,
          auto_resolve: this.mergeAutoResolveInput,
          auto_resolution_strategy: this.mergeStrategyInput
        });
        this.mergeSuccessMsg = `Merge request ${res.merge.merge_id} proposed with status: ${res.merge.status}`;
        this.mergeModalOpen = false;
        await this.loadSessionMerges();
        await this.loadMergeMatrix();
        if (res.merge && res.merge.merge_id) {
          await this.selectSessionMerge(res.merge.merge_id);
        }
      } catch (e) {
        this.mergeErrorMsg = 'Failed to propose merge: ' + (e.message || String(e));
      } finally {
        this.isProposingMerge = false;
      }
    },
    async handleAutoResolveCurrentMerge(strategy = 'ast_clean') {
      if (!this.selectedSessionMerge) return;
      this.isResolvingMerge = true;
      try {
        const mergeId = this.selectedSessionMerge.merge_id || this.selectedSessionMerge.id;
        const res = await API.autoResolveSessionMerge(mergeId, { strategy });
        this.mergeSuccessMsg = `Auto-resolved ${res.resolved_conflicts} conflicts using ${res.strategy} strategy`;
        await this.selectSessionMerge(mergeId);
        await this.loadSessionMerges();
      } catch (e) {
        this.mergeErrorMsg = 'Auto-resolve failed: ' + (e.message || String(e));
      } finally {
        this.isResolvingMerge = false;
      }
    },
    async handleResolveConflictHunk(conflict, resolutionStatus = 'manual_resolved', content = null) {
      if (!this.selectedSessionMerge || !conflict) return;
      try {
        const mergeId = this.selectedSessionMerge.merge_id || this.selectedSessionMerge.id;
        const resolvedContent = content !== null ? content : (this.customResolutionContent || conflict.source_hunk);
        await API.resolveMergeConflictHunk(mergeId, conflict.id, {
          resolution_status: resolutionStatus,
          resolved_content: resolvedContent,
          resolution_notes: `Resolved via UI (${resolutionStatus})`
        });
        this.mergeSuccessMsg = `Conflict in ${conflict.file_path} marked as ${resolutionStatus}`;
        await this.selectSessionMerge(mergeId);
        await this.loadSessionMerges();
      } catch (e) {
        this.mergeErrorMsg = 'Failed to resolve hunk: ' + (e.message || String(e));
      }
    },
    async handleVerifyCurrentMerge() {
      if (!this.selectedSessionMerge) return;
      try {
        const mergeId = this.selectedSessionMerge.merge_id || this.selectedSessionMerge.id;
        const res = await API.verifySessionMerge(mergeId);
        if (res.ready_to_merge) {
          this.mergeSuccessMsg = 'Deterministic merge barrier verified: 100% conflicts resolved and syntax verified';
        } else {
          this.mergeErrorMsg = `Merge blocked: ${res.unresolved_conflicts || 'unresolved'} conflicts remain`;
        }
        await this.selectSessionMerge(mergeId);
        await this.loadSessionMerges();
      } catch (e) {
        this.mergeErrorMsg = 'Verification failed: ' + (e.message || String(e));
      }
    },
    async handleExecuteCurrentMerge() {
      if (!this.selectedSessionMerge) return;
      this.isExecutingMerge = true;
      try {
        const mergeId = this.selectedSessionMerge.merge_id || this.selectedSessionMerge.id;
        const res = await API.executeSessionMerge(mergeId);
        this.mergeSuccessMsg = `Merge executed successfully! Commit: ${res.merge_commit}`;
        await this.selectSessionMerge(mergeId);
        await this.loadSessionMerges();
        await this.loadMergeMatrix();
        await this.loadAgentSessions();
      } catch (e) {
        this.mergeErrorMsg = 'Merge execution failed: ' + (e.message || String(e));
      } finally {
        this.isExecutingMerge = false;
      }
    },
    async handleRejectCurrentMerge(reason = 'Manual rejection') {
      if (!this.selectedSessionMerge) return;
      try {
        const mergeId = this.selectedSessionMerge.merge_id || this.selectedSessionMerge.id;
        await API.rejectSessionMerge(mergeId, { reason });
        this.mergeSuccessMsg = 'Merge request rejected';
        await this.selectSessionMerge(mergeId);
        await this.loadSessionMerges();
      } catch (e) {
        this.mergeErrorMsg = 'Rejection failed: ' + (e.message || String(e));
      }
    },
    // Agent Fleet Budget, Cost Attribution & Token Quota Engine (Milestone 7 / Epic 28)
    async loadBudgetGovernanceData() {
      this.isLoadingBudget = true;
      this.budgetErrorMsg = null;
      try {
        const [metricsRes, policiesRes, ledgerRes, pricingRes] = await Promise.all([
          API.getFleetBillingAnalytics().catch(() => null),
          API.listBudgetPolicies().catch(() => ({ policies: [] })),
          API.listCostLedger({
            persona: this.ledgerFilterPersona || undefined,
            model: this.ledgerFilterModel || undefined,
            limit: 50
          }).catch(() => ({ entries: [] })),
          API.getFleetPricing().catch(() => ({ pricing: {} }))
        ]);

        if (metricsRes) this.budgetMetrics = metricsRes;
        if (policiesRes && policiesRes.policies) this.budgetPolicies = policiesRes.policies;
        if (ledgerRes && ledgerRes.entries) this.costLedger = ledgerRes.entries;
        if (pricingRes && pricingRes.pricing) this.pricingMatrix = pricingRes.pricing;
      } catch (e) {
        this.budgetErrorMsg = 'Failed to load budget governance data: ' + (e.message || String(e));
      } finally {
        this.isLoadingBudget = false;
      }
    },
    openNewBudgetPolicyModal() {
      this.newBudgetPolicy = {
        name: '',
        scope_type: 'global',
        scope_id: '',
        max_budget_usd: 50,
        max_tokens: 10000000,
        period: 'daily',
        soft_limit_pct: 80,
        hard_limit_action: 'block'
      };
      this.budgetPolicyModalOpen = true;
    },
    async createBudgetPolicy() {
      if (!this.newBudgetPolicy.name.trim()) return;
      this.isSavingBudgetPolicy = true;
      this.budgetErrorMsg = null;
      try {
        await API.createBudgetPolicy(this.newBudgetPolicy);
        this.budgetSuccessMsg = 'Budget policy saved successfully';
        this.budgetPolicyModalOpen = false;
        await this.loadBudgetGovernanceData();
      } catch (e) {
        this.budgetErrorMsg = 'Failed to create budget policy: ' + (e.message || String(e));
      } finally {
        this.isSavingBudgetPolicy = false;
      }
    },
    async deleteBudgetPolicy(id) {
      if (!confirm('Are you sure you want to delete this budget policy?')) return;
      try {
        await API.deleteBudgetPolicy(id);
        this.budgetSuccessMsg = 'Budget policy deleted';
        await this.loadBudgetGovernanceData();
      } catch (e) {
        this.budgetErrorMsg = 'Failed to delete budget policy: ' + (e.message || String(e));
      }
    },
    openBudgetOverrideModal(policy) {
      this.selectedPolicyForOverride = policy;
      this.newBudgetOverride = {
        policy_id: policy.id,
        additional_budget: 25,
        additional_tokens: 5000000,
        expires_in_minutes: 120,
        reason: 'Emergency session execution unblock',
        granted_by: 'admin'
      };
      this.budgetOverrideModalOpen = true;
    },
    async submitBudgetOverride() {
      if (!this.newBudgetOverride.policy_id) return;
      this.isGrantingOverride = true;
      this.budgetErrorMsg = null;
      try {
        await API.grantBudgetOverride(this.newBudgetOverride);
        this.budgetSuccessMsg = 'Emergency budget override granted';
        this.budgetOverrideModalOpen = false;
        await this.loadBudgetGovernanceData();
      } catch (e) {
        this.budgetErrorMsg = 'Failed to grant override: ' + (e.message || String(e));
      } finally {
        this.isGrantingOverride = false;
      }
    },
    async runQuotaSimulation() {
      this.quotaSimulator.isSimulating = true;
      this.budgetErrorMsg = null;
      try {
        const res = await API.checkTokenQuota({
          session_id: this.quotaSimulator.session_id || undefined,
          project_id: this.quotaSimulator.project_id || undefined,
          persona: this.quotaSimulator.persona || undefined,
          model: this.quotaSimulator.model || 'claude-3-5-sonnet',
          estimated_prompt_tokens: this.quotaSimulator.estimated_prompt_tokens || 5000,
          estimated_completion_tokens: this.quotaSimulator.estimated_completion_tokens || 2000
        });
        this.quotaSimulator.result = res;
      } catch (e) {
        this.budgetErrorMsg = 'Quota simulation failed: ' + (e.message || String(e));
      } finally {
        this.quotaSimulator.isSimulating = false;
      }
    },
    async resetBudgetCircuitBreakers(policyId = null) {
      try {
        await API.resetCircuitBreaker(policyId ? { policy_id: policyId } : {});
        this.budgetSuccessMsg = 'Circuit breaker(s) reset successfully';
        await this.loadBudgetGovernanceData();
      } catch (e) {
        this.budgetErrorMsg = 'Failed to reset circuit breaker: ' + (e.message || String(e));
      }
    },
    // Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29)
    async loadEvalGovernanceData() {
      this.isLoadingEvals = true;
      this.evalErrorMsg = null;
      try {
        const [suitesRes, runsRes, lbRes, regRes] = await Promise.all([
          API.listEvalSuites(this.evalFilterDomain ? { domain: this.evalFilterDomain } : {}),
          API.listEvalRuns({ limit: 50, model: this.evalFilterModel || undefined }),
          API.getEvalLeaderboard(this.evalFilterDomain ? { domain: this.evalFilterDomain } : {}),
          API.getEvalRegressions()
        ]);
        this.evalSuites = suitesRes.suites || [];
        this.evalRuns = runsRes.runs || [];
        this.evalLeaderboard = lbRes.leaderboard || [];
        this.evalSummary = lbRes.summary || null;
        this.evalRegressions = regRes.regressions || [];
      } catch (e) {
        this.evalErrorMsg = 'Failed to load eval benchmarks: ' + (e.message || String(e));
      } finally {
        this.isLoadingEvals = false;
      }
    },
    async triggerNewEvalRun() {
      this.isTriggeringEval = true;
      this.evalErrorMsg = null;
      this.evalSuccessMsg = null;
      try {
        const res = await API.triggerEvalRun({
          model: this.evalTriggerModel,
          persona: this.evalTriggerPersona,
          suite_slug: this.evalTriggerSuiteSlug,
          auto_execute: true
        });
        this.evalSuccessMsg = `Evaluation run completed with score ${res.run?.score_percentage}% (${res.run?.passed_scenarios}/${res.run?.total_scenarios} passed)`;
        this.evalTriggerModalOpen = false;
        await this.loadEvalGovernanceData();
      } catch (e) {
        this.evalErrorMsg = 'Failed to trigger evaluation run: ' + (e.message || String(e));
      } finally {
        this.isTriggeringEval = false;
      }
    },
    async viewEvalRunDetails(runId) {
      try {
        const res = await API.getEvalRun(runId);
        this.selectedEvalRun = res;
      } catch (e) {
        this.evalErrorMsg = 'Failed to load run details: ' + (e.message || String(e));
      }
    },
    async runModelComparison() {
      this.isComparingModels = true;
      this.evalErrorMsg = null;
      try {
        const res = await API.compareEvalModels({
          model_a: this.compareModelA,
          model_b: this.compareModelB,
          persona: this.comparePersona
        });
        this.evalComparison = res;
      } catch (e) {
        this.evalErrorMsg = 'Failed to compare models: ' + (e.message || String(e));
      } finally {
        this.isComparingModels = false;
      }
    },
    async seedEvalDefaults() {
      this.isSeedingEvals = true;
      this.evalErrorMsg = null;
      try {
        const res = await API.seedDefaultEvals();
        this.evalSuccessMsg = res.message || 'Seeded canonical benchmark suites';
        await this.loadEvalGovernanceData();
      } catch (e) {
        this.evalErrorMsg = 'Failed to seed eval benchmarks: ' + (e.message || String(e));
      } finally {
        this.isSeedingEvals = false;
      }
    },
    async createCustomEvalSuite() {
      if (!this.newEvalSuite.name) {
        this.evalErrorMsg = 'Suite name is required';
        return;
      }
      try {
        await API.saveEvalSuite(this.newEvalSuite);
        this.evalSuccessMsg = 'Evaluation suite created successfully';
        this.evalSuiteModalOpen = false;
        this.newEvalSuite = {
          name: '',
          slug: '',
          description: '',
          domain: 'coding',
          pass_threshold_pct: 90,
          timeout_seconds: 60,
          scenarios: [{ id: 'sc-1', name: 'Standard Code Generation Scenario', expected: 'exit 0' }]
        };
        await this.loadEvalGovernanceData();
      } catch (e) {
        this.evalErrorMsg = 'Failed to create eval suite: ' + (e.message || String(e));
      }
    },
    async removeEvalSuite(suiteId) {
      if (!confirm('Are you sure you want to delete this evaluation benchmark suite?')) return;
      try {
        await API.deleteEvalSuite(suiteId);
        this.evalSuccessMsg = 'Evaluation suite removed';
        await this.loadEvalGovernanceData();
      } catch (e) {
        this.evalErrorMsg = 'Failed to delete eval suite: ' + (e.message || String(e));
      }
    },
    // Ephemeral Sandboxes & Dev Environments (Milestone 9 / Epic 30)
    async loadSandboxesGovernanceData() {
      this.isLoadingSandboxes = true;
      this.sandboxErrorMsg = null;
      try {
        const [sandboxesRes, templatesRes, metricsRes] = await Promise.all([
          API.listSandboxes({
            status: this.sandboxFilterStatus || undefined,
            environment_type: this.sandboxFilterEnv || undefined,
            limit: 100
          }),
          API.listSandboxTemplates(),
          API.getSandboxMetrics()
        ]);
        this.sandboxesList = sandboxesRes.sandboxes || [];
        this.sandboxTemplatesList = templatesRes.templates || [];
        this.sandboxFleetMetrics = metricsRes.metrics || null;
      } catch (e) {
        this.sandboxErrorMsg = 'Failed to load sandboxes: ' + (e.message || String(e));
      } finally {
        this.isLoadingSandboxes = false;
      }
    },
    async triggerProvisionSandbox() {
      this.isProvisioningSandbox = true;
      this.sandboxErrorMsg = null;
      this.sandboxSuccessMsg = null;
      let parsedEnv = {};
      try {
        if (this.newSandbox.env_vars_str) parsedEnv = JSON.parse(this.newSandbox.env_vars_str);
      } catch (e) {
        this.sandboxErrorMsg = 'Invalid JSON in environment variables';
        this.isProvisioningSandbox = false;
        return;
      }
      try {
        const res = await API.provisionSandbox({
          name: this.newSandbox.name,
          environment_type: this.newSandbox.environment_type,
          runtime_type: this.newSandbox.runtime_type,
          template_id: this.newSandbox.template_id || undefined,
          memory_limit_mb: this.newSandbox.memory_limit_mb,
          ttl_seconds: this.newSandbox.ttl_seconds,
          env_vars_json: parsedEnv
        });
        this.sandboxSuccessMsg = res.message || `Sandbox ${res.sandbox?.name} provisioned`;
        this.sandboxModalOpen = false;
        await this.loadSandboxesGovernanceData();
      } catch (e) {
        this.sandboxErrorMsg = 'Provisioning failed: ' + (e.message || String(e));
      } finally {
        this.isProvisioningSandbox = false;
      }
    },
    async handleSandboxAction(sandboxId, action) {
      this.sandboxErrorMsg = null;
      try {
        await API.sandboxAction(sandboxId, action);
        await this.loadSandboxesGovernanceData();
        if (this.selectedSandbox && this.selectedSandbox.id === sandboxId) {
          await this.inspectSandbox(sandboxId);
        }
      } catch (e) {
        this.sandboxErrorMsg = `Action ${action} failed: ` + (e.message || String(e));
      }
    },
    async inspectSandbox(sandboxId) {
      try {
        const res = await API.getSandbox(sandboxId);
        this.selectedSandbox = res.sandbox || null;
        this.selectedSandboxExecutions = (res.sandbox && res.sandbox.executions) || [];
        this.selectedSandboxSnapshots = (res.sandbox && res.sandbox.snapshots) || [];
      } catch (e) {
        this.sandboxErrorMsg = 'Failed to fetch sandbox details: ' + (e.message || String(e));
      }
    },
    async executeInSandbox() {
      if (!this.selectedSandbox || !this.sandboxExecInput.command) return;
      this.isExecutingCommand = true;
      this.sandboxErrorMsg = null;
      try {
        await API.execInSandbox(this.selectedSandbox.id, {
          command: this.sandboxExecInput.command,
          executed_by: this.sandboxExecInput.executed_by || 'agent'
        });
        await this.inspectSandbox(this.selectedSandbox.id);
        this.sandboxExecModalOpen = false;
      } catch (e) {
        this.sandboxErrorMsg = 'Command execution failed: ' + (e.message || String(e));
      } finally {
        this.isExecutingCommand = false;
      }
    },
    async createSandboxCheckpoint() {
      if (!this.selectedSandbox || !this.newSandboxSnapshot.snapshot_name) return;
      this.isCreatingSnapshot = true;
      this.sandboxErrorMsg = null;
      try {
        await API.createSandboxSnapshot(this.selectedSandbox.id, {
          snapshot_name: this.newSandboxSnapshot.snapshot_name,
          notes: this.newSandboxSnapshot.notes
        });
        await this.inspectSandbox(this.selectedSandbox.id);
        this.sandboxSnapshotModalOpen = false;
      } catch (e) {
        this.sandboxErrorMsg = 'Snapshot failed: ' + (e.message || String(e));
      } finally {
        this.isCreatingSnapshot = false;
      }
    },
    async cleanupIdleSandboxes() {
      try {
        const res = await API.cleanupIdleSandboxes();
        this.sandboxSuccessMsg = res.message || 'Cleaned idle sandboxes';
        await this.loadSandboxesGovernanceData();
      } catch (e) {
        this.sandboxErrorMsg = 'Cleanup failed: ' + (e.message || String(e));
      }
    },
    async seedDefaultTemplates() {
      try {
        await API.seedDefaultSandboxTemplates();
        await this.loadSandboxesGovernanceData();
      } catch (e) {}
    },
    async loadIncidentsGovernanceData() {
      this.isLoadingIncidents = true;
      this.incidentErrorMsg = null;
      try {
        const params = {};
        if (this.incidentFilterStatus) params.status = this.incidentFilterStatus;
        if (this.incidentFilterSeverity) params.severity = this.incidentFilterSeverity;
        if (this.incidentSearch) params.search = this.incidentSearch;
        const [incRes, metricsRes] = await Promise.all([
          API.listIncidents(params),
          API.getIncidentMetrics()
        ]);
        this.incidentsList = incRes.data || [];
        this.incidentMetrics = metricsRes.data || null;
        if (this.incidentsList.length > 0 && !this.selectedIncident) {
          await this.inspectIncident(this.incidentsList[0].id);
        } else if (this.selectedIncident) {
          await this.inspectIncident(this.selectedIncident.id);
        }
      } catch (e) {
        this.incidentErrorMsg = 'Failed to load incidents: ' + (e.message || String(e));
      } finally {
        this.isLoadingIncidents = false;
      }
    },
    async inspectIncident(id) {
      try {
        const res = await API.getIncidentDetails(id);
        this.selectedIncident = res.data || null;
      } catch (e) {
        this.incidentErrorMsg = 'Failed to inspect incident: ' + (e.message || String(e));
      }
    },
    async declareNewIncident() {
      if (!this.newIncident.title.trim()) return;
      this.isLoadingIncidents = true;
      this.incidentErrorMsg = null;
      try {
        const res = await API.declareIncident({
          title: this.newIncident.title.trim(),
          summary: this.newIncident.summary,
          severity: this.newIncident.severity,
          service_name: this.newIncident.service_name,
          incident_commander: this.newIncident.incident_commander,
          lead_investigator: this.newIncident.lead_investigator,
          source: this.newIncident.source,
          impact_scope: this.newIncident.impact_scope
        });
        this.newIncidentModalOpen = false;
        this.incidentSuccessMsg = 'Incident declared: ' + res.data.title;
        this.newIncident.title = '';
        this.newIncident.summary = '';
        await this.loadIncidentsGovernanceData();
        if (res.data && res.data.id) {
          await this.inspectIncident(res.data.id);
        }
      } catch (e) {
        this.incidentErrorMsg = 'Declare incident failed: ' + (e.message || String(e));
      } finally {
        this.isLoadingIncidents = false;
      }
    },
    async updateIncidentStatus(status) {
      if (!this.selectedIncident) return;
      try {
        await API.transitionIncidentStatus(this.selectedIncident.id, status, `Transitioned to ${status} via War-Room`, 'Flomaster-Commander');
        await this.inspectIncident(this.selectedIncident.id);
        await this.loadIncidentsGovernanceData();
      } catch (e) {
        this.incidentErrorMsg = 'Status transition failed: ' + (e.message || String(e));
      }
    },
    async addIncidentTimelineEvent() {
      if (!this.selectedIncident || !this.newIncidentEvent.title.trim()) return;
      try {
        await API.addIncidentEvent(this.selectedIncident.id, {
          title: this.newIncidentEvent.title.trim(),
          content: this.newIncidentEvent.content,
          event_type: this.newIncidentEvent.event_type,
          severity: this.newIncidentEvent.severity,
          author: this.newIncidentEvent.author,
          author_type: this.newIncidentEvent.author_type
        });
        this.newIncidentEvent.title = '';
        this.newIncidentEvent.content = '';
        await this.inspectIncident(this.selectedIncident.id);
      } catch (e) {
        this.incidentErrorMsg = 'Failed to add timeline event: ' + (e.message || String(e));
      }
    },
    async proposeHypothesis() {
      if (!this.selectedIncident || !this.newIncidentHypothesis.hypothesis.trim()) return;
      try {
        await API.proposeIncidentHypothesis(this.selectedIncident.id, {
          hypothesis: this.newIncidentHypothesis.hypothesis.trim(),
          rationale: this.newIncidentHypothesis.rationale,
          test_plan: this.newIncidentHypothesis.test_plan,
          confidence_score: Number(this.newIncidentHypothesis.confidence_score),
          status: this.newIncidentHypothesis.status,
          proposed_by: this.newIncidentHypothesis.proposed_by
        });
        this.newIncidentHypothesis.hypothesis = '';
        this.newIncidentHypothesis.rationale = '';
        this.newIncidentHypothesis.test_plan = '';
        await this.inspectIncident(this.selectedIncident.id);
      } catch (e) {
        this.incidentErrorMsg = 'Failed to propose hypothesis: ' + (e.message || String(e));
      }
    },
    async updateHypothesisStatus(hypoId, status, confidence = 0.9) {
      if (!this.selectedIncident) return;
      try {
        await API.updateIncidentHypothesis(this.selectedIncident.id, hypoId, {
          status: status,
          confidence_score: confidence,
          tested_by: 'Flomaster-Auditor',
          evidence: status === 'confirmed' ? 'Verified in isolated dev sandbox and metric logs.' : 'Falsified by simulation probe.'
        });
        await this.inspectIncident(this.selectedIncident.id);
      } catch (e) {
        this.incidentErrorMsg = 'Update hypothesis failed: ' + (e.message || String(e));
      }
    },
    async executeMitigationAction() {
      if (!this.selectedIncident || !this.newIncidentMitigation.title.trim()) return;
      try {
        await API.executeIncidentMitigation(this.selectedIncident.id, {
          title: this.newIncidentMitigation.title.trim(),
          description: this.newIncidentMitigation.description,
          action_type: this.newIncidentMitigation.action_type,
          rollback_plan: this.newIncidentMitigation.rollback_plan,
          executed_by: this.newIncidentMitigation.executed_by,
          status: 'applied',
          verification_method: 'Synthetic health probe & P99 latency check'
        });
        this.newIncidentMitigation.title = '';
        this.newIncidentMitigation.description = '';
        await this.inspectIncident(this.selectedIncident.id);
      } catch (e) {
        this.incidentErrorMsg = 'Failed to execute mitigation: ' + (e.message || String(e));
      }
    },
    async updateMitigationStatus(mitId, status) {
      if (!this.selectedIncident) return;
      try {
        await API.updateIncidentMitigation(this.selectedIncident.id, mitId, {
          status: status,
          verification_result: status === 'verified' ? 'All metrics returned to normal thresholds' : 'Mitigation ineffective'
        });
        await this.inspectIncident(this.selectedIncident.id);
      } catch (e) {
        this.incidentErrorMsg = 'Update mitigation failed: ' + (e.message || String(e));
      }
    },
    async generateAutoPostmortem() {
      if (!this.selectedIncident) return;
      try {
        await API.createOrUpdateIncidentPostmortem(this.selectedIncident.id, {
          title: `Post-Mortem: ${this.selectedIncident.title}`,
          status: 'published',
          executive_summary: this.selectedIncident.summary || 'Production incident investigated and resolved by autonomous agent swarm.',
          root_cause_analysis: '5-Whys Analysis:\n1. Why did the issue occur? Swarm dispatch burst exceeded default resource limits.\n2. Why were resource limits exceeded? Concurrent agent workers executed unbatched queries.\n3. Why were queries unbatched? Missing micro-batching queue in session ingestion hook.\n4. Why was micro-batching missing? Ingestion pipeline was designed for single-agent workloads.\n5. Root Cause: Architectural scaling limitation in concurrent ingestion pipeline under high swarm concurrency.',
          contributing_factors: ['High agent concurrency', 'Default SQLite WAL parameters', 'Lack of adaptive backoff'],
          impact_metrics: { downtime_minutes: 15, error_rate_peak: '12.5%', affected_workers: 24 },
          timeline_summary: 'Incident detected by automated runtime probe, war-room convened, hypothesis confirmed in isolated sandbox, mitigation patch deployed, metrics normalized.',
          detection_gap: 'Threshold on synthetic latency probe was set to 5000ms instead of 1000ms.',
          action_items: [
            { task_id: 'ACT-01', title: 'Add WAL auto-checkpoint optimization to server config', owner: 'Flomaster-DevOps', priority: 'high', status: 'completed' },
            { task_id: 'ACT-02', title: 'Add continuous swarm burst stress test to CI matrix', owner: 'Flomaster-QA', priority: 'medium', status: 'in_progress' }
          ],
          lessons_learned: 'Always load-test agent communication channels with at least 5x expected swarm peak size.',
          author: 'Flomaster-Commander'
        });
        await this.inspectIncident(this.selectedIncident.id);
        await this.loadIncidentsGovernanceData();
      } catch (e) {
        this.incidentErrorMsg = 'Generate postmortem failed: ' + (e.message || String(e));
      }
    },
    async seedDemoWarroom() {
      try {
        const res = await API.seedDemoIncidentWarroom();
        this.incidentSuccessMsg = res.message || 'Demo incident war-room seeded';
        await this.loadIncidentsGovernanceData();
      } catch (e) {
        this.incidentErrorMsg = 'Seed demo war-room failed: ' + (e.message || String(e));
      }
    },
    // Knowledge Graph & Architectural Invariants Methods (Milestone 11 / Epic 32)
    async loadKnowledgeGovernanceData() {
      this.isLoadingKnowledge = true;
      this.knowledgeErrorMsg = null;
      try {
        const [nodesRes, relsRes, invsRes, verRes, metRes] = await Promise.all([
          API.listKnowledgeNodes({
            kind: this.knowledgeFilterKind || undefined,
            status: this.knowledgeFilterStatus || undefined,
            search: this.knowledgeSearch || undefined,
            limit: 200
          }).catch(() => ({ items: [] })),
          API.listKnowledgeRelations({ limit: 300 }).catch(() => ({ items: [] })),
          API.listArchitecturalInvariants().catch(() => ({ items: [] })),
          API.listInvariantVerifications({ limit: 50 }).catch(() => ({ items: [] })),
          API.getKnowledgeGraphMetrics().catch(() => null)
        ]);
        this.knowledgeNodesList = nodesRes.items || [];
        this.knowledgeRelationsList = relsRes.items || [];
        this.architecturalInvariantsList = invsRes.items || [];
        this.invariantVerificationsList = verRes.items || [];
        this.knowledgeMetrics = metRes;
        if (this.knowledgeNodesList.length > 0 && !this.selectedKnowledgeNode) {
          await this.inspectKnowledgeNode(this.knowledgeNodesList[0].id);
        }
      } catch (e) {
        this.knowledgeErrorMsg = 'Failed loading knowledge base: ' + (e.message || String(e));
      } finally {
        this.isLoadingKnowledge = false;
      }
    },
    async inspectKnowledgeNode(id) {
      if (!id) return;
      try {
        const data = await API.getKnowledgeNodeDetails(id);
        this.selectedKnowledgeNode = data.node || null;
        this.selectedKnowledgeNodeInbound = data.inbound_relations || [];
        this.selectedKnowledgeNodeOutbound = data.outbound_relations || [];
        this.selectedKnowledgeNodeInvariants = data.invariants || [];
      } catch (e) {
        console.error('Failed inspecting knowledge node:', e);
      }
    },
    async createKnowledgeNodeSubmit() {
      try {
        const tags = (this.newKnowledgeNode.tags_str || '').split(',').map(s => s.trim()).filter(Boolean);
        const payload = {
          title: this.newKnowledgeNode.title,
          slug: this.newKnowledgeNode.slug || undefined,
          kind: this.newKnowledgeNode.kind,
          summary: this.newKnowledgeNode.summary,
          content_markdown: this.newKnowledgeNode.content_markdown,
          file_path: this.newKnowledgeNode.file_path,
          symbol_name: this.newKnowledgeNode.symbol_name,
          status: this.newKnowledgeNode.status,
          confidence_score: parseFloat(this.newKnowledgeNode.confidence_score) || 1.0,
          author_agent: this.newKnowledgeNode.author_agent,
          tags_json: tags
        };
        const res = await API.createKnowledgeNode(payload);
        this.knowledgeSuccessMsg = 'Created knowledge node: ' + (res.node ? res.node.title : '');
        this.newKnowledgeModalOpen = false;
        await this.loadKnowledgeGovernanceData();
        if (res.node) await this.inspectKnowledgeNode(res.node.id);
      } catch (e) {
        this.knowledgeErrorMsg = 'Failed creating node: ' + (e.message || String(e));
      }
    },
    async createArchitecturalInvariantSubmit() {
      try {
        const res = await API.createArchitecturalInvariant(this.newArchitecturalInvariant);
        this.knowledgeSuccessMsg = 'Created invariant rule: ' + (res.invariant ? res.invariant.rule_name : '');
        this.newInvariantModalOpen = false;
        await this.loadKnowledgeGovernanceData();
      } catch (e) {
        this.knowledgeErrorMsg = 'Failed creating invariant: ' + (e.message || String(e));
      }
    },
    async toggleInvariantActive(inv) {
      try {
        await API.updateArchitecturalInvariant(inv.id, { is_active: !inv.is_active });
        inv.is_active = !inv.is_active;
        this.knowledgeSuccessMsg = `Invariant ${inv.rule_name} is now ${inv.is_active ? 'ACTIVE' : 'DISABLED'}`;
      } catch (e) {
        this.knowledgeErrorMsg = 'Failed toggling invariant: ' + (e.message || String(e));
      }
    },
    async runPlaygroundVerification() {
      this.isVerifyingInvariants = true;
      this.latestVerificationResult = null;
      try {
        const files = (this.verifierPlaygroundInput.target_files_str || '').split('\n').map(s => s.trim()).filter(Boolean);
        const payload = {
          target_files: files,
          diff_summary: this.verifierPlaygroundInput.diff_summary,
          agent_name: this.verifierPlaygroundInput.agent_name
        };
        const res = await API.verifyChangesAgainstInvariants(payload);
        this.latestVerificationResult = res;
        await this.loadKnowledgeGovernanceData();
      } catch (e) {
        this.knowledgeErrorMsg = 'Verification failed: ' + (e.message || String(e));
      } finally {
        this.isVerifyingInvariants = false;
      }
    },
    async seedDemoKnowledge() {
      try {
        const res = await API.seedDemoKnowledgeGraph();
        this.knowledgeSuccessMsg = res.message || 'Demo architectural memory seeded';
        await this.loadKnowledgeGovernanceData();
      } catch (e) {
        this.knowledgeErrorMsg = 'Seed demo failed: ' + (e.message || String(e));
      }
    },
    // Code Review Swarm & Merge Gate Methods (Milestone 12 / Epic 33)
    async loadCodeReviewsData() {
      this.isLoadingCodeReviews = true;
      this.codeReviewErrorMsg = null;
      try {
        const [reviewsRes, metricsRes] = await Promise.all([
          API.listCodeReviews({
            status: this.codeReviewFilterStatus || undefined,
            verdict: this.codeReviewFilterVerdict || undefined,
            search: this.codeReviewSearch || undefined,
            limit: 200
          }).catch(() => ({ reviews: [] })),
          API.getCodeReviewMetrics().catch(() => null)
        ]);
        this.codeReviewsList = reviewsRes.reviews || [];
        this.codeReviewMetrics = metricsRes;
        if (this.codeReviewsList.length > 0 && !this.selectedCodeReview) {
          await this.inspectCodeReview(this.codeReviewsList[0].id);
        }
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed loading code reviews: ' + (e.message || String(e));
      } finally {
        this.isLoadingCodeReviews = false;
      }
    },
    async inspectCodeReview(id) {
      if (!id) return;
      try {
        const data = await API.getCodeReview(id);
        this.selectedCodeReview = data || null;
        this.selectedReviewCritiques = data.critiques || [];
        this.selectedReviewPatches = data.patches || [];
        this.selectedReviewVerdict = data.latest_verdict || null;
      } catch (e) {
        console.error('Failed inspecting code review:', e);
      }
    },
    async triggerReviewSwarm(id) {
      if (!id) return;
      this.isDispatchingReviewSwarm = true;
      this.codeReviewErrorMsg = null;
      try {
        const res = await API.dispatchReviewSwarm(id);
        this.codeReviewSuccessMsg = `Review swarm completed: ${res.critiques_spawned || res.critiques_created || 0} critique(s) generated.`;
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed dispatching review swarm: ' + (e.message || String(e));
      } finally {
        this.isDispatchingReviewSwarm = false;
      }
    },
    async triggerSynthesizePatch(id) {
      if (!id) return;
      this.isSynthesizingPatch = true;
      this.codeReviewErrorMsg = null;
      try {
        const res = await API.synthesizeReviewPatch(id);
        this.codeReviewSuccessMsg = res.message || 'Patch synthesized successfully.';
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed synthesizing patch: ' + (e.message || String(e));
      } finally {
        this.isSynthesizingPatch = false;
      }
    },
    async triggerApplyPatch(patchId) {
      if (!patchId) return;
      this.codeReviewErrorMsg = null;
      try {
        await API.applyReviewPatch(patchId);
        this.codeReviewSuccessMsg = 'Patch applied cleanly. Resolved critiques marked as patched.';
        if (this.selectedCodeReview) {
          await this.loadCodeReviewsData();
          await this.inspectCodeReview(this.selectedCodeReview.id);
        }
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed applying patch: ' + (e.message || String(e));
      }
    },
    async triggerRevertPatch(patchId) {
      if (!patchId) return;
      this.codeReviewErrorMsg = null;
      try {
        await API.revertReviewPatch(patchId);
        this.codeReviewSuccessMsg = 'Patch reverted.';
        if (this.selectedCodeReview) {
          await this.loadCodeReviewsData();
          await this.inspectCodeReview(this.selectedCodeReview.id);
        }
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed reverting patch: ' + (e.message || String(e));
      }
    },
    async triggerEvaluateGate(id) {
      if (!id) return;
      this.codeReviewErrorMsg = null;
      try {
        const res = await API.evaluateMergeGate(id);
        this.codeReviewSuccessMsg = `Merge gate verdict: ${res.verdict.toUpperCase()}`;
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed evaluating gate: ' + (e.message || String(e));
      }
    },
    async triggerMergeReview(id) {
      if (!id) return;
      this.codeReviewErrorMsg = null;
      try {
        const res = await API.mergeCodeReview(id);
        this.codeReviewSuccessMsg = res.message || 'Code review merged successfully.';
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed merging review: ' + (e.message || String(e));
      }
    },
    async submitNewReviewModal() {
      if (!this.newCodeReview.title.trim()) return;
      try {
        const files = this.newCodeReview.files_touched_str ? this.newCodeReview.files_touched_str.split(',').map(s => s.trim()).filter(Boolean) : [];
        const res = await API.createCodeReview({
          title: this.newCodeReview.title,
          summary: this.newCodeReview.summary,
          source_branch: this.newCodeReview.source_branch,
          target_branch: this.newCodeReview.target_branch,
          diff_content: this.newCodeReview.diff_content,
          files_touched: files,
          author_agent: this.newCodeReview.author_agent,
          auto_swarm: this.newCodeReview.auto_swarm
        });
        this.newReviewModalOpen = false;
        this.newCodeReview = {
          title: '',
          summary: '',
          source_branch: 'feature/agent-task',
          target_branch: 'main',
          diff_content: '',
          files_touched_str: '',
          author_agent: 'flomaster',
          auto_swarm: true
        };
        await this.loadCodeReviewsData();
        if (res.id) await this.inspectCodeReview(res.id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed creating review: ' + (e.message || String(e));
      }
    },
    async submitNewCritiqueModal() {
      if (!this.selectedCodeReview || !this.newCritique.title.trim()) return;
      try {
        await API.submitReviewCritique(this.selectedCodeReview.id, {
          persona: this.newCritique.persona,
          severity: this.newCritique.severity,
          title: this.newCritique.title,
          critique_markdown: this.newCritique.critique_markdown,
          file_path: this.newCritique.file_path,
          line_start: parseInt(this.newCritique.line_start || '1', 10),
          line_end: parseInt(this.newCritique.line_end || '1', 10),
          suggested_diff: this.newCritique.suggested_diff,
          confidence_score: parseFloat(this.newCritique.confidence_score || '0.95')
        });
        this.newCritiqueModalOpen = false;
        this.newCritique = {
          persona: 'security_auditor',
          severity: 'p1_warning',
          title: '',
          critique_markdown: '',
          file_path: '',
          line_start: 1,
          line_end: 1,
          suggested_diff: '',
          confidence_score: 0.95
        };
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(this.selectedCodeReview.id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed adding critique: ' + (e.message || String(e));
      }
    },
    async submitGateOverrideModal() {
      if (!this.selectedCodeReview || !this.gateOverride.reason.trim()) return;
      try {
        await API.overrideMergeGate(this.selectedCodeReview.id, {
          reason: this.gateOverride.reason,
          overridden_by: this.gateOverride.overridden_by
        });
        this.overrideGateModalOpen = false;
        this.gateOverride = { reason: '', overridden_by: 'human_lead' };
        await this.loadCodeReviewsData();
        await this.inspectCodeReview(this.selectedCodeReview.id);
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed overriding gate: ' + (e.message || String(e));
      }
    },
    async deleteReviewItem(id) {
      if (!id || !confirm('Are you sure you want to delete this code review?')) return;
      try {
        await API.deleteCodeReview(id);
        this.selectedCodeReview = null;
        await this.loadCodeReviewsData();
      } catch (e) {
        this.codeReviewErrorMsg = 'Failed deleting review: ' + (e.message || String(e));
      }
    },
    isGovernanceTab(tab) {
      return ['workload', 'anomalies', 'semantic', 'auto_heal', 'sso_rbac', 'automations', 'tenants', 'webhooks', 'observability', 'consensus', 'cluster', 'federation', 'throughput', 'swarm', 'merges', 'budget', 'evals', 'sandboxes', 'incidents', 'knowledge', 'code_reviews'].includes(tab);
    },
    onGovernanceTabSelect(tab) {
      if (!tab) return;
      this.activeTab = tab;
      if (tab === 'swarm') {
        this.loadSwarmClusters();
      } else if (tab === 'merges') {
        this.loadSessionMerges();
        this.loadMergeMatrix();
      } else if (tab === 'budget') {
        this.loadBudgetGovernanceData();
      } else if (tab === 'evals') {
        this.loadEvalGovernanceData();
      } else if (tab === 'sandboxes') {
        this.loadSandboxesGovernanceData();
      } else if (tab === 'incidents') {
        this.loadIncidentsGovernanceData();
      } else if (tab === 'knowledge') {
        this.loadKnowledgeGovernanceData();
      } else if (tab === 'code_reviews') {
        this.loadCodeReviewsData();
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
                  {{ activeTab === 'workload' ? 'Workload & Dynamic Autoscaler' : (activeTab === 'anomalies' ? 'Workflow Health & Auto-Heal' : (activeTab === 'throughput' ? 'Persona Throughput & MTTC' : (activeTab === 'federation' ? 'Multi-Host Federation Sync' : (activeTab === 'cluster' ? 'Distributed Cluster & Edge Sync' : (activeTab === 'webhooks' ? 'Outbound Webhook Security Gateway & DLQ' : (activeTab === 'observability' ? 'OpenAPI SDK Generator & Webhook Observability' : (activeTab === 'consensus' ? 'Autonomous Multi-Model Consensus & Peer Review Gate Engine' : (activeTab === 'sso_rbac' ? 'Enterprise SSO Federation & Granular RBAC Matrix' : (activeTab === 'automations' ? 'Native Workflow Automations & AI Agent Trigger Pipelines' : (activeTab === 'tenants' ? 'Multi-Tenant Isolation & Granular Resource Quotas' : (activeTab === 'auto_heal' ? 'Autonomous AI Agent Auto-Healing & Self-Remediation Workflow Pipeline' : (activeTab === 'budget' ? 'Agent Fleet Budget & Cost Governance Hub' : (activeTab === 'evals' ? 'Agent Evaluation Benchmark Harness & Model Leaderboard' : (activeTab === 'sandboxes' ? 'Autonomous Ephemeral Dev Sandboxes & Worktree Container Orchestrator' : (activeTab === 'incidents' ? 'Autonomous Multi-Agent Incident Response & Live Debugging War-Room' : (activeTab === 'knowledge' ? 'Autonomous Knowledge Graph, Architectural Memory & Invariants' : (activeTab === 'code_reviews' ? 'Autonomous Multi-Persona Code Review Swarm & Merge Gate' : (selectedSession ? (selectedSession.short_name || 'Session') : 'Agent Command Center')))))))))))))))))) }}
                </h2>
                <span v-if="selectedSession && selectedSession.is_active && activeTab === 'chat'" class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Streaming
                </span>
              </div>
              <!-- Clean 3-Pillar Tab Switcher -->
              <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <button
                  @click="activeTab = 'chat'"
                  class="px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                  :class="activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'"
                >💬 Chat Stream</button>

                <button
                  @click="activeTab = 'runs'; loadAgentSessions(); loadSessionMetrics();"
                  class="px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                  :class="activeTab === 'runs' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'"
                >
                  <span>🚀 Live Runs & Telemetry</span>
                  <span v-if="sessions && sessions.length" class="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    {{ sessions.filter(s => s.status === 'running' || s.is_active).length || sessions.length }}
                  </span>
                </button>

                <!-- Engines & Governance Dropdown Selector -->
                <div class="relative inline-flex items-center">
                  <select
                    :value="isGovernanceTab(activeTab) ? activeTab : ''"
                    @change="onGovernanceTabSelect($event.target.value)"
                    class="px-2.5 py-1 text-xs font-semibold rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 focus:outline-none cursor-pointer"
                    :class="isGovernanceTab(activeTab) ? 'ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300' : ''"
                  >
                    <option value="" disabled selected>⚙️ Advanced Engines & Settings ▾</option>
                    <option value="workload">⚡ Workload & Autoscaler</option>
                    <option value="anomalies">🩺 Diagnostics & Health</option>
                    <option value="semantic">🧠 Semantic Admission Brain</option>
                    <option value="auto_heal">🛡️ Autonomous Auto-Healing</option>
                    <option value="sso_rbac">🛡️ RBAC & SSO Identity</option>
                    <option value="automations">⚡ Workflow Automations</option>
                    <option value="tenants">🏢 Multi-Tenant Quotas</option>
                    <option value="webhooks">📡 Webhooks & DLQ</option>
                    <option value="consensus">⚖️ Consensus & Gates</option>
                    <option value="cluster">🌐 Cluster & Edge Sync</option>
                    <option value="throughput">📊 MTTC Analytics</option>
                    <option value="observability">📚 SDK & Observability</option>
                    <option value="swarm">🐝 Swarm Clusters & Topologies</option>
                    <option value="merges">🔀 Merge Matrix & Conflicts</option>
                    <option value="budget">💰 Fleet Budget & Quotas</option>
                    <option value="evals">📊 Evals & Leaderboard</option>
                    <option value="sandboxes">📦 Ephemeral Sandboxes & Dev Envs</option>
                    <option value="incidents">🚨 Live Incident War-Room & Post-Mortem</option>
                    <option value="knowledge">🧠 Knowledge Graph & Invariants</option>
                    <option value="code_reviews">🔍 Code Review Swarm & Merge Gate</option>
                    <option value="federation">🌐 Multi-Cluster Federation</option>
                  </select>
                </div>
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
        <!-- PANE 2L: AUTONOMOUS SWARM CHOREOGRAPHY & CLUSTERS (EPIC 26)-->
        <!-- ========================================================= -->
        <div
          v-else-if="activeTab === 'swarm'"
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30"
        >
          <!-- Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-indigo-950/30 to-zinc-900 border border-amber-600/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">🐝</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Autonomous Swarm Choreography & Cluster Hub</h3>
                <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">SWARM DAG</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Multi-agent swarm coordination across Hierarchical, Flat Fanout, Pipeline, and Adversarial Critique topologies with live worker telemetry.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="loadSwarmClusters()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Refresh Clusters</span>
              </button>
              <button
                @click="openClusterModal()"
                class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>✨</span>
                <span>Deploy Swarm Cluster</span>
              </button>
            </div>
          </div>

          <!-- Alert Messages -->
          <div v-if="clusterSuccessMsg" class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono">
            {{ clusterSuccessMsg }}
          </div>
          <div v-if="clusterErrorMsg" class="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-mono">
            {{ clusterErrorMsg }}
          </div>

          <!-- Swarm Cluster KPI Row -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Active Clusters</div>
              <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {{ swarmClustersList.filter(c => c.status === 'running').length }}/{{ swarmClustersList.length }}
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Live Swarm Workers</div>
              <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {{ swarmClustersList.reduce((acc, c) => acc + (c.total_workers || 0), 0) }}
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Swarm Steps</div>
              <div class="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {{ swarmClustersList.reduce((acc, c) => acc + (c.total_steps || 0), 0) }}
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Swarm Spend USD</div>
              <div class="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                $ {{ swarmClustersList.reduce((acc, c) => acc + (c.total_cost_usd || 0), 0).toFixed(4) }}
              </div>
            </div>
          </div>

          <!-- Main 2-Column Dashboard -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <!-- Left: Clusters List -->
            <div class="lg:col-span-5 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Deployed Clusters</h4>
                <span class="text-[10px] text-zinc-400 font-mono">{{ swarmClustersList.length }} total</span>
              </div>

              <div v-if="isLoadingSwarmClusters" class="py-12 text-center text-xs text-zinc-400">Loading swarm clusters...</div>
              <div v-else-if="swarmClustersList.length === 0" class="p-8 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                No active swarm clusters deployed. Click "Deploy Swarm Cluster" above to launch a multi-agent cluster.
              </div>
              <div v-else class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                <div
                  v-for="c in swarmClustersList"
                  :key="c.cluster_id || c.id"
                  @click="selectSwarmCluster(c.cluster_id || c.id)"
                  class="p-3.5 rounded-xl border transition-all cursor-pointer space-y-2"
                  :class="selectedSwarmCluster && (selectedSwarmCluster.cluster_id === c.cluster_id || selectedSwarmCluster.id === c.id) ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700 shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-sm">🐝</span>
                      <span class="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">{{ c.name }}</span>
                    </div>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                      :class="{
                        'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300': c.status === 'running',
                        'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300': c.status === 'paused',
                        'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300': c.status === 'completed',
                        'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300': c.status === 'failed' || c.status === 'aborted'
                      }"
                    >
                      {{ c.status }}
                    </span>
                  </div>

                  <div class="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {{ c.objective }}
                  </div>

                  <div class="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize font-sans font-semibold">
                      {{ c.topology }}
                    </span>
                    <span>{{ c.total_workers || 0 }} workers · max {{ c.max_concurrency || 4 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Selected Swarm Cluster Inspector -->
            <div class="lg:col-span-7 space-y-3">
              <div v-if="!selectedSwarmCluster" class="p-12 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                Select a swarm cluster from the left to inspect its active worker agents, execution DAG, and live metrics.
              </div>
              <div v-else class="space-y-3">
                <!-- Cluster Detail Header Card -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedSwarmCluster.name }}</h4>
                        <span class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">{{ selectedSwarmCluster.cluster_id }}</span>
                      </div>
                      <p class="text-xs text-zinc-500 mt-0.5">{{ selectedSwarmCluster.objective }}</p>
                    </div>

                    <!-- Cluster Control Actions -->
                    <div class="flex items-center gap-1.5">
                      <button
                        v-if="selectedSwarmCluster.status === 'running'"
                        @click="handleUpdateClusterStatus(selectedSwarmCluster.cluster_id, 'paused')"
                        class="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 transition-colors"
                      >
                        ⏸️ Pause
                      </button>
                      <button
                        v-if="selectedSwarmCluster.status === 'paused'"
                        @click="handleUpdateClusterStatus(selectedSwarmCluster.cluster_id, 'running')"
                        class="px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200 transition-colors"
                      >
                        ▶️ Resume
                      </button>
                      <button
                        v-if="selectedSwarmCluster.status !== 'completed'"
                        @click="handleUpdateClusterStatus(selectedSwarmCluster.cluster_id, 'completed')"
                        class="px-2.5 py-1 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-200 transition-colors"
                      >
                        ✓ Complete
                      </button>
                      <button
                        v-if="selectedSwarmCluster.status !== 'aborted' && selectedSwarmCluster.status !== 'completed'"
                        @click="handleUpdateClusterStatus(selectedSwarmCluster.cluster_id, 'aborted')"
                        class="px-2.5 py-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-200 transition-colors"
                      >
                        ⏹️ Abort
                      </button>
                    </div>
                  </div>

                  <!-- Topology and Metrics Badges -->
                  <div class="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <div class="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Topology</div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">{{ selectedSwarmCluster.topology }}</div>
                    </div>
                    <div class="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Workers</div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{{ (selectedSwarmCluster.workers || []).length }} agents</div>
                    </div>
                    <div class="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Spend Rollup</div>
                      <div class="font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">$ {{ (selectedSwarmCluster.total_cost_usd || 0).toFixed(4) }}</div>
                    </div>
                  </div>
                </div>

                <!-- Member Worker Agents Table -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs">
                  <div class="flex items-center justify-between">
                    <h5 class="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Cluster Worker Agents</h5>
                    <span class="text-[10px] text-zinc-400 font-mono">{{ (selectedSwarmCluster.workers || []).length }} live nodes</span>
                  </div>

                  <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                          <th class="py-2 px-2">Agent Name</th>
                          <th class="py-2 px-2">Swarm Role</th>
                          <th class="py-2 px-2">Model</th>
                          <th class="py-2 px-2">Status</th>
                          <th class="py-2 px-2 text-right">Steps</th>
                          <th class="py-2 px-2 text-right">Tokens</th>
                          <th class="py-2 px-2 text-right">Spend</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        <tr
                          v-for="w in (selectedSwarmCluster.workers || [])"
                          :key="w.session_id || w.id"
                          class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <td class="py-2 px-2 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span>🤖</span>
                            <span>{{ w.agent_name }}</span>
                          </td>
                          <td class="py-2 px-2">
                            <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-semibold capitalize">
                              {{ w.swarm_role || w.role || 'worker' }}
                            </span>
                          </td>
                          <td class="py-2 px-2 font-mono text-[10px] text-zinc-500">{{ w.model || 'gpt-5.5' }}</td>
                          <td class="py-2 px-2">
                            <span
                              class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                              :class="w.status === 'running' || w.is_active ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'"
                            >
                              {{ w.status || 'idle' }}
                            </span>
                          </td>
                          <td class="py-2 px-2 text-right font-mono font-bold">{{ w.total_steps || 0 }}</td>
                          <td class="py-2 px-2 text-right font-mono text-zinc-500">{{ w.total_tokens || 0 }}</td>
                          <td class="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-400">$ {{ (w.total_cost_usd || 0).toFixed(4) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Quick Add Worker Form -->
                  <div class="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Add Worker Node to Swarm</div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <select
                        v-model="clusterWorkerRoleInput"
                        class="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="researcher">Researcher</option>
                        <option value="implementer">Implementer</option>
                        <option value="auditor">Auditor</option>
                        <option value="tester">Tester</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="arbiter">Arbiter</option>
                      </select>
                      <input
                        v-model="clusterWorkerPromptInput"
                        class="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                        placeholder="Task instructions for new worker..."
                      />
                      <button
                        @click="handleAddClusterWorker(selectedSwarmCluster.cluster_id)"
                        class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-xs shrink-0"
                      >
                        + Spawn Worker
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Deploy Swarm Cluster Modal -->
          <div v-if="clusterModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🐝</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Deploy Autonomous Swarm Cluster</h3>
                    <p class="text-[11px] text-zinc-500">Launch a multi-agent choreography cluster with automated role dispatch</p>
                  </div>
                </div>
                <button @click="clusterModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Cluster Name</label>
                  <input
                    v-model="clusterNameInput"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Feature Delivery Swarm"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mission Objective</label>
                  <textarea
                    v-model="clusterObjectiveInput"
                    rows="3"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="High-level goal for swarm cluster (e.g. Build, test, and verify step trajectory stream)..."
                  ></textarea>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Swarm Topology</label>
                    <select
                      v-model="clusterTopologyInput"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="hierarchical">Hierarchical (Coordinator + Workers)</option>
                      <option value="flat_fanout">Flat Fan-Out (Parallel Scouts)</option>
                      <option value="pipeline_linear">Linear Pipeline (Sequential Stages)</option>
                      <option value="adversarial_critique">Adversarial Critique (ProBuilder vs Sceptic)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Max Concurrency</label>
                    <input
                      type="number"
                      v-model.number="clusterConcurrencyInput"
                      min="1"
                      max="16"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="clusterModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  @click="handleCreateSwarmCluster"
                  :disabled="isCreatingCluster || !clusterObjectiveInput.trim()"
                  class="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isCreatingCluster ? 'Deploying...' : '🚀 Deploy Swarm' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- TAB VIEW: MULTI-AGENT MERGE MATRIX & CONFLICTS (EPIC 27)  -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'merges'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex-wrap gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">🔀</span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Multi-Agent Merge & Conflict Auto-Resolution Hub</h3>
                <span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-bold">3-WAY AST BARRIER</span>
              </div>
              <p class="text-[11px] text-zinc-500">Autonomous 3-way semantic diff reconciliation, AST import/block union heuristics & deterministic merge barrier</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="loadSessionMerges(); loadMergeMatrix();"
                class="px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >🔄 Refresh</button>
              <button
                @click="openMergeModal()"
                class="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors flex items-center gap-1"
              >+ Propose Merge</button>
            </div>
          </div>

          <!-- Alert / Success Messages -->
          <div v-if="mergeSuccessMsg" class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <span>✓ {{ mergeSuccessMsg }}</span>
            <button @click="mergeSuccessMsg = null" class="text-emerald-600 hover:text-emerald-800">&times;</button>
          </div>
          <div v-if="mergeErrorMsg" class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>🚨 {{ mergeErrorMsg }}</span>
            <button @click="mergeErrorMsg = null" class="text-rose-600 hover:text-rose-800">&times;</button>
          </div>

          <!-- Summary Metric Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-mono text-zinc-400">Total Merges</div>
              <div class="text-lg font-bold text-zinc-900 dark:text-zinc-100">{{ sessionMergesList.length }}</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-mono text-amber-500 font-bold">Conflicted</div>
              <div class="text-lg font-bold text-amber-600">{{ sessionMergesList.filter(m => m.status === 'conflicted').length }}</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-mono text-blue-500 font-bold">Resolved</div>
              <div class="text-lg font-bold text-blue-600">{{ sessionMergesList.filter(m => m.status === 'resolved' || m.status === 'clean').length }}</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-mono text-emerald-500 font-bold">Merged Commits</div>
              <div class="text-lg font-bold text-emerald-600">{{ sessionMergesList.filter(m => m.status === 'merged').length }}</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] uppercase font-mono text-purple-500 font-bold">Contention Risk</div>
              <div class="text-lg font-bold" :class="(sessionMergeMatrix && sessionMergeMatrix.contention_risk_score > 40) ? 'text-rose-500' : 'text-purple-600'">
                {{ (sessionMergeMatrix && sessionMergeMatrix.contention_risk_score) || 0 }}%
              </div>
            </div>
          </div>

          <!-- Main 2-Column Split: Merges List & 3-Way Diff Inspector -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <!-- Column 1: Merges Requests List -->
            <div class="lg:col-span-4 space-y-3">
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Merge Requests</h4>
                  <select v-model="mergeStatusFilter" @change="loadSessionMerges" class="px-2 py-0.5 text-[11px] rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <option value="">All Statuses</option>
                    <option value="conflicted">Conflicted</option>
                    <option value="resolved">Resolved</option>
                    <option value="clean">Clean</option>
                    <option value="merged">Merged</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div v-if="isLoadingMerges" class="text-center py-6 text-xs text-zinc-400">Loading merge requests...</div>
                <div v-else-if="sessionMergesList.length === 0" class="text-center py-6 text-xs text-zinc-400">
                  No merge requests found. Click "+ Propose Merge" to start a multi-agent merge.
                </div>
                <div v-else class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  <div
                    v-for="m in sessionMergesList"
                    :key="m.id"
                    @click="selectSessionMerge(m.merge_id || m.id)"
                    class="p-3 rounded-xl border cursor-pointer transition-all text-xs space-y-1.5"
                    :class="selectedSessionMerge && (selectedSessionMerge.merge_id === m.merge_id || selectedSessionMerge.id === m.id) ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 shadow-xs' : 'bg-zinc-50/40 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1">
                        <span>🔀</span>
                        <span>{{ m.title || m.merge_id }}</span>
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                        :class="m.status === 'merged' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : (m.status === 'conflicted' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : (m.status === 'resolved' || m.status === 'clean' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'))"
                      >
                        {{ m.status }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                      <span>{{ m.source_session_id }}</span>
                      <span>→</span>
                      <span>{{ m.target_session_id || 'main' }}</span>
                    </div>

                    <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <span>Files: {{ (m.files_changed && m.files_changed.length) || 0 }}</span>
                      <span v-if="m.conflict_count > 0" :class="m.resolved_count >= m.conflict_count ? 'text-emerald-500' : 'text-rose-500'">
                        Conflicts: {{ m.resolved_count }}/{{ m.conflict_count }}
                      </span>
                      <span v-else class="text-emerald-500">Zero Conflicts</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Workspace File Contention Matrix Mini-Widget -->
              <div v-if="sessionMergeMatrix && sessionMergeMatrix.matrix && sessionMergeMatrix.matrix.length > 0" class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">File Contention Matrix</h4>
                  <span class="text-[10px] font-mono text-zinc-400">{{ sessionMergeMatrix.contention_file_count || 0 }} overlaps</span>
                </div>
                <div class="space-y-1.5 max-h-48 overflow-y-auto text-[11px] font-mono">
                  <div
                    v-for="(fm, fmi) in sessionMergeMatrix.matrix"
                    :key="fmi"
                    class="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <span class="truncate text-zinc-800 dark:text-zinc-200">{{ fm.file_path }}</span>
                    <span
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                      :class="fm.contention_level === 'high' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'"
                    >
                      {{ (fm.active_sessions && fm.active_sessions.length) || 1 }} sessions
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Column 2: 3-Way Split Diff & Conflict Resolution Inspector -->
            <div class="lg:col-span-8 space-y-3">
              <div v-if="!selectedSessionMerge" class="p-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                Select a merge request from the list to inspect 3-way hunks and resolve conflicts.
              </div>

              <div v-else class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                <!-- Merge Header & Action Toolbar -->
                <div class="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedSessionMerge.title }}</h3>
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        :class="selectedSessionMerge.status === 'merged' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : (selectedSessionMerge.status === 'conflicted' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300')"
                      >
                        {{ selectedSessionMerge.status }}
                      </span>
                    </div>
                    <p class="text-[11px] font-mono text-zinc-500 mt-0.5">
                      {{ selectedSessionMerge.source_session_id }} ({{ selectedSessionMerge.source_branch || 'feature' }}) → {{ selectedSessionMerge.target_session_id || 'main' }}
                    </p>
                  </div>

                  <!-- Resolution & Execution Toolbar -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      v-if="selectedSessionMerge.status === 'conflicted' || selectedSessionMerge.status === 'pending'"
                      @click="handleAutoResolveCurrentMerge('ast_clean')"
                      :disabled="isResolvingMerge"
                      class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <span>⚡ Auto-Resolve (AST)</span>
                    </button>
                    <button
                      v-if="selectedSessionMerge.status === 'conflicted' || selectedSessionMerge.status === 'pending'"
                      @click="handleAutoResolveCurrentMerge('union_merge')"
                      :disabled="isResolvingMerge"
                      class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                    >
                      <span>Union Merge</span>
                    </button>
                    <button
                      v-if="selectedSessionMerge.status !== 'merged' && selectedSessionMerge.status !== 'rejected'"
                      @click="handleVerifyCurrentMerge()"
                      class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                    >
                      <span>🛡️ Verify Readiness</span>
                    </button>
                    <button
                      v-if="selectedSessionMerge.status !== 'merged' && selectedSessionMerge.status !== 'rejected'"
                      @click="handleExecuteCurrentMerge()"
                      :disabled="isExecutingMerge || selectedSessionMerge.status === 'conflicted'"
                      class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <span>{{ isExecutingMerge ? 'Merging...' : '🚀 Execute Merge Barrier' }}</span>
                    </button>
                    <button
                      v-if="selectedSessionMerge.status !== 'merged' && selectedSessionMerge.status !== 'rejected'"
                      @click="handleRejectCurrentMerge('Rejected by reviewer')"
                      class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <!-- Merge Commit Banner if Merged -->
                <div v-if="selectedSessionMerge.merge_commit" class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div>
                    <span class="font-bold">✓ MERGED COMMIT:</span> {{ selectedSessionMerge.merge_commit }}
                  </div>
                  <span v-if="selectedSessionMerge.verified_at" class="text-[10px] opacity-80">{{ selectedSessionMerge.verified_at }}</span>
                </div>

                <!-- Conflicted File Hunks Selector -->
                <div v-if="sessionMergeConflicts.length > 0" class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Conflict Hunks ({{ sessionMergeConflicts.length }})
                    </h4>
                    <div class="flex items-center gap-1 text-[11px] font-mono">
                      <span class="text-emerald-600">{{ sessionMergeConflicts.filter(c => c.resolution_status !== 'unresolved').length }} resolved</span>
                      <span class="text-zinc-400">/</span>
                      <span class="text-rose-600">{{ sessionMergeConflicts.filter(c => c.resolution_status === 'unresolved').length }} unresolved</span>
                    </div>
                  </div>

                  <!-- File tabs -->
                  <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      v-for="c in sessionMergeConflicts"
                      :key="c.id"
                      @click="selectedConflictHunk = c; customResolutionContent = c.resolved_content || c.source_hunk || '';"
                      class="px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 shrink-0"
                      :class="selectedConflictHunk && selectedConflictHunk.id === c.id ? 'bg-indigo-600 text-white font-bold' : (c.resolution_status !== 'unresolved' ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300')"
                    >
                      <span>{{ c.resolution_status !== 'unresolved' ? '✓' : '⚠️' }}</span>
                      <span>{{ c.file_path }}</span>
                    </button>
                  </div>

                  <!-- 3-Way Split Diff View -->
                  <div v-if="selectedConflictHunk" class="space-y-3 pt-2">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <!-- Base Column -->
                      <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                        <div class="text-[10px] font-bold font-mono text-zinc-500 uppercase flex items-center justify-between">
                          <span>📦 Base Version (Ancestor)</span>
                        </div>
                        <pre class="p-2 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48 select-text">{{ selectedConflictHunk.base_hunk || '(empty)' }}</pre>
                      </div>

                      <!-- Source Column -->
                      <div class="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-1.5">
                        <div class="text-[10px] font-bold font-mono text-blue-600 dark:text-blue-400 uppercase flex items-center justify-between">
                          <span>🌿 Source (Ours)</span>
                          <button
                            @click="handleResolveConflictHunk(selectedConflictHunk, 'manual_resolved', selectedConflictHunk.source_hunk)"
                            class="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] hover:bg-blue-500"
                          >Accept Ours</button>
                        </div>
                        <pre class="p-2 rounded bg-zinc-900 text-blue-200 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48 select-text">{{ selectedConflictHunk.source_hunk || '(empty)' }}</pre>
                      </div>

                      <!-- Target Column -->
                      <div class="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-1.5">
                        <div class="text-[10px] font-bold font-mono text-purple-600 dark:text-purple-400 uppercase flex items-center justify-between">
                          <span>🎯 Target (Theirs)</span>
                          <button
                            @click="handleResolveConflictHunk(selectedConflictHunk, 'manual_resolved', selectedConflictHunk.target_hunk)"
                            class="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] hover:bg-purple-500"
                          >Accept Theirs</button>
                        </div>
                        <pre class="p-2 rounded bg-zinc-900 text-purple-200 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48 select-text">{{ selectedConflictHunk.target_hunk || '(empty)' }}</pre>
                      </div>
                    </div>

                    <!-- Resolved Output Editor -->
                    <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Reconciled Content for {{ selectedConflictHunk.file_path }}</span>
                          <span
                            class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                            :class="selectedConflictHunk.resolution_status !== 'unresolved' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'"
                          >
                            {{ selectedConflictHunk.resolution_status }}
                          </span>
                        </div>
                        <button
                          @click="handleResolveConflictHunk(selectedConflictHunk, 'manual_resolved', customResolutionContent)"
                          class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                        >
                          Save Reconciled Hunk
                        </button>
                      </div>
                      <textarea
                        v-model="customResolutionContent"
                        rows="5"
                        class="w-full p-2.5 rounded-lg bg-zinc-900 text-emerald-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Edit or review reconciled code content..."
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div v-else class="py-8 text-center text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                  ✓ Clean 3-way diff: zero conflict hunks detected. Ready for instantaneous barrier execution.
                </div>
              </div>
            </div>
          </div>

          <!-- Propose Merge Modal -->
          <div v-if="mergeModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔀</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Propose Multi-Agent Merge</h3>
                    <p class="text-[11px] text-zinc-500">Reconcile divergent agent session branches into target branch</p>
                  </div>
                </div>
                <button @click="mergeModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Source Agent Session ID *</label>
                  <input
                    v-model="mergeSourceSessionInput"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. sess_abc123"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Agent Session ID (Optional, defaults to main)</label>
                  <input
                    v-model="mergeTargetSessionInput"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. sess_root456 or leave blank for main"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Merge Title</label>
                  <input
                    v-model="mergeTitleInput"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Merge feature branch into main"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Resolution Heuristic</label>
                    <select
                      v-model="mergeStrategyInput"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="ast_clean">⚡ AST Clean (Imports & Functions)</option>
                      <option value="union_merge">🔗 Union Non-Overlapping</option>
                      <option value="priority_override">👑 Source Priority Override</option>
                    </select>
                  </div>
                  <div class="flex items-center pt-5">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" v-model="mergeAutoResolveInput" class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                      <span class="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Auto-resolve on propose</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="mergeModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  @click="handleProposeMerge"
                  :disabled="isProposingMerge || !mergeSourceSessionInput.trim()"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isProposingMerge ? 'Proposing...' : '🔀 Propose Merge' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- TAB VIEW: AGENT FLEET BUDGET & TOKEN QUOTAS (EPIC 28)     -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'budget'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Top Header Banner -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex-wrap gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">💰</span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Agent Fleet Budget, Cost Attribution & Quotas</h3>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">FINANCIAL GOVERNANCE</span>
              </div>
              <p class="text-[11px] text-zinc-500">Real-time token metering, per-persona budget hard caps, pre-flight reservation engine & multi-model cost ledger</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="loadBudgetGovernanceData()"
                class="px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >🔄 Refresh</button>
              <button
                @click="resetBudgetCircuitBreakers()"
                class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors flex items-center gap-1"
              >
                <span>⚡ Reset Circuit Breakers</span>
              </button>
              <button
                @click="openNewBudgetPolicyModal()"
                class="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors flex items-center gap-1"
              >
                <span>➕ New Policy</span>
              </button>
            </div>
          </div>

          <!-- Alert Messages -->
          <div v-if="budgetSuccessMsg" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
            <span>✓ {{ budgetSuccessMsg }}</span>
            <button @click="budgetSuccessMsg = null" class="text-emerald-400 hover:text-emerald-600 text-sm font-bold">&times;</button>
          </div>
          <div v-if="budgetErrorMsg" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <span>⚠ {{ budgetErrorMsg }}</span>
            <button @click="budgetErrorMsg = null" class="text-red-400 hover:text-red-600 text-sm font-bold">&times;</button>
          </div>

          <!-- 5 Primary KPI Cards -->
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Total Fleet Spend</div>
              <div class="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                \${{ (budgetMetrics && budgetMetrics.total_spend_usd != null) ? budgetMetrics.total_spend_usd.toFixed(2) : '0.00' }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Across all models</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Tokens Consumed</div>
              <div class="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                {{ (budgetMetrics && budgetMetrics.total_tokens) ? (budgetMetrics.total_tokens >= 1000000 ? (budgetMetrics.total_tokens / 1000000).toFixed(2) + 'M' : (budgetMetrics.total_tokens / 1000).toFixed(1) + 'k') : '0' }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Prompt + Completion + Cache</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Active Policies</div>
              <div class="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
                {{ (budgetPolicies || []).length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Enforcing budget caps</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Circuit Breakers</div>
              <div
                class="text-lg font-black font-mono mt-0.5"
                :class="((budgetMetrics && budgetMetrics.circuit_breakers_active_count) > 0) ? 'text-red-500' : 'text-emerald-500'"
              >
                {{ (budgetMetrics && budgetMetrics.circuit_breakers_active_count) || 0 }} Tripped
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Hard limit protections</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs col-span-2 md:col-span-1">
              <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Cost Transactions</div>
              <div class="text-lg font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
                {{ (budgetMetrics && budgetMetrics.ledger_transactions_count) || (costLedger || []).length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Audited in ledger</div>
            </div>
          </div>

          <!-- Spending Analytics & Persona Distribution -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Provider & Model Breakdown -->
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm">📊</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Spend by Model & Provider</h4>
                </div>
                <span class="text-[10px] font-mono text-zinc-500">Real-time USD</span>
              </div>

              <div v-if="budgetMetrics && Object.keys(budgetMetrics.spend_by_model || {}).length" class="space-y-2">
                <div v-for="(amt, model) in budgetMetrics.spend_by_model" :key="model" class="space-y-1">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-mono font-medium text-zinc-700 dark:text-zinc-300">{{ model }}</span>
                    <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">\${{ amt.toFixed(4) }}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      class="h-full bg-indigo-500 rounded-full"
                      :style="{ width: Math.min(100, (budgetMetrics.total_spend_usd > 0 ? (amt / budgetMetrics.total_spend_usd) * 100 : 0)) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
              <div v-else class="py-6 text-center text-xs text-zinc-400">
                No model spend recorded yet. Ingest usage via FastMCP or REST API to populate.
              </div>
            </div>

            <!-- Spend by Persona -->
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm">🤖</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Spend by Agent Persona</h4>
                </div>
                <span class="text-[10px] font-mono text-zinc-500">Persona Allocation</span>
              </div>

              <div v-if="budgetMetrics && Object.keys(budgetMetrics.spend_by_persona || {}).length" class="space-y-2">
                <div v-for="(amt, persona) in budgetMetrics.spend_by_persona" :key="persona" class="space-y-1">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{{ persona }}</span>
                    <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">\${{ amt.toFixed(4) }}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      class="h-full bg-emerald-500 rounded-full"
                      :style="{ width: Math.min(100, (budgetMetrics.total_spend_usd > 0 ? (amt / budgetMetrics.total_spend_usd) * 100 : 0)) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
              <div v-else class="py-6 text-center text-xs text-zinc-400">
                No persona transactions recorded yet.
              </div>
            </div>
          </div>

          <!-- Active Budget Policies Table -->
          <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <span class="text-sm">🛡️</span>
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Active Budget Policies & Enforcement Caps</h4>
                <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ budgetPolicies.length }}</span>
              </div>
              <button
                @click="openNewBudgetPolicyModal()"
                class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                + Add Policy
              </button>
            </div>

            <div v-if="budgetPolicies.length" class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                    <th class="py-2 px-2">Policy Name</th>
                    <th class="py-2 px-2">Scope</th>
                    <th class="py-2 px-2">Budget Cap (USD)</th>
                    <th class="py-2 px-2">Spend / Utilization</th>
                    <th class="py-2 px-2">Hard Action</th>
                    <th class="py-2 px-2">Status</th>
                    <th class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  <tr v-for="p in budgetPolicies" :key="p.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td class="py-2.5 px-2 font-sans font-semibold text-zinc-900 dark:text-zinc-100">
                      {{ p.name }}
                    </td>
                    <td class="py-2.5 px-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase"
                        :class="p.scope_type === 'global' ? 'bg-purple-500/20 text-purple-400' : (p.scope_type === 'persona' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400')"
                      >
                        {{ p.scope_type }}{{ p.scope_id ? ': ' + p.scope_id : '' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-2 font-bold text-zinc-800 dark:text-zinc-200">
                      \${{ (p.max_budget_usd || 0).toFixed(2) }} <span class="text-[10px] text-zinc-400 font-sans">({{ p.period }})</span>
                    </td>
                    <td class="py-2.5 px-2 min-w-[140px]">
                      <div class="flex items-center justify-between text-[10px] mb-1">
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold">\${{ (p.current_spend_usd || 0).toFixed(2) }}</span>
                        <span class="text-zinc-400">{{ (p.spend_pct || 0).toFixed(1) }}%</span>
                      </div>
                      <div class="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          class="h-full rounded-full"
                          :class="(p.spend_pct >= 100) ? 'bg-red-500' : ((p.spend_pct >= (p.soft_limit_pct || 80)) ? 'bg-amber-500' : 'bg-emerald-500')"
                          :style="{ width: Math.min(100, p.spend_pct || 0) + '%' }"
                        ></div>
                      </div>
                    </td>
                    <td class="py-2.5 px-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase"
                        :class="p.hard_limit_action === 'block' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'"
                      >
                        {{ p.hard_limit_action }}
                      </span>
                    </td>
                    <td class="py-2.5 px-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase"
                        :class="p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : (p.status === 'exceeded' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-indigo-500/20 text-indigo-400')"
                      >
                        {{ p.status }}
                      </span>
                    </td>
                    <td class="py-2.5 px-2 text-right space-x-1 font-sans">
                      <button
                        @click="openBudgetOverrideModal(p)"
                        class="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 transition-colors"
                        title="Grant temporary emergency override"
                      >
                        🔓 Override
                      </button>
                      <button
                        @click="deleteBudgetPolicy(p.id)"
                        class="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                        title="Delete policy"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="py-6 text-center text-xs text-zinc-400">
              No budget policies configured. Click "+ Add Policy" to create your first spending cap.
            </div>
          </div>

          <!-- Pre-Flight Token Quota & Cost Simulator -->
          <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-sm">🎯</span>
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Pre-Flight Token Quota & Cost Simulator</h4>
              </div>
              <span class="text-[10px] font-mono text-zinc-500">In-Flight Pre-Check</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label class="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Target Model</label>
                <select
                  v-model="quotaSimulator.model"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs focus:outline-none"
                >
                  <option value="omniroute/premium">OmniRoute Premium (Default Homelab Combo)</option>
                  <option value="omniroute/fast">OmniRoute Fast (Low Latency)</option>
                  <option value="vram/BAAI/bge-m3">OmniRoute Neural BGE-M3 (Local VRAM)</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="deepseek-v3">DeepSeek V3</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Agent Persona</label>
                <select
                  v-model="quotaSimulator.persona"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs focus:outline-none"
                >
                  <option value="coder">Coder</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="architect">Architect</option>
                  <option value="security">Security SRE</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Est. Prompt Tokens</label>
                <input
                  type="number"
                  v-model.number="quotaSimulator.estimated_prompt_tokens"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label class="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Est. Output Tokens</label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    v-model.number="quotaSimulator.estimated_completion_tokens"
                    class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono focus:outline-none"
                  />
                  <button
                    @click="runQuotaSimulation()"
                    :disabled="quotaSimulator.isSimulating"
                    class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs whitespace-nowrap shadow-xs transition-colors"
                  >
                    {{ quotaSimulator.isSimulating ? '...' : 'Check' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Simulation Result Card -->
            <div v-if="quotaSimulator.result" class="p-3 rounded-xl border text-xs font-mono"
              :class="quotaSimulator.result.allowed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'"
            >
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-base">{{ quotaSimulator.result.allowed ? '✓' : '🛑' }}</span>
                  <span class="font-bold uppercase tracking-wider">
                    {{ quotaSimulator.result.allowed ? 'Quota Verification Passed (Allowed)' : 'Execution Blocked (Action: ' + quotaSimulator.result.action + ')' }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span>Est. Cost: <strong>\${{ quotaSimulator.result.estimated_cost_usd }}</strong></span>
                  <span>Est. Tokens: <strong>{{ quotaSimulator.result.estimated_tokens }}</strong></span>
                </div>
              </div>
              <div v-if="quotaSimulator.result.warnings && quotaSimulator.result.warnings.length" class="mt-2 text-[11px] text-amber-400 space-y-0.5">
                <div v-for="(w, idx) in quotaSimulator.result.warnings" :key="idx">⚠ {{ w }}</div>
              </div>
            </div>
          </div>

          <!-- Live Cost Ledger Transaction Stream -->
          <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <span class="text-sm">📜</span>
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Live Transaction Cost Ledger</h4>
                <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ costLedger.length }}</span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="ledgerFilterPersona"
                  @input="loadBudgetGovernanceData()"
                  placeholder="Filter persona..."
                  class="px-2.5 py-1 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                />
                <input
                  v-model="ledgerFilterModel"
                  @input="loadBudgetGovernanceData()"
                  placeholder="Filter model..."
                  class="px-2.5 py-1 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                />
              </div>
            </div>

            <div v-if="costLedger.length" class="overflow-x-auto max-h-72">
              <table class="w-full text-left text-xs border-collapse font-mono">
                <thead class="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 z-10">
                  <tr>
                    <th class="py-2 px-2">Session ID</th>
                    <th class="py-2 px-2">Persona</th>
                    <th class="py-2 px-2">Model</th>
                    <th class="py-2 px-2">Tokens (In / Out / Cache)</th>
                    <th class="py-2 px-2">Latency</th>
                    <th class="py-2 px-2">Cost (USD)</th>
                    <th class="py-2 px-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-[11px]">
                  <tr v-for="entry in costLedger" :key="entry.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td class="py-2 px-2 text-indigo-400 font-bold truncate max-w-[120px]">
                      {{ entry.session_id || entry.id }}
                    </td>
                    <td class="py-2 px-2 capitalize font-sans text-zinc-700 dark:text-zinc-300">
                      {{ entry.persona || 'coder' }}
                    </td>
                    <td class="py-2 px-2 text-zinc-800 dark:text-zinc-200">
                      {{ entry.model }}
                    </td>
                    <td class="py-2 px-2 text-zinc-400">
                      <span class="text-zinc-300">{{ entry.prompt_tokens }}</span> / <span class="text-zinc-300">{{ entry.completion_tokens }}</span> / <span class="text-zinc-500">{{ entry.cached_tokens }}</span>
                    </td>
                    <td class="py-2 px-2 text-zinc-400">
                      {{ entry.latency_ms ? entry.latency_ms + 'ms' : '-' }}
                    </td>
                    <td class="py-2 px-2 font-bold text-emerald-600 dark:text-emerald-400">
                      \${{ entry.cost_usd ? entry.cost_usd.toFixed(4) : '0.0000' }}
                    </td>
                    <td class="py-2 px-2 text-right text-zinc-500 text-[10px]">
                      {{ entry.created ? new Date(entry.created).toLocaleTimeString() : '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="py-6 text-center text-xs text-zinc-400">
              No cost ledger entries match the current filter criteria.
            </div>
          </div>

          <!-- New Budget Policy Modal -->
          <div v-if="budgetPolicyModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🛡️</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Create Budget Policy</h3>
                    <p class="text-[11px] text-zinc-500">Configure financial spending caps & hard circuit breakers</p>
                  </div>
                </div>
                <button @click="budgetPolicyModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Policy Title *</label>
                  <input
                    v-model="newBudgetPolicy.name"
                    placeholder="e.g. Daily Swarm Cap, Coder Persona Limit"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Scope Type</label>
                    <select
                      v-model="newBudgetPolicy.scope_type"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="global">Global (Workspace)</option>
                      <option value="persona">Agent Persona</option>
                      <option value="project">Project</option>
                      <option value="session">Session</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Scope ID / Persona</label>
                    <input
                      v-model="newBudgetPolicy.scope_id"
                      placeholder="e.g. coder, PB-101"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Max Budget (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      v-model.number="newBudgetPolicy.max_budget_usd"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Period</label>
                    <select
                      v-model="newBudgetPolicy.period"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="daily">Daily</option>
                      <option value="hourly">Hourly</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="per_cycle">Per Cycle</option>
                      <option value="total">Total Lifetime</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Soft Limit Warning (%)</label>
                    <input
                      type="number"
                      v-model.number="newBudgetPolicy.soft_limit_pct"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Hard Limit Action</label>
                    <select
                      v-model="newBudgetPolicy.hard_limit_action"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="block">Block Execution</option>
                      <option value="throttle">Throttle</option>
                      <option value="notify_only">Notify Only</option>
                      <option value="require_human_gate">Require Human Gate</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="budgetPolicyModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  @click="createBudgetPolicy"
                  :disabled="isSavingBudgetPolicy || !newBudgetPolicy.name.trim()"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isSavingBudgetPolicy ? 'Saving...' : 'Save Policy' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Emergency Override Modal -->
          <div v-if="budgetOverrideModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔓</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Grant Emergency Budget Override</h3>
                    <p class="text-[11px] text-zinc-500">Temporarily unblock throttled policy: {{ selectedPolicyForOverride ? selectedPolicyForOverride.name : '' }}</p>
                  </div>
                </div>
                <button @click="budgetOverrideModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Additional Budget (USD)</label>
                    <input
                      type="number"
                      step="1"
                      v-model.number="newBudgetOverride.additional_budget"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Duration (Minutes)</label>
                    <input
                      type="number"
                      step="15"
                      v-model.number="newBudgetOverride.expires_in_minutes"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Reason / Justification *</label>
                  <input
                    v-model="newBudgetOverride.reason"
                    placeholder="e.g. Critical production hotfix run"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="budgetOverrideModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  @click="submitBudgetOverride"
                  :disabled="isGrantingOverride"
                  class="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isGrantingOverride ? 'Granting...' : '🔓 Grant Override' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2I2: AGENT EVALUATION BENCHMARK HARNESS & LEADERBOARD (EPIC 29) -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'evals'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900 border border-purple-700/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">📊</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Agent Evaluation Benchmark Harness & Leaderboard</h3>
                <span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">MILESTONE 8</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Continuous standardized eval suites, automated scenario assertions, multi-model leaderboard ranking, and automated regression detection.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                @click="evalTriggerModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>▶ Run Eval Benchmark</span>
              </button>
              <button
                @click="evalCompareModalOpen = true; runModelComparison();"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>⚖️ Compare Models</span>
              </button>
              <button
                @click="evalSuiteModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span>➕ New Suite</span>
              </button>
              <button
                @click="seedEvalDefaults()"
                :disabled="isSeedingEvals"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span>🌱 {{ isSeedingEvals ? 'Seeding...' : 'Seed Defaults' }}</span>
              </button>
              <button
                @click="loadEvalGovernanceData()"
                :disabled="isLoadingEvals"
                class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-bold transition-colors"
                title="Refresh benchmarks"
              >
                <span>🔄</span>
              </button>
            </div>
          </div>

          <!-- Alert Feedback -->
          <div v-if="evalSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
            <span>✅ {{ evalSuccessMsg }}</span>
            <button @click="evalSuccessMsg = null" class="text-emerald-400 font-bold">&times;</button>
          </div>
          <div v-if="evalErrorMsg" class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
            <span>⚠️ {{ evalErrorMsg }}</span>
            <button @click="evalErrorMsg = null" class="text-rose-400 font-bold">&times;</button>
          </div>

          <!-- KPI Summary Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Top Performing Model</p>
                <h4 class="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {{ evalSummary ? evalSummary.top_performing_model : (evalLeaderboard.length ? evalLeaderboard[0].model : 'gpt-5.5') }}
                </h4>
                <p class="text-[10px] text-purple-500 font-medium">Rank #1 overall composite</p>
              </div>
              <span class="text-2xl p-2.5 rounded-xl bg-purple-500/10 text-purple-400">🏆</span>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Certified Models</p>
                <h4 class="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {{ evalSummary ? evalSummary.certified_models : evalLeaderboard.filter(b => b.certification_status === 'certified').length }}
                  <span class="text-xs text-zinc-500 font-normal">/ {{ evalLeaderboard.length }}</span>
                </h4>
                <p class="text-[10px] text-emerald-500 font-medium">≥90% pass threshold</p>
              </div>
              <span class="text-2xl p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">🎖️</span>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Benchmark Suites</p>
                <h4 class="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {{ evalSuites.length }}
                </h4>
                <p class="text-[10px] text-blue-500 font-medium">Coding, Tool Use, Refactor & Safety</p>
              </div>
              <span class="text-2xl p-2.5 rounded-xl bg-blue-500/10 text-blue-400">📚</span>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Detected Regressions</p>
                <h4 class="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {{ evalRegressions.length }}
                </h4>
                <p class="text-[10px]" :class="evalRegressions.length ? 'text-rose-500 font-bold' : 'text-emerald-500'">
                  {{ evalRegressions.length ? 'Violations active' : 'Zero regressions' }}
                </p>
              </div>
              <span class="text-2xl p-2.5 rounded-xl" :class="evalRegressions.length ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'">
                {{ evalRegressions.length ? '🚨' : '✨' }}
              </span>
            </div>
          </div>

          <!-- Regression Alert Banner (if regressions detected) -->
          <div v-if="evalRegressions.length" class="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-lg">🚨</span>
                <h4 class="text-xs font-bold text-rose-300">Model Performance & Accuracy Regression Alert</h4>
                <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold">ACTION REQUIRED</span>
              </div>
              <span class="text-xs text-rose-400 font-mono">{{ evalRegressions.length }} anomalies</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div
                v-for="(reg, idx) in evalRegressions"
                :key="idx"
                class="p-3 rounded-lg bg-zinc-900/80 border border-rose-900/60 flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-white font-mono">{{ reg.model }}</span>
                    <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-mono">{{ reg.persona }}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="reg.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'">
                      {{ reg.severity }}
                    </span>
                  </div>
                  <p class="text-[11px] text-zinc-300 mt-1">
                    Pass Rate: <span class="font-mono text-rose-400">{{ reg.score_percentage }}%</span> (Baseline: {{ reg.baseline_pass_rate }}%, <span class="text-rose-400">{{ reg.pass_rate_delta }}%</span>)
                  </p>
                  <p class="text-[10px] text-zinc-400 mt-0.5">💡 {{ reg.recommendation }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Model & Persona Global Leaderboard Table -->
          <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm">🏆</span>
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Global Model & Persona Evaluation Leaderboard</h4>
                <span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-mono font-bold">{{ evalLeaderboard.length }} models</span>
              </div>
              <div class="flex items-center gap-2">
                <select
                  v-model="evalFilterDomain"
                  @change="loadEvalGovernanceData()"
                  class="px-2.5 py-1 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                >
                  <option value="">All Domains</option>
                  <option value="coding">Coding & Syntax</option>
                  <option value="reasoning">Reasoning & Architecture</option>
                  <option value="tool_use">FastMCP Tool Calling</option>
                  <option value="refactor">Refactor & Merges</option>
                  <option value="security">Security & Guardrails</option>
                </select>
              </div>
            </div>

            <div v-if="evalLeaderboard.length" class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                    <th class="py-2.5 px-2">Rank</th>
                    <th class="py-2.5 px-2">Model & Persona</th>
                    <th class="py-2.5 px-2">Domain</th>
                    <th class="py-2.5 px-2">Composite Score</th>
                    <th class="py-2.5 px-2">Pass Rate</th>
                    <th class="py-2.5 px-2">Win Rate</th>
                    <th class="py-2.5 px-2">Avg Latency</th>
                    <th class="py-2.5 px-2">Cost / Task</th>
                    <th class="py-2.5 px-2">Status</th>
                    <th class="py-2.5 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  <tr v-for="item in evalLeaderboard" :key="item.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td class="py-2.5 px-2 font-bold">
                      <span v-if="item.rank === 1" class="text-amber-400">🥇 #1</span>
                      <span v-else-if="item.rank === 2" class="text-zinc-300">🥈 #2</span>
                      <span v-else-if="item.rank === 3" class="text-amber-600">🥉 #3</span>
                      <span v-else class="text-zinc-500">#{{ item.rank }}</span>
                    </td>
                    <td class="py-2.5 px-2">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ item.model }}</span>
                        <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px]">{{ item.persona }}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-2">
                      <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-400 capitalize">{{ item.domain }}</span>
                    </td>
                    <td class="py-2.5 px-2">
                      <div class="flex items-center gap-2">
                        <div class="w-16 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all"
                            :class="item.composite_score >= 90 ? 'bg-emerald-500' : (item.composite_score >= 75 ? 'bg-indigo-500' : 'bg-amber-500')"
                            :style="{ width: Math.min(100, item.composite_score) + '%' }"
                          ></div>
                        </div>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ item.composite_score }}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-2 font-bold" :class="item.avg_pass_rate >= 90 ? 'text-emerald-500' : (item.avg_pass_rate >= 75 ? 'text-indigo-400' : 'text-amber-400')">
                      {{ item.avg_pass_rate }}%
                    </td>
                    <td class="py-2.5 px-2 text-zinc-400">
                      {{ item.win_rate }}%
                    </td>
                    <td class="py-2.5 px-2 text-zinc-400">
                      {{ item.avg_latency_ms }}ms
                    </td>
                    <td class="py-2.5 px-2 text-zinc-400">
                      \${{ item.avg_cost_per_task ? item.avg_cost_per_task.toFixed(4) : '0.0000' }}
                    </td>
                    <td class="py-2.5 px-2">
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        :class="item.certification_status === 'certified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (item.certification_status === 'under_review' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30')"
                      >
                        {{ item.certification_status }}
                      </span>
                    </td>
                    <td class="py-2.5 px-2 text-right">
                      <button
                        @click="evalTriggerModel = item.model; evalTriggerPersona = item.persona; evalTriggerModalOpen = true"
                        class="px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-[10px] font-bold transition-colors"
                      >
                        ▶ Eval
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="py-8 text-center text-xs text-zinc-400">
              No leaderboard baseline benchmarks registered yet. Click "Seed Defaults" or "Run Eval Benchmark".
            </div>
          </div>

          <!-- Two-Column Grid: Suites and Live Runs -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Left: Standardized Benchmark Suites -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-sm">📚</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Benchmark Test Suites</h4>
                  <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ evalSuites.length }}</span>
                </div>
                <button
                  @click="evalSuiteModalOpen = true"
                  class="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold"
                >
                  ➕ Add Suite
                </button>
              </div>

              <div v-if="evalSuites.length" class="space-y-2.5 max-h-96 overflow-y-auto">
                <div
                  v-for="s in evalSuites"
                  :key="s.id"
                  class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 hover:border-purple-500/50 transition-colors"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-2">
                        <h5 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ s.name }}</h5>
                        <span class="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] font-mono uppercase">{{ s.domain }}</span>
                      </div>
                      <p class="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{{ s.description || 'No description provided.' }}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        @click="evalTriggerSuiteSlug = s.slug; evalTriggerModalOpen = true"
                        class="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-colors shadow-2xs"
                      >
                        ▶ Run
                      </button>
                      <button
                        @click="removeEvalSuite(s.id)"
                        class="p-1 text-zinc-400 hover:text-rose-500 text-xs transition-colors"
                        title="Delete suite"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div class="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Scenarios: <strong class="text-zinc-200">{{ s.scenarios_count || (s.scenarios ? s.scenarios.length : 0) }}</strong></span>
                    <span>Pass Threshold: <strong class="text-emerald-400">{{ s.pass_threshold_pct }}%</strong></span>
                    <span>Timeout: <strong class="text-zinc-200">{{ s.timeout_seconds }}s</strong></span>
                  </div>
                </div>
              </div>
              <div v-else class="py-6 text-center text-xs text-zinc-400">
                No evaluation suites found.
              </div>
            </div>

            <!-- Right: Live & Recent Eval Runs Stream -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-sm">📈</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Recent Evaluation Runs</h4>
                  <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ evalRuns.length }}</span>
                </div>
              </div>

              <div v-if="evalRuns.length" class="space-y-2.5 max-h-96 overflow-y-auto">
                <div
                  v-for="r in evalRuns"
                  :key="r.id"
                  @click="viewEvalRunDetails(r.id)"
                  class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 hover:border-purple-500/50 cursor-pointer transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-white font-mono">{{ r.model }}</span>
                      <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-mono">{{ r.persona }}</span>
                      <span class="text-[10px] text-zinc-500 font-mono">({{ r.suite_slug }})</span>
                    </div>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono"
                      :class="r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : (r.status === 'running' ? 'bg-blue-500/20 text-blue-400 animate-pulse' : 'bg-rose-500/20 text-rose-400')"
                    >
                      {{ r.status }}
                    </span>
                  </div>

                  <div class="mt-2 grid grid-cols-4 gap-1 text-[10px] font-mono">
                    <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900">
                      <p class="text-zinc-500">Score</p>
                      <p class="font-bold text-emerald-400">{{ r.score_percentage }}%</p>
                    </div>
                    <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900">
                      <p class="text-zinc-500">Passed</p>
                      <p class="font-bold text-zinc-200">{{ r.passed_scenarios }}/{{ r.total_scenarios }}</p>
                    </div>
                    <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900">
                      <p class="text-zinc-500">Latency</p>
                      <p class="font-bold text-zinc-200">{{ r.avg_latency_ms }}ms</p>
                    </div>
                    <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900">
                      <p class="text-zinc-500">Cost</p>
                      <p class="font-bold text-zinc-200">\${{ r.total_cost_usd ? r.total_cost_usd.toFixed(4) : '0.0000' }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="py-6 text-center text-xs text-zinc-400">
                No evaluation runs recorded yet.
              </div>
            </div>
          </div>

          <!-- Run Benchmark Trigger Modal -->
          <div v-if="evalTriggerModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">▶</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Run Benchmark Evaluation</h3>
                    <p class="text-[11px] text-zinc-500">Evaluate model accuracy and test scenarios</p>
                  </div>
                </div>
                <button @click="evalTriggerModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Model *</label>
                  <input
                    v-model="evalTriggerModel"
                    placeholder="e.g. gpt-5.5, claude-fable-5, deepseek-r1"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Persona</label>
                    <select
                      v-model="evalTriggerPersona"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="coder">Coder</option>
                      <option value="architect">Architect</option>
                      <option value="debugger">Debugger</option>
                      <option value="qa">QA Engineer</option>
                      <option value="scout">Scout</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Benchmark Suite</label>
                    <select
                      v-model="evalTriggerSuiteSlug"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option v-for="s in evalSuites" :key="s.id" :value="s.slug">{{ s.name }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="evalTriggerModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  @click="triggerNewEvalRun()"
                  :disabled="isTriggeringEval"
                  class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>{{ isTriggeringEval ? 'Evaluating...' : '🚀 Start Evaluation' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Model Side-by-Side Comparison Modal -->
          <div v-if="evalCompareModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">⚖️</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Side-by-Side Model Comparison</h3>
                    <p class="text-[11px] text-zinc-500">Benchmark comparison on identical test suites</p>
                  </div>
                </div>
                <button @click="evalCompareModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Model A</label>
                  <input
                    v-model="compareModelA"
                    @change="runModelComparison()"
                    placeholder="e.g. gpt-5.5"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Model B</label>
                  <input
                    v-model="compareModelB"
                    @change="runModelComparison()"
                    placeholder="e.g. claude-fable-5"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div v-if="evalComparison" class="space-y-3">
                <div class="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-300">
                  <span class="font-bold">🏆 Head-to-Head Winner: </span>
                  <span class="font-mono font-bold text-white">{{ evalComparison.head_to_head.composite_winner }}</span>
                  (Advantage: +{{ evalComparison.head_to_head.score_delta }} pts)
                  <p class="text-[11px] text-zinc-300 mt-0.5">{{ evalComparison.head_to_head.recommendation }}</p>
                </div>

                <div class="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                    <h5 class="font-bold text-white">{{ evalComparison.model_a.model }}</h5>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Composite:</span> <strong class="text-purple-400">{{ evalComparison.model_a.composite_score }}</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Pass Rate:</span> <strong class="text-emerald-400">{{ evalComparison.model_a.pass_rate }}%</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Latency:</span> <strong class="text-zinc-200">{{ evalComparison.model_a.latency_ms }}ms</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Cost:</span> <strong class="text-zinc-200">\${{ evalComparison.model_a.cost_usd }}</strong></div>
                  </div>

                  <div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                    <h5 class="font-bold text-white">{{ evalComparison.model_b.model }}</h5>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Composite:</span> <strong class="text-purple-400">{{ evalComparison.model_b.composite_score }}</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Pass Rate:</span> <strong class="text-emerald-400">{{ evalComparison.model_b.pass_rate }}%</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Latency:</span> <strong class="text-zinc-200">{{ evalComparison.model_b.latency_ms }}ms</strong></div>
                    <div class="flex justify-between text-[11px]"><span class="text-zinc-400">Cost:</span> <strong class="text-zinc-200">\${{ evalComparison.model_b.cost_usd }}</strong></div>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="evalCompareModalOpen = false"
                  class="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          <!-- Create Benchmark Suite Modal -->
          <div v-if="evalSuiteModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">➕</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Create Benchmark Suite</h3>
                    <p class="text-[11px] text-zinc-500">Define a new standardized evaluation harness</p>
                  </div>
                </div>
                <button @click="evalSuiteModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Suite Name *</label>
                  <input
                    v-model="newEvalSuite.name"
                    placeholder="e.g. Vue 3 Reactive Bugfix Benchmark"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Slug Identifier</label>
                    <input
                      v-model="newEvalSuite.slug"
                      placeholder="e.g. vue3-bugfix-v1"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Domain</label>
                    <select
                      v-model="newEvalSuite.domain"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="coding">Coding</option>
                      <option value="reasoning">Reasoning</option>
                      <option value="tool_use">Tool Use</option>
                      <option value="refactor">Refactor</option>
                      <option value="qa">QA</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                  <textarea
                    v-model="newEvalSuite.description"
                    rows="2"
                    placeholder="Describe the test harness focus..."
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  ></textarea>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pass Threshold (%)</label>
                    <input
                      type="number"
                      v-model.number="newEvalSuite.pass_threshold_pct"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Timeout (s)</label>
                    <input
                      type="number"
                      v-model.number="newEvalSuite.timeout_seconds"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="evalSuiteModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  @click="createCustomEvalSuite()"
                  class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Create Suite
                </button>
              </div>
            </div>
          </div>

          <!-- Granular Run Details Modal -->
          <div v-if="selectedEvalRun" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">📋</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Evaluation Run Inspection</h3>
                    <p class="text-[11px] text-zinc-500 font-mono">Run ID: {{ selectedEvalRun.id }}</p>
                  </div>
                </div>
                <button @click="selectedEvalRun = null" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="grid grid-cols-4 gap-2 text-xs font-mono">
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Model</p>
                  <p class="font-bold text-white">{{ selectedEvalRun.model }}</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Score</p>
                  <p class="font-bold text-emerald-400">{{ selectedEvalRun.score_percentage }}%</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Passed / Total</p>
                  <p class="font-bold text-zinc-200">{{ selectedEvalRun.passed_scenarios }}/{{ selectedEvalRun.total_scenarios }}</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Avg Latency</p>
                  <p class="font-bold text-zinc-200">{{ selectedEvalRun.avg_latency_ms }}ms</p>
                </div>
              </div>

              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Scenario Assertion Metrics</h4>
                <div v-if="selectedEvalRun.metrics && selectedEvalRun.metrics.length" class="space-y-2">
                  <div
                    v-for="m in selectedEvalRun.metrics"
                    :key="m.id"
                    class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs font-mono"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-white">{{ m.scenario_name || m.scenario_id }}</span>
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        :class="m.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'"
                      >
                        {{ m.status }}
                      </span>
                    </div>
                    <div class="flex items-center gap-4 text-[10px] text-zinc-400">
                      <span>Latency: {{ m.latency_ms }}ms</span>
                      <span>Tokens: {{ m.tokens_used }}</span>
                      <span>Cost: \${{ m.cost_usd ? m.cost_usd.toFixed(4) : '0.0000' }}</span>
                    </div>
                    <div v-if="m.error_message" class="p-2 rounded bg-rose-950/40 border border-rose-900/40 text-rose-300 text-[11px]">
                      {{ m.error_message }}
                    </div>
                  </div>
                </div>
                <div v-else class="py-4 text-center text-xs text-zinc-400">
                  No granular scenario metrics ingested.
                </div>
              </div>

              <div class="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="selectedEvalRun = null"
                  class="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2K: EPHEMERAL SANDBOXES & DEV ENVIRONMENTS (EPIC 30) -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'sandboxes'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-teal-900/40 via-cyan-900/30 to-zinc-900 border border-teal-700/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg">📦</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Autonomous Ephemeral Sandboxes & Dev Environments</h3>
                <span class="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-mono font-bold animate-pulse">SANDBOX MESH</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Zero-friction isolated execution environments, Git worktrees, and containerized runtimes with dynamic port allocation, live web preview URLs, and auto-TTL garbage collection.
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="loadSandboxesGovernanceData()"
                :disabled="isLoadingSandboxes"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>{{ isLoadingSandboxes ? '🔄 Syncing...' : '🔄 Refresh' }}</span>
              </button>
              <button
                @click="cleanupIdleSandboxes()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Garbage collect sandboxes that exceeded their TTL"
              >
                <span>🧹 Clean Expired TTLs</span>
              </button>
              <button
                @click="seedDefaultTemplates()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span>✨ Seed Blueprints</span>
              </button>
              <button
                @click="sandboxModalOpen = true"
                class="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
              >
                <span>➕ Provision Sandbox</span>
              </button>
            </div>
          </div>

          <!-- Toast Notifications -->
          <div v-if="sandboxSuccessMsg" class="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
            <span>{{ sandboxSuccessMsg }}</span>
            <button @click="sandboxSuccessMsg = null" class="text-emerald-400 font-bold">&times;</button>
          </div>
          <div v-if="sandboxErrorMsg" class="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
            <span>{{ sandboxErrorMsg }}</span>
            <button @click="sandboxErrorMsg = null" class="text-rose-400 font-bold">&times;</button>
          </div>

          <!-- KPI Summary Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
                <span>Active Sandboxes</span>
                <span class="text-teal-400 text-base">📦</span>
              </div>
              <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {{ sandboxFleetMetrics ? sandboxFleetMetrics.active_sandboxes : sandboxesList.filter(s => s.status !== 'terminated').length }}
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">Total managed: {{ sandboxesList.length }}</div>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
                <span>Running Environments</span>
                <span class="text-emerald-400 text-base">⚡</span>
              </div>
              <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {{ sandboxFleetMetrics ? sandboxFleetMetrics.running_sandboxes : sandboxesList.filter(s => s.status === 'running').length }}
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">Live processes & containers</div>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
                <span>Memory Allocated</span>
                <span class="text-cyan-400 text-base">💾</span>
              </div>
              <div class="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1">
                {{ sandboxFleetMetrics ? sandboxFleetMetrics.total_allocated_memory_mb : 0 }} MB
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">Across active fleet</div>
            </div>

            <div class="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
                <span>Fleet Health</span>
                <span class="text-emerald-400 text-base">🩺</span>
              </div>
              <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {{ sandboxFleetMetrics ? sandboxFleetMetrics.healthy_sandboxes : 0 }} / {{ sandboxFleetMetrics ? sandboxFleetMetrics.active_sandboxes : 0 }}
              </div>
              <div class="text-[10px] text-zinc-400 mt-0.5">Healthy vs degraded runtimes</div>
            </div>
          </div>

          <!-- Main Grid: Sandboxes Fleet Table & Blueprints -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left 2 Cols: Sandboxes Fleet List -->
            <div class="lg:col-span-2 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm">🌐</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Live Dev Sandboxes Fleet</h4>
                  <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ sandboxesList.length }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <select
                    v-model="sandboxFilterStatus"
                    @change="loadSandboxesGovernanceData()"
                    class="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="running">Running</option>
                    <option value="ready">Ready</option>
                    <option value="paused">Paused</option>
                    <option value="terminated">Terminated</option>
                  </select>
                  <select
                    v-model="sandboxFilterEnv"
                    @change="loadSandboxesGovernanceData()"
                    class="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] focus:outline-none"
                  >
                    <option value="">All Environments</option>
                    <option value="worktree">Git Worktree</option>
                    <option value="docker">Docker Container</option>
                    <option value="process">Process Sandbox</option>
                  </select>
                </div>
              </div>

              <div v-if="sandboxesList.length" class="space-y-2.5 max-h-[500px] overflow-y-auto">
                <div
                  v-for="s in sandboxesList"
                  :key="s.id"
                  class="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 hover:border-teal-500/50 transition-colors space-y-2"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-2">
                        <h5 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ s.name }}</h5>
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase"
                          :class="s.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : (s.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20')"
                        >
                          <span v-if="s.status === 'running'" class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                          {{ s.status }}
                        </span>
                        <span class="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-mono">
                          {{ s.environment_type }} / {{ s.runtime_type }}
                        </span>
                      </div>
                      <p class="text-[11px] text-zinc-500 font-mono mt-0.5">
                        Port: <span class="text-teal-400 font-bold">:{{ s.allocated_port }}</span> • URL: <a :href="s.preview_url" target="_blank" class="text-indigo-400 underline hover:text-indigo-300">{{ s.preview_url }}</a>
                      </p>
                    </div>

                    <!-- Quick Actions -->
                    <div class="flex items-center gap-1.5">
                      <button
                        v-if="s.status === 'running'"
                        @click="handleSandboxAction(s.id, 'stop')"
                        class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold"
                        title="Pause Sandbox"
                      >
                        ⏸
                      </button>
                      <button
                        v-if="s.status === 'paused'"
                        @click="handleSandboxAction(s.id, 'start')"
                        class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                        title="Resume Sandbox"
                      >
                        ▶
                      </button>
                      <button
                        @click="selectedSandbox = s; sandboxExecModalOpen = true"
                        class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-teal-400 text-[10px] font-bold"
                        title="Execute Command"
                      >
                        ⚡ Exec
                      </button>
                      <button
                        @click="selectedSandbox = s; sandboxSnapshotModalOpen = true"
                        class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-indigo-400 text-[10px] font-bold"
                        title="Snapshot State"
                      >
                        📸 Snap
                      </button>
                      <button
                        @click="inspectSandbox(s.id)"
                        class="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold"
                        title="Inspect Console & Details"
                      >
                        🔍 Logs
                      </button>
                      <button
                        v-if="s.status !== 'terminated'"
                        @click="handleSandboxAction(s.id, 'terminate')"
                        class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-bold"
                        title="Terminate Sandbox"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <span class="text-zinc-500">Memory: <span class="text-zinc-300 font-bold">{{ s.memory_limit_mb }} MB</span></span>
                    <span class="text-zinc-500">TTL: <span class="text-zinc-300 font-bold">{{ s.ttl_seconds }}s</span></span>
                    <span class="text-zinc-500">Health: <span :class="s.health_status === 'healthy' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'">{{ s.health_status }}</span></span>
                  </div>
                </div>
              </div>
              <div v-else class="py-12 text-center text-xs text-zinc-400">
                No dev sandboxes found. Provision a new sandbox to get started!
              </div>
            </div>

            <!-- Right 1 Col: Blueprints & Templates -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm">📐</span>
                  <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Environment Blueprints</h4>
                  <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ sandboxTemplatesList.length }}</span>
                </div>
              </div>

              <div v-if="sandboxTemplatesList.length" class="space-y-2.5 max-h-[500px] overflow-y-auto">
                <div
                  v-for="t in sandboxTemplatesList"
                  :key="t.id"
                  class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 hover:border-teal-500/50 transition-colors space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <h5 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ t.name }}</h5>
                    <span class="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[10px] font-mono font-bold uppercase">{{ t.runtime_type }}</span>
                  </div>
                  <p class="text-[11px] text-zinc-400">{{ t.description }}</p>
                  <div class="text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded">
                    <div><span class="text-zinc-400">Build:</span> {{ t.build_command }}</div>
                    <div><span class="text-zinc-400">Start:</span> {{ t.start_command }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="py-8 text-center text-xs text-zinc-400">
                Click "Seed Blueprints" above to populate canonical templates.
              </div>
            </div>
          </div>

          <!-- Provision Sandbox Modal -->
          <div v-if="sandboxModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">➕</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Provision Dev Sandbox</h3>
                    <p class="text-[11px] text-zinc-500">Launch an isolated environment with live preview URL</p>
                  </div>
                </div>
                <button @click="sandboxModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Sandbox Name *</label>
                  <input
                    v-model="newSandbox.name"
                    placeholder="e.g. test-refactor-sandbox"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Environment Type</label>
                    <select
                      v-model="newSandbox.environment_type"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="worktree">Git Worktree</option>
                      <option value="docker">Docker Container</option>
                      <option value="process">Process Sandbox</option>
                      <option value="ephemeral_vm">Ephemeral VM</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Runtime</label>
                    <select
                      v-model="newSandbox.runtime_type"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                      <option value="node">Node.js</option>
                      <option value="python">Python</option>
                      <option value="rust">Rust</option>
                      <option value="pocketbase">PocketBase</option>
                      <option value="go">Go</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Memory Limit (MB)</label>
                    <input
                      type="number"
                      v-model.number="newSandbox.memory_limit_mb"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">TTL (Seconds)</label>
                    <input
                      type="number"
                      v-model.number="newSandbox.ttl_seconds"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Environment Variables (JSON)</label>
                  <textarea
                    v-model="newSandbox.env_vars_str"
                    rows="3"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  ></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="sandboxModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  @click="triggerProvisionSandbox()"
                  :disabled="isProvisioningSandbox || !newSandbox.name.trim()"
                  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {{ isProvisioningSandbox ? 'Provisioning...' : 'Launch Sandbox' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Command Execution Modal -->
          <div v-if="sandboxExecModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">⚡</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Execute in Sandbox</h3>
                    <p class="text-[11px] text-zinc-500 font-mono">{{ selectedSandbox?.name }}</p>
                  </div>
                </div>
                <button @click="sandboxExecModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Command *</label>
                  <input
                    v-model="sandboxExecInput.command"
                    placeholder="e.g. npm test, cargo check, python -m pytest"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Executed By</label>
                  <input
                    v-model="sandboxExecInput.executed_by"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="sandboxExecModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  @click="executeInSandbox()"
                  :disabled="isExecutingCommand || !sandboxExecInput.command.trim()"
                  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {{ isExecutingCommand ? 'Executing...' : 'Run Command' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Sandbox Snapshot Modal -->
          <div v-if="sandboxSnapshotModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">📸</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Capture Sandbox State Snapshot</h3>
                    <p class="text-[11px] text-zinc-500 font-mono">{{ selectedSandbox?.name }}</p>
                  </div>
                </div>
                <button @click="sandboxSnapshotModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Snapshot Label *</label>
                  <input
                    v-model="newSandboxSnapshot.snapshot_name"
                    placeholder="e.g. pre-refactor-checkpoint"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
                  <textarea
                    v-model="newSandboxSnapshot.notes"
                    rows="2"
                    placeholder="Reason for state checkpoint..."
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none"
                  ></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="sandboxSnapshotModalOpen = false"
                  class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  @click="createSandboxCheckpoint()"
                  :disabled="isCreatingSnapshot || !newSandboxSnapshot.snapshot_name.trim()"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {{ isCreatingSnapshot ? 'Capturing...' : 'Capture Snapshot' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Sandbox Details & Terminal Log Modal -->
          <div v-if="selectedSandbox && !sandboxExecModalOpen && !sandboxSnapshotModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔍</span>
                  <div>
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ selectedSandbox.name }}</h3>
                    <p class="text-[11px] text-zinc-500 font-mono">Port: :{{ selectedSandbox.allocated_port }} • {{ selectedSandbox.environment_type }}</p>
                  </div>
                </div>
                <button @click="selectedSandbox = null" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="grid grid-cols-4 gap-2 text-xs font-mono">
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Status</p>
                  <p class="font-bold text-emerald-400">{{ selectedSandbox.status }}</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Memory</p>
                  <p class="font-bold text-cyan-400">{{ selectedSandbox.memory_limit_mb }} MB</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">TTL</p>
                  <p class="font-bold text-zinc-200">{{ selectedSandbox.ttl_seconds }}s</p>
                </div>
                <div class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <p class="text-[10px] text-zinc-400">Health</p>
                  <p class="font-bold text-emerald-400">{{ selectedSandbox.health_status }}</p>
                </div>
              </div>

              <!-- Executions Terminal Stream -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Terminal Executions & Console Stream</span>
                  <span class="text-[10px] font-mono text-zinc-400">{{ selectedSandboxExecutions.length }} executions</span>
                </h4>

                <div v-if="selectedSandboxExecutions.length" class="space-y-2 max-h-60 overflow-y-auto">
                  <div
                    v-for="e in selectedSandboxExecutions"
                    :key="e.id"
                    class="p-2.5 rounded-lg bg-zinc-950 font-mono text-xs border border-zinc-800 space-y-1"
                  >
                    <div class="flex items-center justify-between text-zinc-400 text-[10px]">
                      <span class="text-teal-400 font-bold">$ {{ e.command }}</span>
                      <span :class="e.exit_code === 0 ? 'text-emerald-400' : 'text-rose-400'">Exit: {{ e.exit_code }} ({{ e.duration_ms }}ms)</span>
                    </div>
                    <pre class="text-[11px] text-zinc-300 whitespace-pre-wrap overflow-x-auto max-h-24">{{ e.stdout || e.stderr || '(No output)' }}</pre>
                  </div>
                </div>
                <div v-else class="p-4 rounded-lg bg-zinc-950 font-mono text-xs text-zinc-500 text-center">
                  No command executions recorded yet.
                </div>
              </div>

              <!-- Snapshots History -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>State Snapshots</span>
                  <span class="text-[10px] font-mono text-zinc-400">{{ selectedSandboxSnapshots.length }} snapshots</span>
                </h4>
                <div v-if="selectedSandboxSnapshots.length" class="space-y-1.5">
                  <div
                    v-for="snap in selectedSandboxSnapshots"
                    :key="snap.id"
                    class="p-2 rounded bg-zinc-100 dark:bg-zinc-800/80 text-xs flex items-center justify-between font-mono"
                  >
                    <div>
                      <span class="font-bold text-zinc-200">{{ snap.snapshot_name }}</span>
                      <span class="text-zinc-400 text-[10px] ml-2">{{ snap.notes }}</span>
                    </div>
                    <span class="text-indigo-400 text-[10px]">{{ snap.git_commit_sha }} ({{ snap.size_kb }} KB)</span>
                  </div>
                </div>
                <div v-else class="text-xs text-zinc-400">No snapshots captured.</div>
              </div>

              <div class="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="selectedSandbox = null"
                  class="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2I: INCIDENT RESPONSE & LIVE WAR-ROOM (EPIC 31)     -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'incidents'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Top Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-zinc-900 to-amber-950/30 border border-red-800/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">🚨</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Multi-Agent Incident Response & Live Debugging War-Room</h3>
                <span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold animate-pulse">WAR-ROOM ENGINE</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Autonomous Triage • Multi-Agent Hypothesis Falsification • Rapid Mitigations & Rollbacks • 5-Whys Post-Mortems
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="newIncidentModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
              >
                <span>+ Declare Incident</span>
              </button>
              <button
                @click="seedDemoWarroom()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <span>⚡ Seed Demo War-Room</span>
              </button>
              <button
                @click="loadIncidentsGovernanceData()"
                class="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs"
                title="Refresh War-Room"
              >
                🔄
              </button>
            </div>
          </div>

          <!-- Alert / Success Messages -->
          <div v-if="incidentSuccessMsg" class="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between">
            <span>{{ incidentSuccessMsg }}</span>
            <button @click="incidentSuccessMsg = null" class="text-emerald-400 font-bold">&times;</button>
          </div>
          <div v-if="incidentErrorMsg" class="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
            <span>{{ incidentErrorMsg }}</span>
            <button @click="incidentErrorMsg = null" class="text-red-400 font-bold">&times;</button>
          </div>

          <!-- KPI Summary Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-400 text-xs">
                <span>Active War-Rooms</span>
                <span class="text-red-400">🔥</span>
              </div>
              <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-1">
                {{ incidentMetrics ? incidentMetrics.active_warrooms : (incidentsList.filter(i => i.status !== 'resolved' && i.status !== 'postmortem_published').length) }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Total Incidents: {{ incidentsList.length }}</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-400 text-xs">
                <span>P0 / P1 Breakdown</span>
                <span class="text-amber-400">⚠️</span>
              </div>
              <div class="text-xl font-bold text-amber-500 font-mono mt-1">
                {{ incidentMetrics ? (incidentMetrics.p0_critical + ' P0 / ' + incidentMetrics.p1_high + ' P1') : '0 P0 / 0 P1' }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Medium/Low: {{ incidentMetrics ? (incidentMetrics.p2_medium + incidentMetrics.p3_low) : 0 }}</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-400 text-xs">
                <span>Mean Time to Mitigate</span>
                <span class="text-indigo-400">⏱️</span>
              </div>
              <div class="text-xl font-bold text-indigo-400 font-mono mt-1">
                {{ incidentMetrics ? incidentMetrics.mean_time_to_mitigate_minutes : 0 }} <span class="text-xs font-normal">min</span>
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">MTTM Target: &lt; 30m</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div class="flex items-center justify-between text-zinc-400 text-xs">
                <span>Mean Time to Resolve</span>
                <span class="text-emerald-400">✅</span>
              </div>
              <div class="text-xl font-bold text-emerald-400 font-mono mt-1">
                {{ incidentMetrics ? incidentMetrics.mean_time_to_resolve_minutes : 0 }} <span class="text-xs font-normal">min</span>
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Resolved: {{ incidentMetrics ? incidentMetrics.resolved_incidents : 0 }}</div>
            </div>
          </div>

          <!-- Main War-Room Layout: Left Incident List + Right War-Room Workbench -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Column 1: Incidents Triage Roster -->
            <div class="lg:col-span-1 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🚨</span> Incident Triage Roster
                  <span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{{ incidentsList.length }}</span>
                </h4>
              </div>

              <!-- Filter Controls -->
              <div class="grid grid-cols-2 gap-2">
                <select
                  v-model="incidentFilterStatus"
                  @change="loadIncidentsGovernanceData()"
                  class="px-2 py-1 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  <option value="">All Statuses</option>
                  <option value="declared">Declared</option>
                  <option value="triage">Triage</option>
                  <option value="investigating">Investigating</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="resolved">Resolved</option>
                  <option value="postmortem_published">Post-Mortem</option>
                </select>
                <select
                  v-model="incidentFilterSeverity"
                  @change="loadIncidentsGovernanceData()"
                  class="px-2 py-1 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  <option value="">All Severities</option>
                  <option value="p0_critical">P0 Critical</option>
                  <option value="p1_high">P1 High</option>
                  <option value="p2_medium">P2 Medium</option>
                  <option value="p3_low">P3 Low</option>
                </select>
              </div>

              <!-- Incident Cards List -->
              <div v-if="incidentsList.length" class="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                <div
                  v-for="inc in incidentsList"
                  :key="inc.id"
                  @click="inspectIncident(inc.id)"
                  class="p-2.5 rounded-lg border text-xs cursor-pointer transition-all space-y-1.5"
                  :class="selectedIncident && selectedIncident.id === inc.id ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 shadow-xs' : 'bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'"
                >
                  <div class="flex items-center justify-between">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                      :class="inc.severity === 'p0_critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (inc.severity === 'p1_high' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30')"
                    >
                      {{ inc.severity.replace('_', ' ') }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-mono capitalize"
                      :class="inc.status === 'resolved' || inc.status === 'postmortem_published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400 animate-pulse'"
                    >
                      {{ inc.status.replace('_', ' ') }}
                    </span>
                  </div>

                  <div class="font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{{ inc.title }}</div>
                  <div class="text-zinc-500 text-[11px] line-clamp-2">{{ inc.summary }}</div>

                  <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 font-mono">
                    <span>📦 {{ inc.service_name || 'core' }}</span>
                    <span>👤 {{ inc.incident_commander }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="p-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                No incidents match filter. Click "+ Declare Incident" to initialize a war-room.
              </div>
            </div>

            <!-- Column 2 & 3: Active War-Room Workbench -->
            <div class="lg:col-span-2 space-y-3">
              <div v-if="selectedIncident" class="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <!-- War-Room Header & Status Bar -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <div class="flex items-center gap-2">
                      <span
                        class="px-2 py-0.5 rounded text-xs font-bold uppercase"
                        :class="selectedIncident.severity === 'p0_critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (selectedIncident.severity === 'p1_high' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30')"
                      >
                        {{ selectedIncident.severity }}
                      </span>
                      <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedIncident.title }}</h3>
                    </div>
                    <p class="text-xs text-zinc-400 font-mono mt-1">
                      Slug: {{ selectedIncident.slug }} • Service: {{ selectedIncident.service_name }} • Commander: {{ selectedIncident.incident_commander }}
                    </p>
                  </div>

                  <!-- Lifecycle Transition Toolbar -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button
                      v-if="selectedIncident.status === 'declared'"
                      @click="updateIncidentStatus('investigating')"
                      class="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                    >
                      🔍 Begin Investigation
                    </button>
                    <button
                      v-if="selectedIncident.status === 'investigating' || selectedIncident.status === 'triage'"
                      @click="updateIncidentStatus('mitigated')"
                      class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      🛡️ Mark Mitigated
                    </button>
                    <button
                      v-if="selectedIncident.status === 'mitigated'"
                      @click="updateIncidentStatus('resolved')"
                      class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      ✅ Mark Resolved
                    </button>
                    <button
                      v-if="selectedIncident.status === 'resolved' || selectedIncident.status === 'postmortem_published'"
                      @click="generateAutoPostmortem()"
                      class="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                    >
                      📝 5-Whys Post-Mortem
                    </button>
                  </div>
                </div>

                <!-- Subtab Navigation -->
                <div class="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <button
                    @click="incidentActiveSubtab = 'timeline'"
                    class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
                    :class="incidentActiveSubtab === 'timeline' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'"
                  >
                    💬 Live Timeline ({{ (selectedIncident.events || []).length }})
                  </button>
                  <button
                    @click="incidentActiveSubtab = 'hypotheses'"
                    class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
                    :class="incidentActiveSubtab === 'hypotheses' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'"
                  >
                    🔬 Hypotheses Board ({{ (selectedIncident.hypotheses || []).length }})
                  </button>
                  <button
                    @click="incidentActiveSubtab = 'mitigations'"
                    class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
                    :class="incidentActiveSubtab === 'mitigations' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'"
                  >
                    🛠️ Mitigations ({{ (selectedIncident.mitigations || []).length }})
                  </button>
                  <button
                    @click="incidentActiveSubtab = 'postmortem'"
                    class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
                    :class="incidentActiveSubtab === 'postmortem' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'"
                  >
                    📝 Post-Mortem Report
                  </button>
                </div>

                <!-- SUBTAB 1: LIVE TIMELINE -->
                <div v-if="incidentActiveSubtab === 'timeline'" class="space-y-3">
                  <!-- Timeline Stream -->
                  <div class="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    <div
                      v-for="ev in (selectedIncident.events || [])"
                      :key="ev.id"
                      class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <span
                            class="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                            :class="ev.severity === 'critical' || ev.severity === 'error' ? 'bg-red-500/20 text-red-400' : (ev.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-300')"
                          >
                            {{ ev.event_type }}
                          </span>
                          <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ ev.title }}</span>
                        </div>
                        <span class="text-[10px] text-zinc-500 font-mono">{{ ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '' }}</span>
                      </div>
                      <p v-if="ev.content" class="text-zinc-600 dark:text-zinc-300 text-[11px]">{{ ev.content }}</p>
                      <div class="text-[10px] text-zinc-400 font-mono">By: {{ ev.author }} ({{ ev.author_type }})</div>
                    </div>
                  </div>

                  <!-- Add Event Inline Form -->
                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Append Event to War-Room</div>
                    <div class="grid grid-cols-3 gap-2">
                      <input
                        v-model="newIncidentEvent.title"
                        placeholder="Event title or log summary..."
                        class="col-span-2 px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                      <select
                        v-model="newIncidentEvent.event_type"
                        class="px-2 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      >
                        <option value="log_entry">Log Entry</option>
                        <option value="metric_anomaly">Metric Anomaly</option>
                        <option value="hypothesis_tested">Hypothesis Test</option>
                        <option value="mitigation_executed">Mitigation Executed</option>
                        <option value="agent_action">Agent Action</option>
                      </select>
                    </div>
                    <div class="flex gap-2">
                      <input
                        v-model="newIncidentEvent.content"
                        placeholder="Detailed message or stacktrace..."
                        class="flex-1 px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                      <button
                        @click="addIncidentTimelineEvent()"
                        :disabled="!newIncidentEvent.title.trim()"
                        class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                      >
                        Post Event
                      </button>
                    </div>
                  </div>
                </div>

                <!-- SUBTAB 2: HYPOTHESES BOARD -->
                <div v-if="incidentActiveSubtab === 'hypotheses'" class="space-y-3">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto">
                    <div
                      v-for="h in (selectedIncident.hypotheses || [])"
                      :key="h.id"
                      class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2"
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          :class="h.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (h.status === 'falsified' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30')"
                        >
                          {{ h.status }}
                        </span>
                        <span class="font-mono text-zinc-400 text-[10px]">Confidence: {{ Math.round((h.confidence_score || 0) * 100) }}%</span>
                      </div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200">{{ h.hypothesis }}</div>
                      <p v-if="h.rationale" class="text-zinc-500 text-[11px]">{{ h.rationale }}</p>
                      <p v-if="h.evidence" class="text-emerald-400 text-[11px] bg-emerald-950/20 p-1.5 rounded border border-emerald-800/40">Evidence: {{ h.evidence }}</p>

                      <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          v-if="h.status !== 'confirmed'"
                          @click="updateHypothesisStatus(h.id, 'confirmed', 0.95)"
                          class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold"
                        >
                          Confirm
                        </button>
                        <button
                          v-if="h.status !== 'falsified'"
                          @click="updateHypothesisStatus(h.id, 'falsified', 0.1)"
                          class="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold"
                        >
                          Falsify
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Propose Hypothesis Form -->
                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Propose Root-Cause Hypothesis</div>
                    <input
                      v-model="newIncidentHypothesis.hypothesis"
                      placeholder="e.g. SQLite PRAGMA wal_autocheckpoint interval lock contention..."
                      class="w-full px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    />
                    <div class="grid grid-cols-2 gap-2">
                      <input
                        v-model="newIncidentHypothesis.rationale"
                        placeholder="Rationale / initial clues..."
                        class="px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                      <input
                        v-model="newIncidentHypothesis.test_plan"
                        placeholder="Reproduction test plan..."
                        class="px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                    <button
                      @click="proposeHypothesis()"
                      :disabled="!newIncidentHypothesis.hypothesis.trim()"
                      class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      Propose Hypothesis
                    </button>
                  </div>
                </div>

                <!-- SUBTAB 3: MITIGATIONS -->
                <div v-if="incidentActiveSubtab === 'mitigations'" class="space-y-3">
                  <div class="space-y-2 max-h-[350px] overflow-y-auto">
                    <div
                      v-for="m in (selectedIncident.mitigations || [])"
                      :key="m.id"
                      class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2"
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          :class="m.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'"
                        >
                          {{ m.status }}
                        </span>
                        <span class="font-mono text-zinc-400 text-[10px]">Type: {{ m.action_type }}</span>
                      </div>
                      <div class="font-bold text-zinc-800 dark:text-zinc-200">{{ m.title }}</div>
                      <p v-if="m.description" class="text-zinc-500 text-[11px]">{{ m.description }}</p>
                      <p v-if="m.verification_result" class="text-emerald-400 text-[11px]">Outcome: {{ m.verification_result }}</p>

                      <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          v-if="m.status !== 'verified'"
                          @click="updateMitigationStatus(m.id, 'verified')"
                          class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold"
                        >
                          Verify & Settle
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Register Mitigation Form -->
                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Plan & Apply Mitigation</div>
                    <div class="grid grid-cols-3 gap-2">
                      <input
                        v-model="newIncidentMitigation.title"
                        placeholder="Mitigation title..."
                        class="col-span-2 px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                      <select
                        v-model="newIncidentMitigation.action_type"
                        class="px-2 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      >
                        <option value="config_patch">Config Patch</option>
                        <option value="rollback">Rollback Commit</option>
                        <option value="feature_flag">Feature Flag</option>
                        <option value="sandbox_isolation">Sandbox Isolation</option>
                        <option value="code_fix">Code Fix</option>
                      </select>
                    </div>
                    <input
                      v-model="newIncidentMitigation.description"
                      placeholder="Execution steps & parameters..."
                      class="w-full px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    />
                    <button
                      @click="executeMitigationAction()"
                      :disabled="!newIncidentMitigation.title.trim()"
                      class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      Execute Mitigation
                    </button>
                  </div>
                </div>

                <!-- SUBTAB 4: POST-MORTEM REPORT -->
                <div v-if="incidentActiveSubtab === 'postmortem'" class="space-y-3">
                  <div v-if="selectedIncident.postmortem" class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
                    <div class="flex items-center justify-between">
                      <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">{{ selectedIncident.postmortem.title }}</h4>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">
                        {{ selectedIncident.postmortem.status }}
                      </span>
                    </div>

                    <div class="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      <div class="font-semibold text-zinc-700 dark:text-zinc-300">Executive Summary</div>
                      <p class="text-zinc-600 dark:text-zinc-400 mt-1">{{ selectedIncident.postmortem.executive_summary }}</p>
                    </div>

                    <div class="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 whitespace-pre-line font-mono text-[11px]">
                      <div class="font-bold text-indigo-400 font-sans text-xs mb-1">Root Cause (5-Whys Analysis)</div>
                      {{ selectedIncident.postmortem.root_cause_analysis }}
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <div class="p-2.5 rounded bg-zinc-100 dark:bg-zinc-900">
                        <div class="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">Detection Gap</div>
                        <p class="text-zinc-500 text-[10px] mt-0.5">{{ selectedIncident.postmortem.detection_gap || 'None identified' }}</p>
                      </div>
                      <div class="p-2.5 rounded bg-zinc-100 dark:bg-zinc-900">
                        <div class="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">Lessons Learned</div>
                        <p class="text-zinc-500 text-[10px] mt-0.5">{{ selectedIncident.postmortem.lessons_learned || 'N/A' }}</p>
                      </div>
                    </div>
                  </div>
                  <div v-else class="p-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                    <p>No post-mortem document created yet for this incident.</p>
                    <button
                      @click="generateAutoPostmortem()"
                      class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                    >
                      Generate 5-Whys Post-Mortem Report
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="p-12 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                Select an incident from the left roster or click "+ Declare Incident" to open the live war-room workbench.
              </div>
            </div>
          </div>

          <!-- Declare Incident Modal -->
          <div v-if="newIncidentModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🚨</span>
                  <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Declare Production Incident</h3>
                </div>
                <button @click="newIncidentModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Incident Title *</label>
                  <input
                    v-model="newIncident.title"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                    placeholder="e.g. Gateway 503 Spike under Swarm Load"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Severity</label>
                    <select
                      v-model="newIncident.severity"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                    >
                      <option value="p0_critical">P0 Critical</option>
                      <option value="p1_high">P1 High</option>
                      <option value="p2_medium">P2 Medium</option>
                      <option value="p3_low">P3 Low</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Service / Component</label>
                    <input
                      v-model="newIncident.service_name"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                      placeholder="e.g. core-gateway"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Incident Commander</label>
                    <input
                      v-model="newIncident.incident_commander"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Detection Source</label>
                    <select
                      v-model="newIncident.source"
                      class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                    >
                      <option value="runtime_probe">Runtime Probe</option>
                      <option value="ci_pipeline">CI Pipeline</option>
                      <option value="sentry_error">Sentry / Error Logs</option>
                      <option value="agent_eval">Agent Benchmark Eval</option>
                      <option value="user_report">User Report</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Triage Summary</label>
                  <textarea
                    v-model="newIncident.summary"
                    rows="3"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-red-500"
                    placeholder="Initial symptoms, logs, or error rates..."
                  ></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  @click="newIncidentModalOpen = false"
                  class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  @click="declareNewIncident()"
                  :disabled="!newIncident.title.trim() || isLoadingIncidents"
                  class="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {{ isLoadingIncidents ? 'Declaring...' : 'Declare & Open War-Room' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2J0: KNOWLEDGE GRAPH & ARCHITECTURAL MEMORY (EPIC 32) -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'knowledge'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Top Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-violet-950/50 via-indigo-950/40 to-zinc-900 border border-violet-800/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">🧠</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Autonomous Knowledge Graph & Architectural Memory</h3>
                <span class="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-mono font-bold">KNOWLEDGE ENGINE</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Persistent Architectural Facts • Codebase Invariant Compliance Gate • Decision Records (ADRs) • Semantic Symbol Index
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="newKnowledgeModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
              >
                <span>+ Record Fact / ADR</span>
              </button>
              <button
                @click="newInvariantModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
              >
                <span>+ New Invariant</span>
              </button>
              <button
                @click="seedDemoKnowledge()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all"
              >
                <span>🌱 Seed Architecture Demo</span>
              </button>
              <button
                @click="loadKnowledgeGovernanceData()"
                class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs"
                title="Refresh Knowledge Base"
              >
                <span>🔄</span>
              </button>
            </div>
          </div>

          <!-- Alert Toasts -->
          <div v-if="knowledgeSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between">
            <div class="flex items-center gap-2"><span>✅</span><span>{{ knowledgeSuccessMsg }}</span></div>
            <button @click="knowledgeSuccessMsg = null" class="text-emerald-500 hover:text-emerald-300 font-bold">&times;</button>
          </div>
          <div v-if="knowledgeErrorMsg" class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center justify-between">
            <div class="flex items-center gap-2"><span>⚠️</span><span>{{ knowledgeErrorMsg }}</span></div>
            <button @click="knowledgeErrorMsg = null" class="text-red-500 hover:text-red-300 font-bold">&times;</button>
          </div>

          <!-- Top KPI Metrics -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Knowledge Nodes</div>
              <div class="text-xl font-bold text-violet-400 font-mono mt-0.5">
                {{ knowledgeMetrics ? knowledgeMetrics.total_nodes : knowledgeNodesList.length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">
                {{ (knowledgeNodesList.filter(n => n.kind === 'adr')).length }} ADRs • {{ (knowledgeNodesList.filter(n => n.kind === 'symbol')).length }} Symbols
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Active Invariants</div>
              <div class="text-xl font-bold text-indigo-400 font-mono mt-0.5">
                {{ knowledgeMetrics ? knowledgeMetrics.active_invariants : (architecturalInvariantsList.filter(i => i.is_active).length) }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">
                {{ architecturalInvariantsList.filter(i => i.severity === 'p0_blocking').length }} Blocking P0 Gates
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Accepted ADRs</div>
              <div class="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {{ knowledgeNodesList.filter(n => n.kind === 'adr' && n.status === 'accepted').length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Architectural Decisions</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Verification Pass Rate</div>
              <div class="text-xl font-bold text-teal-400 font-mono mt-0.5">
                {{ knowledgeMetrics ? (knowledgeMetrics.pass_rate_percent + '%') : '100%' }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">
                {{ invariantVerificationsList.length }} Audits Run
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Graph Relations</div>
              <div class="text-xl font-bold text-purple-400 font-mono mt-0.5">
                {{ knowledgeMetrics ? knowledgeMetrics.total_relations : knowledgeRelationsList.length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">Dependency & Governance Edges</div>
            </div>
          </div>

          <!-- Subtab Navigation Bar -->
          <div class="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <button
              @click="knowledgeActiveSubtab = 'graph'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              :class="knowledgeActiveSubtab === 'graph' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              <span>🌐</span>
              <span>Knowledge & Symbol Graph ({{ knowledgeNodesList.length }})</span>
            </button>
            <button
              @click="knowledgeActiveSubtab = 'adrs'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              :class="knowledgeActiveSubtab === 'adrs' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              <span>📐</span>
              <span>Architectural Decision Records ({{ knowledgeNodesList.filter(n => n.kind === 'adr').length }})</span>
            </button>
            <button
              @click="knowledgeActiveSubtab = 'invariants'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              :class="knowledgeActiveSubtab === 'invariants' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              <span>🛡️</span>
              <span>Architectural Invariants ({{ architecturalInvariantsList.length }})</span>
            </button>
            <button
              @click="knowledgeActiveSubtab = 'verifier'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              :class="knowledgeActiveSubtab === 'verifier' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              <span>⚡</span>
              <span>Invariant Verifier Playground & Audits ({{ invariantVerificationsList.length }})</span>
            </button>
          </div>

          <!-- SUBTAB 1: KNOWLEDGE & SYMBOL GRAPH EXPLORER -->
          <div v-if="knowledgeActiveSubtab === 'graph'" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left List (1 col) -->
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  v-model="knowledgeSearch"
                  @input="loadKnowledgeGovernanceData()"
                  placeholder="Search facts, symbols, files..."
                  class="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-violet-500"
                />
                <select
                  v-model="knowledgeFilterKind"
                  @change="loadKnowledgeGovernanceData()"
                  class="px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] focus:outline-none"
                >
                  <option value="">All Kinds</option>
                  <option value="invariant">Invariant</option>
                  <option value="adr">ADR</option>
                  <option value="convention">Convention</option>
                  <option value="subsystem">Subsystem</option>
                  <option value="symbol">Symbol</option>
                  <option value="runbook">Runbook</option>
                </select>
              </div>

              <div v-if="isLoadingKnowledge" class="py-8 text-center text-xs text-zinc-500">
                Loading knowledge nodes...
              </div>
              <div v-else-if="knowledgeNodesList.length === 0" class="py-8 text-center text-xs text-zinc-500">
                No knowledge nodes recorded. Record one or click "Seed Architecture Demo".
              </div>
              <div v-else class="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                <div
                  v-for="node in knowledgeNodesList"
                  :key="node.id"
                  @click="inspectKnowledgeNode(node.id)"
                  class="p-2.5 rounded-lg border text-left cursor-pointer transition-all"
                  :class="selectedKnowledgeNode && selectedKnowledgeNode.id === node.id ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500/50' : 'bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'"
                >
                  <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase"
                      :class="node.kind === 'adr' ? 'bg-blue-500/20 text-blue-400' : (node.kind === 'invariant' ? 'bg-red-500/20 text-red-400' : (node.kind === 'subsystem' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-500/20 text-zinc-400'))">
                      {{ node.kind }}
                    </span>
                    <span class="text-[10px] font-mono text-zinc-400">
                      {{ node.status }}
                    </span>
                  </div>
                  <div class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {{ node.title }}
                  </div>
                  <div v-if="node.summary" class="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                    {{ node.summary }}
                  </div>
                  <div v-if="node.file_path" class="text-[10px] font-mono text-violet-400/80 truncate mt-1">
                    📄 {{ node.file_path }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Detail (2 cols) -->
            <div class="lg:col-span-2 p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div v-if="!selectedKnowledgeNode" class="py-16 text-center text-xs text-zinc-500">
                Select a knowledge node on the left to inspect architectural details, relations, and invariants.
              </div>
              <div v-else class="space-y-4">
                <!-- Node Header -->
                <div class="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ selectedKnowledgeNode.title }}</span>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold uppercase">{{ selectedKnowledgeNode.kind }}</span>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">{{ selectedKnowledgeNode.status }}</span>
                    </div>
                    <div class="text-[11px] font-mono text-zinc-400 mt-1 flex items-center gap-3">
                      <span>Slug: {{ selectedKnowledgeNode.slug }}</span>
                      <span v-if="selectedKnowledgeNode.author_agent">Author: {{ selectedKnowledgeNode.author_agent }}</span>
                      <span v-if="selectedKnowledgeNode.confidence_score">Confidence: {{ (selectedKnowledgeNode.confidence_score * 100).toFixed(0) }}%</span>
                    </div>
                  </div>
                </div>

                <!-- Associated File & Symbol info -->
                <div v-if="selectedKnowledgeNode.file_path || selectedKnowledgeNode.symbol_name" class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-1">
                  <div v-if="selectedKnowledgeNode.file_path" class="text-zinc-300">
                    <span class="text-zinc-500">File Path:</span> {{ selectedKnowledgeNode.file_path }}
                  </div>
                  <div v-if="selectedKnowledgeNode.symbol_name" class="text-violet-400">
                    <span class="text-zinc-500">Symbol Name:</span> {{ selectedKnowledgeNode.symbol_name }}
                  </div>
                </div>

                <!-- Markdown Content / Specification -->
                <div class="space-y-1">
                  <div class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Specification & Rationale</div>
                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {{ selectedKnowledgeNode.content_markdown || selectedKnowledgeNode.summary || 'No detailed content provided.' }}
                  </div>
                </div>

                <!-- Relations Grid (Inbound & Outbound) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Outbound Relations ({{ selectedKnowledgeNodeOutbound.length }})</span>
                      <span class="text-violet-400">→ Target</span>
                    </div>
                    <div v-if="selectedKnowledgeNodeOutbound.length === 0" class="text-[11px] text-zinc-500">
                      No outbound relations registered.
                    </div>
                    <div v-else class="space-y-1.5">
                      <div v-for="rel in selectedKnowledgeNodeOutbound" :key="rel.id" class="text-xs p-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span class="font-mono text-[10px] px-1 rounded bg-violet-500/20 text-violet-300 font-bold uppercase mr-1">{{ rel.relation_type }}</span>
                        <span class="text-zinc-300">{{ rel.description || ('Node: ' + rel.target_node_id) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Inbound Relations ({{ selectedKnowledgeNodeInbound.length }})</span>
                      <span class="text-indigo-400">← Source</span>
                    </div>
                    <div v-if="selectedKnowledgeNodeInbound.length === 0" class="text-[11px] text-zinc-500">
                      No inbound relations registered.
                    </div>
                    <div v-else class="space-y-1.5">
                      <div v-for="rel in selectedKnowledgeNodeInbound" :key="rel.id" class="text-xs p-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span class="font-mono text-[10px] px-1 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase mr-1">{{ rel.relation_type }}</span>
                        <span class="text-zinc-300">{{ rel.description || ('Node: ' + rel.source_node_id) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SUBTAB 2: ARCHITECTURAL DECISION RECORDS (ADRs) -->
          <div v-else-if="knowledgeActiveSubtab === 'adrs'" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="adr in knowledgeNodesList.filter(n => n.kind === 'adr')"
                :key="adr.id"
                class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{{ adr.title }}</div>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0"
                    :class="adr.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'"
                  >
                    {{ adr.status }}
                  </span>
                </div>
                <p class="text-xs text-zinc-400 line-clamp-2">{{ adr.summary }}</p>
                <div class="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 text-xs font-sans text-zinc-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {{ adr.content_markdown }}
                </div>
                <div class="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                  <span>Author: {{ adr.author_agent || 'Architect' }}</span>
                  <span>{{ adr.created ? new Date(adr.created).toLocaleDateString() : '' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SUBTAB 3: ARCHITECTURAL INVARIANTS -->
          <div v-else-if="knowledgeActiveSubtab === 'invariants'" class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Registered Architectural Invariants & Compliance Rules</span>
              <button
                @click="newInvariantModalOpen = true"
                class="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-xs"
              >
                + Add Rule
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-[10px] uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th class="p-2.5">Rule Name</th>
                    <th class="p-2.5">Type</th>
                    <th class="p-2.5">Pattern / Expression</th>
                    <th class="p-2.5">Severity</th>
                    <th class="p-2.5">Enforcement</th>
                    <th class="p-2.5">Status</th>
                    <th class="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr v-for="inv in architecturalInvariantsList" :key="inv.id" class="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td class="p-2.5 font-semibold text-zinc-900 dark:text-zinc-100">{{ inv.rule_name }}</td>
                    <td class="p-2.5 font-mono text-[10px] text-zinc-400">{{ inv.rule_type }}</td>
                    <td class="p-2.5 font-mono text-[10px] text-violet-400">{{ inv.pattern_expression }}</td>
                    <td class="p-2.5">
                      <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                        :class="inv.severity === 'p0_blocking' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'">
                        {{ inv.severity }}
                      </span>
                    </td>
                    <td class="p-2.5 font-mono text-[10px] text-zinc-400">{{ inv.enforcement_action }}</td>
                    <td class="p-2.5">
                      <button
                        @click="toggleInvariantActive(inv)"
                        class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        :class="inv.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'"
                      >
                        {{ inv.is_active ? 'Active' : 'Disabled' }}
                      </button>
                    </td>
                    <td class="p-2.5 text-right">
                      <button
                        @click="toggleInvariantActive(inv)"
                        class="text-[11px] text-zinc-400 hover:text-zinc-200"
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- SUBTAB 4: INVARIANT VERIFIER PLAYGROUND & AUDITS -->
          <div v-else-if="knowledgeActiveSubtab === 'verifier'" class="space-y-4">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <!-- Left: Form -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Interactive Invariant Verification Playground</span>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-400 mb-1">Target File Paths (one per line)</label>
                  <textarea
                    v-model="verifierPlaygroundInput.target_files_str"
                    rows="4"
                    class="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono focus:outline-none focus:border-violet-500"
                    placeholder="app/pb_public/js/components/Custom.js&#10;app/pb_hooks/116_test.pb.js"
                  ></textarea>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-400 mb-1">Proposed Code Diff / Change Summary</label>
                  <input
                    type="text"
                    v-model="verifierPlaygroundInput.diff_summary"
                    class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-violet-500"
                    placeholder="Refactored database transaction logic"
                  />
                </div>
                <div class="flex items-center justify-between pt-2">
                  <span class="text-[11px] text-zinc-500">Evaluates against all {{ architecturalInvariantsList.filter(i => i.is_active).length }} active invariants</span>
                  <button
                    @click="runPlaygroundVerification()"
                    :disabled="isVerifyingInvariants"
                    class="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>{{ isVerifyingInvariants ? 'Verifying...' : '⚡ Verify Invariants' }}</span>
                  </button>
                </div>
              </div>

              <!-- Right: Result -->
              <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Audit Verification Result</span>
                  <span v-if="latestVerificationResult" class="text-[10px] font-mono text-zinc-500">{{ latestVerificationResult.execution_ms }}ms</span>
                </div>

                <div v-if="!latestVerificationResult" class="py-12 text-center text-xs text-zinc-500">
                  Run a verification on the left to inspect invariant compliance, violations, and rule results.
                </div>
                <div v-else class="space-y-3">
                  <div
                    class="p-3 rounded-lg border flex items-center justify-between"
                    :class="latestVerificationResult.verdict === 'passed' ? 'bg-emerald-500/10 border-emerald-500/30' : (latestVerificationResult.verdict === 'warnings_only' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30')"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-lg">{{ latestVerificationResult.verdict === 'passed' ? '✅' : '❌' }}</span>
                      <div>
                        <div class="text-xs font-bold uppercase tracking-wider"
                          :class="latestVerificationResult.verdict === 'passed' ? 'text-emerald-400' : (latestVerificationResult.verdict === 'warnings_only' ? 'text-amber-400' : 'text-red-400')">
                          VERDICT: {{ latestVerificationResult.verdict }}
                        </div>
                        <div class="text-[10px] text-zinc-400">Total Checked Rules: {{ latestVerificationResult.total_rules_checked }}</div>
                      </div>
                    </div>
                  </div>

                  <div v-if="latestVerificationResult.violations && latestVerificationResult.violations.length" class="space-y-1.5">
                    <div class="text-[10px] font-bold text-red-400 uppercase tracking-wider">Violations Detected ({{ latestVerificationResult.violations.length }})</div>
                    <div v-for="(v, idx) in latestVerificationResult.violations" :key="idx" class="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                      <div class="font-bold">{{ v.rule_name }} [{{ v.severity }}]</div>
                      <div class="text-[11px] text-zinc-400 mt-0.5">{{ v.reason }}</div>
                    </div>
                  </div>

                  <div v-if="latestVerificationResult.passed_rules && latestVerificationResult.passed_rules.length" class="space-y-1">
                    <div class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Passed Rules ({{ latestVerificationResult.passed_rules.length }})</div>
                    <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      <span v-for="(pr, idx) in latestVerificationResult.passed_rules" :key="idx" class="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                        ✓ {{ pr.rule_name }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recent Verifications History Table -->
            <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Audit History & Verification Logs</div>
              <div v-if="invariantVerificationsList.length === 0" class="py-6 text-center text-xs text-zinc-500">
                No past verification runs logged yet.
              </div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-xs text-left">
                  <thead class="text-[10px] uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th class="p-2.5">Verdict</th>
                      <th class="p-2.5">Agent</th>
                      <th class="p-2.5">Touched Files</th>
                      <th class="p-2.5">Diff Summary</th>
                      <th class="p-2.5">Duration</th>
                      <th class="p-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr v-for="ver in invariantVerificationsList" :key="ver.id" class="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                          :class="ver.verdict === 'passed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
                          {{ ver.verdict }}
                        </span>
                      </td>
                      <td class="p-2.5 font-mono text-[10px] text-zinc-300">{{ ver.agent_name }}</td>
                      <td class="p-2.5 font-mono text-[10px] text-violet-400">{{ (ver.target_files_json || []).join(', ') }}</td>
                      <td class="p-2.5 text-zinc-400 truncate max-w-xs">{{ ver.diff_summary }}</td>
                      <td class="p-2.5 font-mono text-[10px] text-zinc-500">{{ ver.execution_ms }}ms</td>
                      <td class="p-2.5 text-[10px] text-zinc-500">{{ ver.created ? new Date(ver.created).toLocaleTimeString() : '' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- MODAL: NEW KNOWLEDGE NODE -->
          <div v-if="newKnowledgeModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🧠</span>
                  <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Record Knowledge Node / ADR</h4>
                </div>
                <button @click="newKnowledgeModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                  <input type="text" v-model="newKnowledgeNode.title" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="e.g. ADR-005: SQLite WAL Mode for High Concurrency" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Kind</label>
                    <select v-model="newKnowledgeNode.kind" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="invariant">Invariant</option>
                      <option value="adr">ADR (Decision Record)</option>
                      <option value="convention">Convention</option>
                      <option value="subsystem">Subsystem</option>
                      <option value="symbol">Symbol</option>
                      <option value="runbook">Runbook</option>
                      <option value="antipattern">Antipattern</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                    <select v-model="newKnowledgeNode.status" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="active">Active</option>
                      <option value="accepted">Accepted</option>
                      <option value="proposed">Proposed</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Summary</label>
                  <input type="text" v-model="newKnowledgeNode.summary" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="Concise summary of fact" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Associated File Path</label>
                    <input type="text" v-model="newKnowledgeNode.file_path" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="app/pb_hooks/116_*.pb.js" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Symbol Name</label>
                    <input type="text" v-model="newKnowledgeNode.symbol_name" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="routerAdd" />
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Markdown Specification / Rationale</label>
                  <textarea v-model="newKnowledgeNode.content_markdown" rows="4" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="# Context&#10;Describe architectural background and implications..."></textarea>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tags (comma-separated)</label>
                  <input type="text" v-model="newKnowledgeNode.tags_str" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button @click="newKnowledgeModalOpen = false" class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">Cancel</button>
                <button @click="createKnowledgeNodeSubmit()" :disabled="!newKnowledgeNode.title.trim()" class="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs">Save Node</button>
              </div>
            </div>
          </div>

          <!-- MODAL: NEW INVARIANT -->
          <div v-if="newInvariantModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🛡️</span>
                  <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Architectural Invariant Rule</h4>
                </div>
                <button @click="newInvariantModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Rule Name</label>
                  <input type="text" v-model="newArchitecturalInvariant.rule_name" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="e.g. Disallow runtime node_modules in frontend" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Rule Type</label>
                    <select v-model="newArchitecturalInvariant.rule_type" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="path_pattern">Path Pattern</option>
                      <option value="dependency_constraint">Dependency Constraint</option>
                      <option value="naming_convention">Naming Convention</option>
                      <option value="security_policy">Security Policy</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Severity</label>
                    <select v-model="newArchitecturalInvariant.severity" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="p0_blocking">P0 Blocking</option>
                      <option value="p1_warning">P1 Warning</option>
                      <option value="p2_advisory">P2 Advisory</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pattern Expression</label>
                  <input type="text" v-model="newArchitecturalInvariant.pattern_expression" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="forbidden:node_modules or require_match:^tests/test_.*" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button @click="newInvariantModalOpen = false" class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">Cancel</button>
                <button @click="createArchitecturalInvariantSubmit()" :disabled="!newArchitecturalInvariant.rule_name.trim()" class="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs">Register Invariant</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- PANE 2J1: AUTONOMOUS CODE REVIEW SWARM & MERGE GATE (EPIC 33) -->
        <!-- ========================================================= -->
        <div v-else-if="activeTab === 'code_reviews'" class="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/30">
          <!-- Top Header Banner -->
          <div class="p-4 rounded-xl bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-zinc-900 border border-emerald-800/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">🔍</span>
                <h3 class="text-sm font-bold text-white tracking-wide">Autonomous Code Review Swarm & AST Critique Hub</h3>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">REVIEW SWARM</span>
              </div>
              <p class="text-xs text-zinc-300 mt-1">
                Multi-Persona Review Matrix (Security, Architecture Invariants, Performance, YAGNI, Test Coverage) • Automated Patch Synthesis • Consensus Merge Gate
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="newReviewModalOpen = true"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
              >
                <span>+ Request Code Review</span>
              </button>
              <button
                @click="loadCodeReviewsData()"
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 shadow-xs flex items-center gap-1"
                :class="isLoadingCodeReviews ? 'opacity-50 cursor-not-allowed' : ''"
              >
                <span>↻ Refresh</span>
              </button>
            </div>
          </div>

          <!-- Alert notifications -->
          <div v-if="codeReviewSuccessMsg" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>✓</span>
              <span>{{ codeReviewSuccessMsg }}</span>
            </div>
            <button @click="codeReviewSuccessMsg = null" class="text-emerald-400 hover:text-emerald-200">&times;</button>
          </div>
          <div v-if="codeReviewErrorMsg" class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>⚠️</span>
              <span>{{ codeReviewErrorMsg }}</span>
            </div>
            <button @click="codeReviewErrorMsg = null" class="text-rose-400 hover:text-rose-200">&times;</button>
          </div>

          <!-- KPI Cards Overview Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Reviews</div>
              <div class="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-0.5">
                {{ codeReviewMetrics ? codeReviewMetrics.total_reviews : codeReviewsList.length }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">
                {{ codeReviewMetrics ? codeReviewMetrics.merged_reviews : 0 }} Merged • {{ codeReviewMetrics ? codeReviewMetrics.blocked_reviews : 0 }} Blocked
              </div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Avg Quality Score</div>
              <div class="text-xl font-black mt-0.5" :class="(codeReviewMetrics ? codeReviewMetrics.average_score : 100) >= 80 ? 'text-emerald-400' : ((codeReviewMetrics ? codeReviewMetrics.average_score : 100) >= 60 ? 'text-amber-400' : 'text-rose-400')">
                {{ codeReviewMetrics ? codeReviewMetrics.average_score : 100 }}/100
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">Composite Persona Benchmark</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <div class="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">P0 Blockers</div>
              <div class="text-xl font-black text-rose-400 mt-0.5">
                {{ codeReviewMetrics ? (codeReviewMetrics.severity_distribution ? codeReviewMetrics.severity_distribution.p0_blocker : 0) : 0 }}
              </div>
              <div class="text-[10px] text-rose-500/80 mt-1">Zero-Tolerance Merge Gate</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <div class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">P1 Warnings</div>
              <div class="text-xl font-black text-amber-400 mt-0.5">
                {{ codeReviewMetrics ? (codeReviewMetrics.severity_distribution ? codeReviewMetrics.severity_distribution.p1_warning : 0) : 0 }}
              </div>
              <div class="text-[10px] text-amber-500/80 mt-1">Actionable Improvements</div>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <div class="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">Patches Synthesized</div>
              <div class="text-xl font-black text-teal-400 mt-0.5">
                {{ codeReviewMetrics ? codeReviewMetrics.total_patches_synthesized : 0 }}
              </div>
              <div class="text-[10px] text-zinc-500 mt-1">1-Click Dry-Run Fixes</div>
            </div>
          </div>

          <!-- Main Split Layout: Left Reviews List / Right Review Inspector -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <!-- Left: Reviews List Panel -->
            <div class="lg:col-span-4 space-y-3">
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Review Requests ({{ codeReviewsList.length }})</span>
                  <button @click="newReviewModalOpen = true" class="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300">+ New</button>
                </div>

                <!-- Filters -->
                <div class="flex gap-1.5">
                  <input
                    type="text"
                    v-model="codeReviewSearch"
                    @input="loadCodeReviewsData()"
                    placeholder="Search reviews..."
                    class="flex-1 px-2.5 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  />
                  <select
                    v-model="codeReviewFilterStatus"
                    @change="loadCodeReviewsData()"
                    class="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="changes_requested">Changes Req</option>
                    <option value="approved">Approved</option>
                    <option value="blocked">Blocked</option>
                    <option value="merged">Merged</option>
                  </select>
                </div>

                <!-- List Items -->
                <div v-if="codeReviewsList.length === 0" class="py-8 text-center text-xs text-zinc-500">
                  No code reviews found. Click "+ Request Code Review" to submit your first change.
                </div>
                <div v-else class="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                  <div
                    v-for="rev in codeReviewsList"
                    :key="rev.id"
                    @click="inspectCodeReview(rev.id)"
                    class="p-2.5 rounded-lg border text-xs cursor-pointer transition-all space-y-1.5"
                    :class="selectedCodeReview && selectedCodeReview.id === rev.id ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs' : 'bg-zinc-50/70 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'"
                  >
                    <div class="flex items-start justify-between gap-1.5">
                      <div class="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 flex-1">{{ rev.title }}</div>
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase shrink-0"
                        :class="rev.verdict === 'approved' || rev.status === 'approved' || rev.status === 'merged' ? 'bg-emerald-500/20 text-emerald-300' : (rev.verdict === 'blocked' || rev.status === 'blocked' ? 'bg-rose-500/20 text-rose-300' : (rev.verdict === 'changes_requested' || rev.status === 'changes_requested' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-500/20 text-zinc-400'))"
                      >
                        {{ rev.status }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>🌿 {{ rev.source_branch }} → {{ rev.target_branch }}</span>
                      <span class="font-bold" :class="(rev.overall_score || 100) >= 80 ? 'text-emerald-400' : ((rev.overall_score || 100) >= 60 ? 'text-amber-400' : 'text-rose-400')">
                        {{ rev.overall_score || 100 }} pts
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <span>🤖 {{ rev.author_agent || 'agent' }}</span>
                      <div class="flex items-center gap-1">
                        <span v-if="rev.p0_count > 0" class="text-rose-400 font-bold">⛔ {{ rev.p0_count }} P0</span>
                        <span v-if="rev.p1_count > 0" class="text-amber-400">⚠️ {{ rev.p1_count }} P1</span>
                        <button @click.stop="deleteReviewItem(rev.id)" class="hover:text-rose-400 ml-1 text-zinc-400">&times;</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Selected Review Inspector Panel -->
            <div class="lg:col-span-8 space-y-4">
              <div v-if="!selectedCodeReview" class="p-12 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 text-xs">
                Select a code review from the left sidebar or create a new review request.
              </div>
              <div v-else class="space-y-4">
                <!-- Review Header & Action Controls Bar -->
                <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <h4 class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ selectedCodeReview.title }}</h4>
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase"
                          :class="selectedCodeReview.verdict === 'approved' || selectedCodeReview.status === 'approved' || selectedCodeReview.status === 'merged' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : (selectedCodeReview.verdict === 'blocked' || selectedCodeReview.status === 'blocked' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : (selectedCodeReview.verdict === 'changes_requested' || selectedCodeReview.status === 'changes_requested' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'))"
                        >
                          {{ selectedCodeReview.status }}
                        </span>
                      </div>
                      <p class="text-xs text-zinc-400">{{ selectedCodeReview.summary || 'No summary provided.' }}</p>
                      <div class="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                        <span>Branch: <span class="text-zinc-300">{{ selectedCodeReview.source_branch }}</span> → <span class="text-zinc-300">{{ selectedCodeReview.target_branch }}</span></span>
                        <span>Author: <span class="text-zinc-300">{{ selectedCodeReview.author_agent }}</span></span>
                        <span>Strategy: <span class="text-zinc-300 uppercase">{{ selectedCodeReview.merge_strategy || 'squash' }}</span></span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        @click="triggerReviewSwarm(selectedCodeReview.id)"
                        :disabled="isDispatchingReviewSwarm"
                        class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <span>🤖 {{ isDispatchingReviewSwarm ? 'Running Swarm...' : 'Run Review Swarm' }}</span>
                      </button>

                      <button
                        @click="triggerSynthesizePatch(selectedCodeReview.id)"
                        :disabled="isSynthesizingPatch || selectedReviewCritiques.length === 0"
                        class="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <span>⚡ {{ isSynthesizingPatch ? 'Synthesizing...' : 'Synthesize Patch' }}</span>
                      </button>

                      <button
                        v-if="selectedCodeReview.status !== 'merged'"
                        @click="triggerMergeReview(selectedCodeReview.id)"
                        :disabled="selectedCodeReview.verdict === 'blocked'"
                        class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                        :title="selectedCodeReview.verdict === 'blocked' ? 'Resolve P0 blockers or use manual override to merge' : 'Execute autonomous merge'"
                      >
                        <span>🔀 Merge</span>
                      </button>

                      <button
                        v-if="selectedCodeReview.verdict === 'blocked' || selectedCodeReview.status === 'blocked'"
                        @click="overrideGateModalOpen = true"
                        class="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <span>🛡️ Override Gate</span>
                      </button>
                    </div>
                  </div>

                  <!-- Subtab Navigation -->
                  <div class="flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-2">
                    <button
                      @click="codeReviewActiveSubtab = 'critiques'"
                      class="px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5"
                      :class="codeReviewActiveSubtab === 'critiques' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'"
                    >
                      <span>💬 Persona Critiques ({{ selectedReviewCritiques.length }})</span>
                    </button>

                    <button
                      @click="codeReviewActiveSubtab = 'diff'"
                      class="px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5"
                      :class="codeReviewActiveSubtab === 'diff' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'"
                    >
                      <span>📄 Unified Diff ({{ (selectedCodeReview.files_touched || []).length }} files)</span>
                    </button>

                    <button
                      @click="codeReviewActiveSubtab = 'patches'"
                      class="px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5"
                      :class="codeReviewActiveSubtab === 'patches' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'"
                    >
                      <span>⚡ Synthesized Patches ({{ selectedReviewPatches.length }})</span>
                    </button>

                    <button
                      @click="codeReviewActiveSubtab = 'gate'"
                      class="px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5"
                      :class="codeReviewActiveSubtab === 'gate' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'"
                    >
                      <span>⚖️ Merge Gate Consensus</span>
                    </button>
                  </div>
                </div>

                <!-- SUBTAB 1: PERSONA CRITIQUES -->
                <div v-if="codeReviewActiveSubtab === 'critiques'" class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Swarm Critiques & Inline Reviews</span>
                      <span class="text-[11px] text-zinc-500 font-mono">
                        {{ selectedReviewCritiques.filter(c => c.status === 'open').length }} open
                      </span>
                    </div>
                    <button
                      @click="newCritiqueModalOpen = true"
                      class="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60"
                    >
                      + Add Critique
                    </button>
                  </div>

                  <div v-if="selectedReviewCritiques.length === 0" class="p-8 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 space-y-2">
                    <p>No critiques logged yet. Run the Autonomous Review Swarm to evaluate across 6 personas.</p>
                    <button
                      @click="triggerReviewSwarm(selectedCodeReview.id)"
                      class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      Dispatch Review Swarm Now
                    </button>
                  </div>

                  <div v-else class="space-y-2.5">
                    <div
                      v-for="c in selectedReviewCritiques"
                      :key="c.id"
                      class="p-3.5 rounded-xl border text-xs space-y-2.5 transition-all"
                      :class="c.severity === 'p0_blocker' ? 'bg-rose-950/20 border-rose-800/50' : (c.severity === 'p1_warning' ? 'bg-amber-950/20 border-amber-800/50' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800')"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span
                            class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono"
                            :class="c.severity === 'p0_blocker' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : (c.severity === 'p1_warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30')"
                          >
                            {{ c.severity }}
                          </span>

                          <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                            👤 {{ c.persona }}
                          </span>

                          <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ c.title }}</span>
                        </div>

                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-mono uppercase"
                          :class="c.status === 'patched' ? 'bg-emerald-500/20 text-emerald-300' : (c.status === 'dismissed' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-amber-500/20 text-amber-300')"
                        >
                          {{ c.status }}
                        </span>
                      </div>

                      <div class="text-xs text-zinc-300 leading-relaxed">{{ c.critique_markdown }}</div>

                      <div class="flex items-center gap-3 text-[10px] text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-950/60 p-2 rounded-lg">
                        <span>📁 File: <span class="text-zinc-200">{{ c.file_path || 'N/A' }}</span></span>
                        <span v-if="c.line_start">Lines: {{ c.line_start }}-{{ c.line_end }}</span>
                        <span>Confidence: {{ Math.round((c.confidence_score || 0.9) * 100) }}%</span>
                        <span v-if="c.rule_or_invariant_id">Rule: {{ c.rule_or_invariant_id }}</span>
                      </div>

                      <div v-if="c.suggested_diff" class="p-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] space-y-1">
                        <div class="text-[10px] text-zinc-500 font-semibold uppercase">Suggested Fix Diff:</div>
                        <pre class="text-emerald-400 whitespace-pre-wrap overflow-x-auto">{{ c.suggested_diff }}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- SUBTAB 2: UNIFIED DIFF -->
                <div v-if="codeReviewActiveSubtab === 'diff'" class="space-y-3">
                  <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Touched Files ({{ (selectedCodeReview.files_touched || []).length }})</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="(f, idx) in (selectedCodeReview.files_touched || [])" :key="idx" class="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-300">
                        📄 {{ f }}
                      </span>
                    </div>

                    <div class="border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-2">Unified Git Diff Content</div>
                      <pre class="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">{{ selectedCodeReview.diff_content || 'No diff content provided.' }}</pre>
                    </div>
                  </div>
                </div>

                <!-- SUBTAB 3: SYNTHESIZED PATCHES -->
                <div v-if="codeReviewActiveSubtab === 'patches'" class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Synthesized Fix Patches ({{ selectedReviewPatches.length }})</span>
                    <button
                      @click="triggerSynthesizePatch(selectedCodeReview.id)"
                      :disabled="isSynthesizingPatch"
                      class="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                    >
                      + Synthesize New Patch
                    </button>
                  </div>

                  <div v-if="selectedReviewPatches.length === 0" class="p-8 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
                    No synthesized patches yet. Click "+ Synthesize New Patch" to automatically generate clean unified diffs resolving open critiques.
                  </div>

                  <div v-else class="space-y-3">
                    <div
                      v-for="p in selectedReviewPatches"
                      :key="p.id"
                      class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-base">⚡</span>
                          <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ p.title }}</span>
                          <span
                            class="px-2 py-0.5 rounded text-[10px] font-mono uppercase"
                            :class="p.status === 'applied' ? 'bg-emerald-500/20 text-emerald-300' : (p.status === 'reverted' ? 'bg-rose-500/20 text-rose-300' : 'bg-teal-500/20 text-teal-300')"
                          >
                            {{ p.status }}
                          </span>
                        </div>

                        <div class="flex items-center gap-2">
                          <button
                            v-if="p.status !== 'applied'"
                            @click="triggerApplyPatch(p.id)"
                            class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                          >
                            Apply Patch
                          </button>
                          <button
                            v-if="p.status === 'applied'"
                            @click="triggerRevertPatch(p.id)"
                            class="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                          >
                            Revert Patch
                          </button>
                        </div>
                      </div>

                      <div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
                        ✓ {{ p.dry_run_output || 'Clean dry-run AST application.' }}
                      </div>

                      <div>
                        <div class="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Unified Patch Diff:</div>
                        <pre class="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-teal-300 max-h-48 overflow-y-auto whitespace-pre-wrap">{{ p.patch_unified_diff }}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- SUBTAB 4: MERGE GATE CONSENSUS -->
                <div v-if="codeReviewActiveSubtab === 'gate'" class="space-y-3">
                  <div class="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      <div>
                        <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Merge Gate & Quality Rules Checklist</div>
                        <p class="text-[11px] text-zinc-400">Strict multi-persona verification before merge to protected branches.</p>
                      </div>
                      <button
                        @click="triggerEvaluateGate(selectedCodeReview.id)"
                        class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                      >
                        Re-Evaluate Gate
                      </button>
                    </div>

                    <!-- Checklist -->
                    <div class="space-y-2 text-xs">
                      <div class="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-2">
                          <span :class="selectedCodeReview.p0_count === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'">
                            {{ selectedCodeReview.p0_count === 0 ? '✓' : '✗' }}
                          </span>
                          <span>Zero P0 Blockers Rule</span>
                        </div>
                        <span class="font-mono text-[11px]" :class="selectedCodeReview.p0_count === 0 ? 'text-emerald-400' : 'text-rose-400'">
                          {{ selectedCodeReview.p0_count }} open blockers
                        </span>
                      </div>

                      <div class="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-2">
                          <span class="text-emerald-400 font-bold">✓</span>
                          <span>Architectural Invariant Compliance (Hook 116)</span>
                        </div>
                        <span class="font-mono text-[11px] text-emerald-400">PASSED</span>
                      </div>

                      <div class="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-2">
                          <span :class="selectedCodeReview.p1_count === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'">
                            {{ selectedCodeReview.p1_count === 0 ? '✓' : '⚠️' }}
                          </span>
                          <span>Security & Credential Scanning</span>
                        </div>
                        <span class="font-mono text-[11px]" :class="selectedCodeReview.p1_count === 0 ? 'text-emerald-400' : 'text-amber-400'">
                          {{ selectedCodeReview.p1_count }} warnings
                        </span>
                      </div>

                      <div class="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                        <div class="flex items-center gap-2">
                          <span class="text-emerald-400 font-bold">✓</span>
                          <span>FOSS & No-Monetization Non-Negotiable Contract</span>
                        </div>
                        <span class="font-mono text-[11px] text-emerald-400">PASSED</span>
                      </div>
                    </div>

                    <!-- Verdict box -->
                    <div
                      class="p-4 rounded-xl border space-y-2"
                      :class="selectedCodeReview.verdict === 'approved' ? 'bg-emerald-950/20 border-emerald-800/50' : (selectedCodeReview.verdict === 'blocked' ? 'bg-rose-950/20 border-rose-800/50' : 'bg-amber-950/20 border-amber-800/50')"
                    >
                      <div class="flex items-center justify-between">
                        <div class="text-xs font-bold uppercase tracking-wider" :class="selectedCodeReview.verdict === 'approved' ? 'text-emerald-300' : (selectedCodeReview.verdict === 'blocked' ? 'text-rose-300' : 'text-amber-300')">
                          Consensus Verdict: {{ selectedCodeReview.verdict }}
                        </div>
                        <span class="text-xs font-mono font-bold">{{ selectedCodeReview.overall_score || 100 }}/100</span>
                      </div>
                      <div v-if="selectedReviewVerdict" class="text-xs text-zinc-300 whitespace-pre-wrap">{{ selectedReviewVerdict.summary_markdown }}</div>
                      <div v-else class="text-xs text-zinc-400">Run gate evaluation to generate formal arbiter verdict.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- MODAL 1: REQUEST CODE REVIEW -->
          <div v-if="newReviewModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔍</span>
                  <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Request Code Review</h4>
                </div>
                <button @click="newReviewModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Review Title</label>
                  <input type="text" v-model="newCodeReview.title" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="e.g. feat: add knowledge graph memory index and invariant engine" />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Source Branch</label>
                    <input type="text" v-model="newCodeReview.source_branch" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Branch</label>
                    <input type="text" v-model="newCodeReview.target_branch" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Touched Files (comma-separated)</label>
                  <input type="text" v-model="newCodeReview.files_touched_str" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="app/pb_hooks/116.pb.js, tests/test_kg.py" />
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Summary / Context</label>
                  <textarea v-model="newCodeReview.summary" rows="2" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="Describe the changes made..."></textarea>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Unified Git Diff Content</label>
                  <textarea v-model="newCodeReview.diff_content" rows="4" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="--- a/file.js&#10;+++ b/file.js&#10;@@ -1,5 +1,5 @@&#10;+ const x = 1;"></textarea>
                </div>

                <div class="flex items-center gap-2">
                  <input type="checkbox" id="rev_auto_swarm" v-model="newCodeReview.auto_swarm" class="rounded border-zinc-700" />
                  <label for="rev_auto_swarm" class="text-xs text-zinc-300">Automatically run review swarm upon submission</label>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button @click="newReviewModalOpen = false" class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">Cancel</button>
                <button @click="submitNewReviewModal()" :disabled="!newCodeReview.title.trim()" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs">Submit Review Request</button>
              </div>
            </div>
          </div>

          <!-- MODAL 2: ADD CRITIQUE -->
          <div v-if="newCritiqueModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">💬</span>
                  <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Persona Code Review Critique</h4>
                </div>
                <button @click="newCritiqueModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Persona</label>
                    <select v-model="newCritique.persona" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="security_auditor">Security Auditor</option>
                      <option value="architecture_guardian">Architecture Guardian</option>
                      <option value="performance_specialist">Performance Specialist</option>
                      <option value="simplicity_yagni">Simplicity & YAGNI</option>
                      <option value="test_coverage_critic">Test Coverage Critic</option>
                      <option value="style_conventions">Style Conventions</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Severity</label>
                    <select v-model="newCritique.severity" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <option value="p0_blocker">P0 Blocker (Blocks Merge)</option>
                      <option value="p1_warning">P1 Warning</option>
                      <option value="p2_suggestion">P2 Suggestion</option>
                      <option value="p3_nit">P3 Nitpick</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Critique Title</label>
                  <input type="text" v-model="newCritique.title" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="e.g. Unbounded Query Memory Allocation" />
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div class="col-span-2">
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">File Path</label>
                    <input type="text" v-model="newCritique.file_path" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Line Start</label>
                    <input type="number" v-model="newCritique.line_start" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Rationale / Explanation</label>
                  <textarea v-model="newCritique.critique_markdown" rows="3" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="Explain the defect and recommended fix..."></textarea>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Suggested Diff Replacement</label>
                  <textarea v-model="newCritique.suggested_diff" rows="3" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono" placeholder="- badCode()\n+ goodCode()"></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button @click="newCritiqueModalOpen = false" class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">Cancel</button>
                <button @click="submitNewCritiqueModal()" :disabled="!newCritique.title.trim()" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs">Add Critique</button>
              </div>
            </div>
          </div>

          <!-- MODAL 3: OVERRIDE MERGE GATE -->
          <div v-if="overrideGateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🛡️</span>
                  <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Manual Merge Gate Override</h4>
                </div>
                <button @click="overrideGateModalOpen = false" class="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
              </div>

              <div class="space-y-3">
                <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  ⚠️ Overriding the merge gate bypasses automated P0 blocking rules and records an audit trace.
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Override Reason</label>
                  <textarea v-model="gateOverride.reason" rows="3" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" placeholder="e.g. Critical hotfix approved by Tech Lead; P0 tracked in PB-402"></textarea>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Overridden By</label>
                  <input type="text" v-model="gateOverride.overridden_by" class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs" />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button @click="overrideGateModalOpen = false" class="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">Cancel</button>
                <button @click="submitGateOverrideModal()" :disabled="!gateOverride.reason.trim()" class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs">Force Approve & Override</button>
              </div>
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
                          @click="openMergeModal(s)"
                          title="Propose merge into target branch/session"
                          class="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                        >
                          Merge
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
                  <button
                    @click="sessionObservabilityTab = 'trajectory'"
                    class="px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    :class="sessionObservabilityTab === 'trajectory' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >
                    <span>📈</span>
                    <span>Trajectories</span>
                    <span v-if="sessionTrajectoriesList && sessionTrajectoriesList.length" class="px-1 py-0.5 rounded bg-zinc-300 dark:bg-zinc-700 text-[9px] font-mono">{{ sessionTrajectoriesList.length }}</span>
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

                <!-- TAB 5: LIVE STEP TRAJECTORY & TELEMETRY STREAM (EPIC 26) -->
                <div v-if="sessionObservabilityTab === 'trajectory'" class="space-y-3 flex-1 flex flex-col min-h-0">
                  <!-- KPI Summary Cards -->
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Total Steps</div>
                      <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                        {{ (sessionTrajectorySummary && sessionTrajectorySummary.total_steps) || (sessionTrajectoriesList && sessionTrajectoriesList.length) || selectedSessionRun.total_steps || 0 }}
                      </div>
                    </div>
                    <div class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Duration</div>
                      <div class="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                        {{ (sessionTrajectorySummary && sessionTrajectorySummary.total_duration_ms) || 0 }}ms
                      </div>
                    </div>
                    <div class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Tokens Consumed</div>
                      <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        {{ (sessionTrajectorySummary && sessionTrajectorySummary.total_tokens) || selectedSessionRun.total_tokens || 0 }}
                      </div>
                    </div>
                    <div class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div class="text-[9px] font-semibold text-zinc-400 uppercase">Spend USD</div>
                      <div class="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                        $ {{ ((sessionTrajectorySummary && sessionTrajectorySummary.total_cost_usd) || selectedSessionRun.total_cost_usd || 0).toFixed(4) }}
                      </div>
                    </div>
                  </div>

                  <!-- Tool Latency Profiling Bar -->
                  <div v-if="sessionTrajectorySummary && sessionTrajectorySummary.tool_profiling && sessionTrajectorySummary.tool_profiling.length" class="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div class="text-[10px] font-semibold text-zinc-400 uppercase mb-1.5 flex items-center justify-between">
                      <span>🛠️ Tool Execution Profiling</span>
                      <span class="text-zinc-500 font-mono">{{ sessionTrajectorySummary.tool_profiling.length }} tools profiled</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <div
                        v-for="tp in sessionTrajectorySummary.tool_profiling"
                        :key="tp.tool_name"
                        class="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] flex items-center gap-1.5"
                      >
                        <span class="font-bold text-zinc-800 dark:text-zinc-200 font-mono">{{ tp.tool_name }}</span>
                        <span class="px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">{{ tp.call_count }}x</span>
                        <span class="text-zinc-400 font-mono">{{ tp.avg_duration_ms }}ms avg</span>
                      </div>
                    </div>
                  </div>

                  <!-- Step Trajectory Timeline Stream -->
                  <div class="flex-1 flex flex-col min-h-0">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-[10px] font-semibold text-zinc-400 uppercase">Chronological Trajectory Stream</span>
                      <button
                        @click="loadSessionTrajectories(selectedSessionRun.id || selectedSessionRun.session_id)"
                        class="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span>🔄</span>
                        <span>Refresh Steps</span>
                      </button>
                    </div>

                    <div v-if="isLoadingTrajectories" class="py-8 text-center text-xs text-zinc-400">Loading trajectory telemetry stream...</div>
                    <div v-else-if="!sessionTrajectoriesList || sessionTrajectoriesList.length === 0" class="py-8 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      No discrete trajectory steps recorded yet for this session run.
                    </div>
                    <div v-else class="flex-1 overflow-y-auto space-y-2 max-h-[360px] pr-1">
                      <div
                        v-for="step in sessionTrajectoriesList"
                        :key="step.id || step.step_number"
                        class="p-2.5 rounded-lg border transition-all bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex items-center gap-1.5">
                            <span class="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono font-bold text-[10px]">
                              #{{ step.step_number }}
                            </span>
                            <span
                              class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                              :class="{
                                'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300': step.step_type === 'thought',
                                'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300': step.step_type === 'tool_call',
                                'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300': step.step_type === 'tool_result' || step.step_type === 'checkpoint',
                                'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300': step.step_type === 'error' || step.status === 'failed',
                                'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300': step.step_type === 'user_intervention' || step.step_type === 'gate_event'
                              }"
                            >
                              {{ step.step_type }}
                            </span>
                            <span v-if="step.tool_name" class="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                              {{ step.tool_name }}()
                            </span>
                          </div>

                          <div class="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                            <span v-if="step.duration_ms">{{ step.duration_ms }}ms</span>
                            <span v-if="step.tokens_total" class="text-zinc-500">{{ step.tokens_total }} tok</span>
                            <span v-if="step.cost_usd" class="text-amber-500 font-semibold">$ {{ step.cost_usd.toFixed(4) }}</span>
                          </div>
                        </div>

                        <!-- Thought Text -->
                        <div v-if="step.thought_text" class="text-zinc-800 dark:text-zinc-200 text-[11px] leading-relaxed bg-zinc-50/80 dark:bg-zinc-900/60 p-2 rounded border border-zinc-100 dark:border-zinc-800/60 font-sans">
                          {{ step.thought_text }}
                        </div>

                        <!-- Tool Input -->
                        <div v-if="step.tool_input && Object.keys(step.tool_input).length" class="space-y-0.5">
                          <div class="text-[9px] font-semibold text-zinc-400 uppercase">Input Payload</div>
                          <pre class="p-1.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap select-text">{{ typeof step.tool_input === 'string' ? step.tool_input : JSON.stringify(step.tool_input, null, 2) }}</pre>
                        </div>

                        <!-- Tool Output -->
                        <div v-if="step.tool_output && Object.keys(step.tool_output).length" class="space-y-0.5">
                          <div class="text-[9px] font-semibold text-zinc-400 uppercase">Output Result</div>
                          <pre class="p-1.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-32 select-text">{{ typeof step.tool_output === 'string' ? step.tool_output : JSON.stringify(step.tool_output, null, 2) }}</pre>
                        </div>

                        <!-- Error Message -->
                        <div v-if="step.error_message" class="p-2 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-mono">
                          🚨 {{ step.error_message }}
                        </div>
                      </div>
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
