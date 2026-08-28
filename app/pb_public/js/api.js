// pb_public/js/api.js
// PocketBase client & real-time sync service for ProjectBase

const pb = new PocketBase(window.location.origin);
// Disable auto-cancellation to allow rapid concurrent UI actions
pb.autoCancellation(false);

const API = {
  client: pb,
  subscribers: new Set(),

  // Real-time SSE subscription
  initRealtime(onEvent) {
    if (onEvent) this.subscribers.add(onEvent);

    pb.collection('issues').subscribe('*', (e) => {
      this.notifySubscribers('issues', e);
    }).catch(err => console.warn('Issues subscription error:', err));

    pb.collection('projects').subscribe('*', (e) => {
      this.notifySubscribers('projects', e);
    }).catch(err => console.warn('Projects subscription error:', err));

    pb.collection('cycles').subscribe('*', (e) => {
      this.notifySubscribers('cycles', e);
    }).catch(err => console.warn('Cycles subscription error:', err));

    pb.collection('milestones').subscribe('*', (e) => {
      this.notifySubscribers('milestones', e);
    }).catch(err => console.warn('Milestones subscription error:', err));

    pb.collection('comments').subscribe('*', (e) => {
      this.notifySubscribers('comments', e);
    }).catch(err => console.warn('Comments subscription error:', err));

    pb.collection('notifications').subscribe('*', (e) => {
      this.notifySubscribers('notifications', e);
    }).catch(err => console.warn('Notifications subscription error:', err));
  },

  unsubscribeAll() {
    this.subscribers.clear();
    try { pb.collection('issues').unsubscribe('*'); } catch (e) {}
    try { pb.collection('projects').unsubscribe('*'); } catch (e) {}
    try { pb.collection('cycles').unsubscribe('*'); } catch (e) {}
    try { pb.collection('milestones').unsubscribe('*'); } catch (e) {}
    try { pb.collection('comments').unsubscribe('*'); } catch (e) {}
    try { pb.collection('notifications').unsubscribe('*'); } catch (e) {}
  },

  notifySubscribers(collection, event) {
    for (const sub of this.subscribers) {
      try {
        sub(collection, event);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    }
  },

  // Projects
  async getProjects() {
    return await pb.collection('projects').getFullList({
      sort: '-is_favorite,-created'
    });
  },

  async createProject(data) {
    return await pb.collection('projects').create(data);
  },

  async updateProject(id, data) {
    return await pb.collection('projects').update(id, data);
  },

  async deleteProject(id) {
    return await pb.collection('projects').delete(id);
  },

  // Custom fields (per-project field definitions)
  async getCustomFields(projectId) {
    return await pb.send('/api/projectbase/projects/' + projectId + '/custom-fields', {
      method: 'GET'
    });
  },

  async saveCustomFields(projectId, fields) {
    return await pb.send('/api/projectbase/projects/' + projectId + '/custom-fields', {
      method: 'PUT',
      body: { fields: fields }
    });
  },

  // Agentic-native: local AI agents surfaced as board teammates (bridge).
  async getAgents() {
    if (!pb.authStore.isValid) return { agents: [], sessions: [] };
    const res = await pb.send('/api/projectbase/agents', { method: 'GET' });
    return res;
  },
  async syncAgents() {
    const res = await pb.send('/api/projectbase/agents/sync', { method: 'POST' });
    return res;
  },

  // Issues
  async getIssues(projectId = null) {
    const filter = projectId ? `project = "${projectId}"` : '1=1';
    return await pb.collection('issues').getFullList({
      filter,
      sort: 'order,-created',
      expand: 'project,cycle,milestone'
    });
  },

  async createIssue(data) {
    return await pb.collection('issues').create(data, {
      expand: 'project,cycle,milestone'
    });
  },

  async updateIssue(id, data) {
    return await pb.collection('issues').update(id, data, {
      expand: 'project,cycle,milestone'
    });
  },

  async deleteIssue(id) {
    return await pb.collection('issues').delete(id);
  },

  // Global cross-project search (Cmd+K omnibox). Searches issue title,
  // identifier, status, and priority across every project the user can see.
  async searchIssues(query, limit = 20) {
    const q = encodeURIComponent((query || '').trim());
    if (!q) return { query: '', count: 0, results: [] };
    const res = await fetch(`/api/projectbase/search?q=${q}&limit=${limit}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Search failed');
    return data;
  },

  // Bulk actions (board/list multi-select) — one request per action
  async bulkUpdateIssues(ids, data) {
    return await pb.send('/api/projectbase/issues/bulk-update', {
      method: 'POST',
      body: { ids: ids, data: data }
    });
  },

  async bulkDeleteIssues(ids) {
    return await pb.send('/api/projectbase/issues/bulk-delete', {
      method: 'POST',
      body: { ids: ids }
    });
  },

  // Issue relationships (blocks / blocked_by / related)
  _authHeaders(extra = {}) {
    const headers = { ...extra };
    if (pb.authStore.token) headers['Authorization'] = pb.authStore.token;
    return headers;
  },

  async getIssueRelations(issueId) {
    const res = await fetch(`/api/projectbase/issues/${issueId}/relations`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load relations');
    return data;
  },

  async addIssueRelation(issueId, targetId, type) {
    const res = await fetch(`/api/projectbase/issues/${issueId}/relations`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ issue: targetId, type })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to add relation');
    return data;
  },

  async removeIssueRelation(issueId, targetId, type) {
    const res = await fetch(`/api/projectbase/issues/${issueId}/relations`, {
      method: 'DELETE',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ issue: targetId, type })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to remove relation');
    return data;
  },

  // Cycles (Sprints)
  async getCycles(projectId = null) {
    const filter = projectId ? `project = "${projectId}"` : '1=1';
    return await pb.collection('cycles').getFullList({
      filter,
      sort: '-status,start_date'
    });
  },

  async createCycle(data) {
    return await pb.collection('cycles').create(data);
  },

  async updateCycle(id, data) {
    return await pb.collection('cycles').update(id, data);
  },

  async deleteCycle(id) {
    return await pb.collection('cycles').delete(id);
  },

  // Milestones
  async getMilestones(projectId = null) {
    const filter = projectId ? `project = "${projectId}"` : '1=1';
    return await pb.collection('milestones').getFullList({
      filter,
      sort: '-status,target_date',
      expand: 'project'
    });
  },

  async createMilestone(data) {
    return await pb.collection('milestones').create(data);
  },

  async updateMilestone(id, data) {
    return await pb.collection('milestones').update(id, data);
  },

  async deleteMilestone(id) {
    return await pb.collection('milestones').delete(id);
  },

  // Labels
  async getLabels(projectId = null) {
    const filter = projectId ? `project = "" || project = "${projectId}"` : '1=1';
    return await pb.collection('labels').getFullList({
      filter,
      sort: 'name'
    });
  },

  async createLabel(data) {
    return await pb.collection('labels').create(data);
  },

  // Comments
  async getComments(issueId) {
    return await pb.collection('comments').getFullList({
      filter: `issue = "${issueId}"`,
      sort: 'created'
    });
  },

  async createComment(data) {
    return await pb.collection('comments').create(data);
  },

  async deleteComment(id) {
    return await pb.collection('comments').delete(id);
  },

  // Activity / Audit
  async getActivity(projectId = null) {
    const filter = projectId ? `project = "${projectId}"` : '1=1';
    return await pb.collection('activity').getList(1, 30, {
      filter,
      sort: '-created',
      expand: 'project,issue'
    });
  },

  // In-app notifications (inbox bell)
  async getNotifications() {
    const userId = pb.authStore.model && pb.authStore.model.id;
    if (!userId) return { items: [] };
    return await pb.collection('notifications').getList(1, 50, {
      filter: `recipient = "${userId}"`,
      sort: '-created',
      expand: 'issue,issue.project,comment'
    });
  },

  async markNotificationRead(id) {
    return await pb.collection('notifications').update(id, { read: true });
  },

  async markAllNotificationsRead() {
    return await pb.send('/api/projectbase/notifications/read-all', {
      method: 'POST'
    });
  },

  // Notification channel settings (self-hosted, admin-gated)
  async getNotificationSettings() {
    const res = await fetch('/api/projectbase/notification-settings', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load notification settings');
    return data;
  },

  async updateNotificationSettings(payload) {
    const res = await fetch('/api/projectbase/notification-settings', {
      method: 'PUT',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save notification settings');
    return data;
  },

  // Agents & Autonomous Dispatch
  async getAgents() {
    const res = await fetch('/api/projectbase/agents', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load agents');
    return data;
  },

  async dispatchAgent(target, payload = {}) {
    const res = await fetch('/api/projectbase/dispatch-agent', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ target, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Agent dispatch failed');
    return data;
  },

  // Stats
  async getStats() {
    try {
      const res = await fetch('/api/projectbase/stats');
      if (!res.ok) throw new Error('Stats failed');
      return await res.json();
    } catch (err) {
      return null;
    }
  },

  // Workspace Synthesis & Knowledge Retrieval (Epic 11)
  async searchWorkspace(query, options = {}) {
    const params = new URLSearchParams({ q: query || '' });
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.limit) params.set('limit', options.limit);
    if (options.types) params.set('types', Array.isArray(options.types) ? options.types.join(',') : options.types);
    const res = await fetch(`/api/projectbase/workspace/search?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Workspace search failed');
    return data;
  },

  async getWorkspaceBlockers(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.includeCrossProject !== undefined) params.set('include_cross_project', options.includeCrossProject);
    const res = await fetch(`/api/projectbase/workspace/blockers?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Blocker analysis failed');
    return data;
  },

  async getWorkspaceRetrospective(options = {}) {
    const params = new URLSearchParams();
    if (options.cycleId) params.set('cycle_id', options.cycleId);
    if (options.projectId) params.set('project_id', options.projectId);
    const res = await fetch(`/api/projectbase/workspace/retrospective?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Retrospective generation failed');
    return data;
  },

  // Federation & Analytics (Epic 12)
  async exportFederation(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    const res = await fetch(`/api/projectbase/federation/export?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Federation export failed');
    return data;
  },

  async importFederation(bundle, options = {}) {
    const res = await fetch('/api/projectbase/federation/import', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        bundle: bundle,
        conflict_strategy: options.conflictStrategy || 'merge',
        target_project_id: options.targetProjectId || null
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Federation import failed');
    return data;
  },

  async getAnomalies(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.autoHeal) params.set('auto_heal', 'true');
    const res = await fetch(`/api/projectbase/analytics/anomalies?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Anomaly scan failed');
    return data;
  },

  async getThroughputAnalytics(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.windowHours) params.set('time_window_hours', options.windowHours);
    const res = await fetch(`/api/projectbase/analytics/throughput?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Throughput analytics failed');
    return data;
  },

  async getGitArtifacts(options = {}) {
    const params = new URLSearchParams();
    if (options.issueId) params.set('issue_id', options.issueId);
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.type) params.set('type', options.type);
    const res = await fetch(`/api/projectbase/git/artifacts?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch git artifacts');
    return data;
  },

  async linkGitArtifact(payload) {
    const res = await fetch('/api/projectbase/git/artifacts', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to link git artifact');
    return data;
  },

  async stageCodePatch(payload) {
    const res = await fetch('/api/projectbase/git/patch', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to stage code patch');
    return data;
  },

  async getGitPatch(patchId) {
    const res = await fetch(`/api/projectbase/git/patch/${patchId}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch patch');
    return data;
  },

  async getGitStatus(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    const res = await fetch(`/api/projectbase/git/status?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch git status');
    return data;
  },

  async getAgentWorkload(projectId = '') {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    const res = await fetch(`/api/projectbase/agents/workload?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch agent workload');
    return data;
  },

  async calculateAutoscale(payload = {}) {
    const res = await fetch('/api/projectbase/agents/autoscale', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to calculate autoscale');
    return data;
  },

  async reserveAgentCapacity(payload) {
    const res = await fetch('/api/projectbase/agents/capacity/reserve', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reserve agent capacity');
    return data;
  },

  async releaseAgentCapacity(payload) {
    const res = await fetch('/api/projectbase/agents/capacity/release', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to release agent capacity');
    return data;
  },

  async runWorkflowSelfHeal(payload = {}) {
    const res = await fetch('/api/projectbase/workflow/self-heal', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to execute self heal');
    return data;
  },

  async getLiveBenchmarks(iterations = 10) {
    const res = await fetch('/api/projectbase/benchmarks/live', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch benchmarks');
    return data;
  },

  async getClusterNodes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    const res = await fetch(`/api/projectbase/cluster/nodes?${params.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch cluster nodes');
    return data;
  },

  async registerClusterNode(payload) {
    const res = await fetch('/api/projectbase/cluster/nodes/register', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to register cluster node');
    return data;
  },

  async sendClusterHeartbeat(payload) {
    const res = await fetch('/api/projectbase/cluster/nodes/heartbeat', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to send heartbeat');
    return data;
  },

  async decommissionClusterNode(nodeId) {
    const res = await fetch(`/api/projectbase/cluster/nodes/${encodeURIComponent(nodeId)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to decommission cluster node');
    return data;
  },

  async pullClusterDeltas(params = {}) {
    const q = new URLSearchParams();
    if (params.since_seq) q.set('since_seq', params.since_seq);
    if (params.limit) q.set('limit', params.limit);
    if (params.collection) q.set('collection', params.collection);
    const res = await fetch(`/api/projectbase/cluster/sync/pull?${q.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to pull cluster deltas');
    return data;
  },

  async pushClusterDeltas(payload) {
    const res = await fetch('/api/projectbase/cluster/sync/push', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to push cluster deltas');
    return data;
  },

  async createClusterSnapshot(payload = {}) {
    const res = await fetch('/api/projectbase/cluster/sync/snapshot', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create cluster snapshot');
    return data;
  },

  async getClusterFailoverStatus() {
    const res = await fetch('/api/projectbase/cluster/failover/status', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch cluster failover status');
    return data;
  },

  async promoteClusterPrimary(payload) {
    const res = await fetch('/api/projectbase/cluster/failover/promote', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to promote cluster primary');
    return data;
  },

  async verifyClusterFencing(payload) {
    const res = await fetch('/api/projectbase/cluster/failover/fencing', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to verify cluster fencing');
    return data;
  },

  async reconcileEdgeSync(payload) {
    const res = await fetch('/api/projectbase/cluster/edge/reconcile', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reconcile edge sync');
    return data;
  },

  async listWebhookEndpoints() {
    const res = await fetch('/api/projectbase/webhooks/endpoints', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch webhook endpoints');
    return data;
  },

  async registerWebhookEndpoint(payload) {
    const res = await fetch('/api/projectbase/webhooks/endpoints', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to register webhook endpoint');
    return data;
  },

  async deleteWebhookEndpoint(id) {
    const res = await fetch(`/api/projectbase/webhooks/endpoints/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete webhook endpoint');
    return data;
  },

  async dispatchWebhookEvent(payload) {
    const res = await fetch('/api/projectbase/webhooks/dispatch', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch webhook event');
    return data;
  },

  async verifyWebhookSignature(payload) {
    const res = await fetch('/api/projectbase/webhooks/verify', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to verify webhook signature');
    return data;
  },

  async listWebhookDeliveries(params = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.endpoint_id) q.set('endpoint_id', params.endpoint_id);
    if (params.event) q.set('event', params.event);
    if (params.limit) q.set('limit', params.limit);
    const res = await fetch(`/api/projectbase/webhooks/deliveries?${q.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch webhook deliveries');
    return data;
  },

  async getWebhookDlq() {
    const res = await fetch('/api/projectbase/webhooks/dlq', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch webhook DLQ');
    return data;
  },

  async retryDlqMessage(payload = {}) {
    const res = await fetch('/api/projectbase/webhooks/dlq/retry', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to retry DLQ messages');
    return data;
  },

  async purgeDlqMessage(id = 'all') {
    const res = await fetch(`/api/projectbase/webhooks/dlq/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to purge DLQ message');
    return data;
  },

  async previewWebhookTransform(params = {}) {
    const q = new URLSearchParams();
    if (params.platform) q.set('platform', params.platform);
    if (params.event) q.set('event', params.event);
    if (params.title) q.set('title', params.title);
    if (params.description) q.set('description', params.description);
    const res = await fetch(`/api/projectbase/webhooks/transforms/preview?${q.toString()}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to preview webhook transform');
    return data;
  },

  async generateSdk(payload) {
    const res = await fetch('/api/projectbase/sdk/generate', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to generate SDK code');
    return data;
  },

  async getSdkLanguages() {
    const res = await fetch('/api/projectbase/sdk/languages', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch SDK languages');
    return data;
  },

  async getSdkTemplate(lang) {
    const res = await fetch(`/api/projectbase/sdk/templates/${encodeURIComponent(lang)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch SDK template');
    return data;
  },

  async getObservabilityMetrics() {
    const res = await fetch('/api/projectbase/observability/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch observability metrics');
    return data;
  },

  async getObservabilityAlerts() {
    const res = await fetch('/api/projectbase/observability/alerts', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch observability alerts');
    return data;
  },

  async configureObservabilityAlert(payload) {
    const res = await fetch('/api/projectbase/observability/alerts/configure', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to configure alert rule');
    return data;
  },

  async evaluateObservabilityAlerts() {
    const res = await fetch('/api/projectbase/observability/alerts/evaluate', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to evaluate alert rules');
    return data;
  },

  async deleteObservabilityAlert(id) {
    const res = await fetch(`/api/projectbase/observability/alerts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete alert rule');
    return data;
  },

  async getIntegrationRecipes() {
    const res = await fetch('/api/projectbase/docs/recipes', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch integration recipes');
    return data;
  },

  async getUnifiedSpec() {
    const res = await fetch('/api/projectbase/docs/spec', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch API spec');
    return data;
  },

  async getConsensusGates(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/consensus/gates${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch consensus gates');
    return data;
  },

  async getConsensusGate(id) {
    const res = await fetch(`/api/projectbase/consensus/gates/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch consensus gate details');
    return data;
  },

  async createConsensusGate(payload) {
    const res = await fetch('/api/projectbase/consensus/gates', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create consensus gate');
    return data;
  },

  async deleteConsensusGate(id) {
    const res = await fetch(`/api/projectbase/consensus/gates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete consensus gate');
    return data;
  },

  async submitConsensusBallot(payload) {
    const res = await fetch('/api/projectbase/consensus/ballots/submit', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to submit consensus ballot');
    return data;
  },

  async evaluateConsensusGate(payload) {
    const res = await fetch('/api/projectbase/consensus/gates/evaluate', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to evaluate consensus gate');
    return data;
  },

  async startConsensusDebate(payload) {
    const res = await fetch('/api/projectbase/consensus/debate/start', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to start consensus debate');
    return data;
  },

  async getConsensusMetrics() {
    const res = await fetch('/api/projectbase/consensus/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch consensus metrics');
    return data;
  },

  async getSsoProviders() {
    const res = await fetch('/api/projectbase/sso/providers', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch SSO providers');
    return data;
  },

  async configureSsoProvider(payload) {
    const res = await fetch('/api/projectbase/sso/providers', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to configure SSO provider');
    return data;
  },

  async deleteSsoProvider(id) {
    const res = await fetch(`/api/projectbase/sso/providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete SSO provider');
    return data;
  },

  async getSsoDiscovery(id) {
    const res = await fetch(`/api/projectbase/sso/providers/${encodeURIComponent(id)}/discovery`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch SSO discovery');
    return data;
  },

  async exchangeSsoToken(payload) {
    const res = await fetch('/api/projectbase/sso/auth/exchange', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to exchange SSO token');
    return data;
  },

  async getRbacRoles() {
    const res = await fetch('/api/projectbase/rbac/roles', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch RBAC roles');
    return data;
  },

  async createRbacRole(payload) {
    const res = await fetch('/api/projectbase/rbac/roles', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save RBAC role');
    return data;
  },

  async deleteRbacRole(id) {
    const res = await fetch(`/api/projectbase/rbac/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete RBAC role');
    return data;
  },

  async getRbacMatrix() {
    const res = await fetch('/api/projectbase/rbac/matrix', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch RBAC matrix');
    return data;
  },

  async checkRbacPermission(payload) {
    const res = await fetch('/api/projectbase/rbac/check', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to check RBAC permission');
    return data;
  },

  async getRbacAssignments() {
    const res = await fetch('/api/projectbase/rbac/assignments', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch RBAC assignments');
    return data;
  },

  async assignRbacRole(payload) {
    const res = await fetch('/api/projectbase/rbac/assign', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to assign RBAC role');
    return data;
  },

  async revokeRbacAssignment(id) {
    const res = await fetch(`/api/projectbase/rbac/assignments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to revoke RBAC assignment');
    return data;
  },

  async createScopedToken(payload) {
    const res = await fetch('/api/projectbase/rbac/tokens/create', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create scoped token');
    return data;
  },

  async getScopedTokens() {
    const res = await fetch('/api/projectbase/rbac/tokens', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch scoped tokens');
    return data;
  },

  async revokeScopedToken(id) {
    const res = await fetch('/api/projectbase/rbac/tokens/revoke', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token_id: id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to revoke scoped token');
    return data;
  },

  async getSecurityAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/rbac/audit-logs${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch security audit logs');
    return data;
  },

  async exportSecurityAuditLogs(payload = {}) {
    const res = await fetch('/api/projectbase/rbac/audit-logs/export', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to export audit logs');
    return data;
  },

  async getAutomationRules(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/automations/rules${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch automation rules');
    return data;
  },

  async createAutomationRule(payload) {
    const res = await fetch('/api/projectbase/automations/rules', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save automation rule');
    return data;
  },

  async deleteAutomationRule(id) {
    const res = await fetch(`/api/projectbase/automations/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete automation rule');
    return data;
  },

  async toggleAutomationRule(id) {
    const res = await fetch(`/api/projectbase/automations/rules/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to toggle automation rule');
    return data;
  },

  async testAutomationRule(id, payload = {}) {
    const res = await fetch(`/api/projectbase/automations/rules/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to test automation rule');
    return data;
  },

  async getAutomationRuns(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/automations/runs${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch automation runs');
    return data;
  },

  async getAutomationRunDetails(id) {
    const res = await fetch(`/api/projectbase/automations/runs/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch automation run details');
    return data;
  },

  async cancelAutomationRun(id) {
    const res = await fetch(`/api/projectbase/automations/runs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to cancel automation run');
    return data;
  },

  async retryAutomationRun(id) {
    const res = await fetch(`/api/projectbase/automations/runs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to retry automation run');
    return data;
  },

  async triggerAutomation(payload) {
    const res = await fetch('/api/projectbase/automations/trigger', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to trigger automation');
    return data;
  },

  async getAutomationMetrics() {
    const res = await fetch('/api/projectbase/automations/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch automation metrics');
    return data;
  },

  async getAutomationTemplates() {
    const res = await fetch('/api/projectbase/automations/templates', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch automation templates');
    return data;
  },

  // Multi-Tenant Isolation & Resource Quotas (Epic 21)
  async getTenants() {
    const res = await fetch('/api/projectbase/tenants', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenants');
    return data;
  },

  async createTenant(payload) {
    const res = await fetch('/api/projectbase/tenants', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create tenant');
    return data;
  },

  async getTenantDetails(id) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant details');
    return data;
  },

  async updateTenant(id, payload) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update tenant');
    return data;
  },

  async deleteTenant(id) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete tenant');
    return data;
  },

  async getTenantQuotas(id) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/quotas`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant quotas');
    return data;
  },

  async updateTenantQuotas(id, payload) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/quotas`, {
      method: 'PUT',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update tenant quotas');
    return data;
  },

  async getTenantUsage(id) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/usage`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant usage');
    return data;
  },

  async checkTenantQuota(id, payload) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/check-quota`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to check tenant quota');
    return data;
  },

  async switchTenantContext(id, payload = {}) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/switch`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to switch tenant context');
    return data;
  },

  async getTenantMetrics() {
    const res = await fetch('/api/projectbase/tenants/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant metrics');
    return data;
  },

  async getTenantMembers(id) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/members`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant members');
    return data;
  },

  async addTenantMember(id, payload) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/members`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to add tenant member');
    return data;
  },

  async deleteTenantMember(id, userId) {
    const res = await fetch(`/api/projectbase/tenants/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete tenant member');
    return data;
  },

  async getAutoHealPolicies(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/auto-heal/policies${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch auto-heal policies');
    return data;
  },

  async createAutoHealPolicy(payload) {
    const res = await fetch('/api/projectbase/auto-heal/policies', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create auto-heal policy');
    return data;
  },

  async updateAutoHealPolicy(id, payload) {
    const res = await fetch(`/api/projectbase/auto-heal/policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update auto-heal policy');
    return data;
  },

  async deleteAutoHealPolicy(id) {
    const res = await fetch(`/api/projectbase/auto-heal/policies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete auto-heal policy');
    return data;
  },

  async getAutoHealIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/auto-heal/incidents${query ? '?' + query : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch auto-heal incidents');
    return data;
  },

  async reportAutoHealIncident(payload) {
    const res = await fetch('/api/projectbase/auto-heal/incidents', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to report auto-heal incident');
    return data;
  },

  async getAutoHealIncidentDetails(id) {
    const res = await fetch(`/api/projectbase/auto-heal/incidents/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch incident details');
    return data;
  },

  async resolveAutoHealIncident(id, payload = {}) {
    const res = await fetch(`/api/projectbase/auto-heal/incidents/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to resolve auto-heal incident');
    return data;
  },

  async escalateAutoHealIncident(id, payload = {}) {
    const res = await fetch(`/api/projectbase/auto-heal/incidents/${encodeURIComponent(id)}/escalate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to escalate auto-heal incident');
    return data;
  },

  async getAutoHealHealthChecks() {
    const res = await fetch('/api/projectbase/auto-heal/health-checks', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch health checks');
    return data;
  },

  async triggerAutoHeal(payload) {
    const res = await fetch('/api/projectbase/auto-heal/trigger', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to trigger auto-healing');
    return data;
  },

  async runCrashRecoverySweep() {
    const res = await fetch('/api/projectbase/auto-heal/crash-recovery', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to run crash recovery sweep');
    return data;
  },

  async getAutoHealRecipes() {
    const res = await fetch('/api/projectbase/auto-heal/recipes', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch auto-heal recipes');
    return data;
  },

  async applyAutoHealRecipe(id) {
    const res = await fetch(`/api/projectbase/auto-heal/recipes/${encodeURIComponent(id)}/apply`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to apply auto-heal recipe');
    return data;
  },

  async getAutoHealMetrics() {
    const res = await fetch('/api/projectbase/auto-heal/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch auto-heal metrics');
    return data;
  },

  // Execution-Native Agent Sessions & Process Lifecycle Engine (Milestone 1 & 2)
  async getAgentSessions(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/sessions${q ? '?' + q : ''}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch agent sessions');
    return data;
  },

  async ingestAgentSession(payload) {
    const res = await fetch('/api/projectbase/sessions/ingest', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to ingest agent session');
    return data;
  },

  async sendAgentSessionHeartbeat(payload) {
    const res = await fetch('/api/projectbase/sessions/heartbeat', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to send session heartbeat');
    return data;
  },

  async completeAgentSession(payload) {
    const res = await fetch('/api/projectbase/sessions/complete', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to complete agent session');
    return data;
  },

  async getLiveAgentSessions() {
    const res = await fetch('/api/projectbase/sessions/live', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch live agent sessions');
    return data;
  },

  async getAgentSessionMetrics() {
    const res = await fetch('/api/projectbase/sessions/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session metrics');
    return data;
  },

  async getAgentSessionDetails(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session details');
    return data;
  },

  async updateAgentSession(id, payload) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update agent session');
    return data;
  },

  async deleteAgentSession(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete agent session');
    return data;
  },

  async terminateAgentSession(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/terminate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to terminate agent session');
    return data;
  },

  async forkAgentSession(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/fork`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fork agent session');
    return data;
  },

  async dockAgentSession(id, issueId) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/dock`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ issue_id: issueId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to dock agent session');
    return data;
  },

  async cleanAgentSessions(olderThanDays = 30) {
    const res = await fetch('/api/projectbase/sessions/clean', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ older_than_days: olderThanDays })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to clean agent sessions');
    return data;
  },

  // Deep Observability & Ground Truth Verification Hub (Milestone 3)
  async getSessionDiff(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/diff`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session git diff');
    return data;
  },

  async recordSessionDiff(id, diffPayload) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/diff`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(diffPayload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to record session git diff');
    return data;
  },

  async getSessionVerdict(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/verdict`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session test verdict');
    return data;
  },

  async recordSessionVerdict(id, verdictPayload) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/verdict`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(verdictPayload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to record session test verdict');
    return data;
  },

  async getSessionAudit(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/audit`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session sceptic audit');
    return data;
  },

  async submitSessionAudit(id, auditPayload) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/audit`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(auditPayload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to submit session sceptic audit');
    return data;
  },

  async getObservabilitySummary() {
    const res = await fetch('/api/projectbase/observability/summary', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch observability summary');
    return data;
  },

  async verifySessionSuite(payload) {
    const res = await fetch('/api/projectbase/observability/verify-suite', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to run verification suite');
    return data;
  },

  // One-Click Session Branching, Re-Tasking & Human Intervention Gate (Milestone 4 / Epic 25)
  async branchAgentSession(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/branch`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to branch agent session');
    return data;
  },

  async getSessionDag(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/dag`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session DAG');
    return data;
  },

  async getAllSessionsDag(projectId = '') {
    const qs = projectId ? `?project=${encodeURIComponent(projectId)}` : '';
    const res = await fetch(`/api/projectbase/sessions/dag${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session DAGs');
    return data;
  },

  async pauseAgentSession(id, reason = '') {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to pause session');
    return data;
  },

  async resumeAgentSession(id, reason = '') {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to resume session');
    return data;
  },

  async injectSessionInstruction(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/inject`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to inject session instruction');
    return data;
  },

  async getSessionInterventions(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/interventions`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session interventions');
    return data;
  },

  async setSessionInterventionGate(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/gate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to set session intervention gate');
    return data;
  },

  async arbitrateSessionConflicts(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/arbitrate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to arbitrate session conflicts');
    return data;
  },

  async getSessionConflicts(projectId = '') {
    const qs = projectId ? `?project=${encodeURIComponent(projectId)}` : '';
    const res = await fetch(`/api/projectbase/sessions/conflicts${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session conflicts');
    return data;
  },

  async dispatchSessionSwarm(payload = {}) {
    const res = await fetch('/api/projectbase/sessions/swarm/dispatch', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch session swarm');
    return data;
  },

  async recordSessionTrajectory(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/trajectories`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to record session trajectory');
    return data;
  },

  async getSessionTrajectories(id, params = {}) {
    const qp = new URLSearchParams();
    if (params.step_type) qp.append('step_type', params.step_type);
    if (params.tool_name) qp.append('tool_name', params.tool_name);
    if (params.status) qp.append('status', params.status);
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/trajectories${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session trajectories');
    return data;
  },

  async getSessionTrajectorySummary(id) {
    const res = await fetch(`/api/projectbase/sessions/${encodeURIComponent(id)}/trajectories/summary`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch trajectory summary');
    return data;
  },

  async createSwarmCluster(payload = {}) {
    const res = await fetch('/api/projectbase/swarm/clusters', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create swarm cluster');
    return data;
  },

  async listSwarmClusters(params = {}) {
    const qp = new URLSearchParams();
    if (params.status) qp.append('status', params.status);
    if (params.project) qp.append('project', params.project);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/swarm/clusters${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list swarm clusters');
    return data;
  },

  async getSwarmCluster(id) {
    const res = await fetch(`/api/projectbase/swarm/clusters/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch swarm cluster');
    return data;
  },

  async addSwarmClusterWorkers(id, payload = {}) {
    const res = await fetch(`/api/projectbase/swarm/clusters/${encodeURIComponent(id)}/workers`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to add swarm cluster workers');
    return data;
  },

  async updateSwarmClusterStatus(id, payload = {}) {
    const res = await fetch(`/api/projectbase/swarm/clusters/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update swarm cluster status');
    return data;
  },

  async getSwarmClusterMetrics(id) {
    const res = await fetch(`/api/projectbase/swarm/clusters/${encodeURIComponent(id)}/metrics`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch swarm cluster metrics');
    return data;
  },

  // Multi-Agent Merge & Semantic Conflict Auto-Resolution Engine (Milestone 6 / Epic 27)
  async proposeSessionMerge(payload = {}) {
    const res = await fetch('/api/projectbase/merges/propose', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to propose session merge');
    return data;
  },

  async listSessionMerges(params = {}) {
    const qp = new URLSearchParams();
    if (params.status) qp.append('status', params.status);
    if (params.project_id) qp.append('project_id', params.project_id);
    if (params.session_id) qp.append('session_id', params.session_id);
    if (params.search) qp.append('search', params.search);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/merges${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list session merges');
    return data;
  },

  async getSessionMerge(id) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch session merge');
    return data;
  },

  async analyzeSessionMerge(id) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}/analyze`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to analyze session merge');
    return data;
  },

  async resolveMergeConflictHunk(mergeId, conflictId, payload = {}) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(mergeId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to resolve conflict hunk');
    return data;
  },

  async autoResolveSessionMerge(id, payload = {}) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}/auto-resolve`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to auto-resolve merge conflicts');
    return data;
  },

  async verifySessionMerge(id) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to verify session merge');
    return data;
  },

  async executeSessionMerge(id) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to execute session merge');
    return data;
  },

  async rejectSessionMerge(id, payload = {}) {
    const res = await fetch(`/api/projectbase/merges/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reject session merge');
    return data;
  },

  async getSessionMergeMatrix() {
    const res = await fetch('/api/projectbase/merges/matrix', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch merge matrix');
    return data;
  },

  // Agent Fleet Budget, Cost Attribution & Token Quota Engine (Milestone 7 / Epic 28)
  async listBudgetPolicies(params = {}) {
    const qp = new URLSearchParams();
    if (params.scope_type) qp.append('scope_type', params.scope_type);
    if (params.scope_id) qp.append('scope_id', params.scope_id);
    if (params.status) qp.append('status', params.status);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/billing/policies${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list budget policies');
    return data;
  },

  async getBudgetPolicy(id) {
    const res = await fetch(`/api/projectbase/billing/policies/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch budget policy');
    return data;
  },

  async createBudgetPolicy(payload = {}) {
    const res = await fetch('/api/projectbase/billing/policies', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save budget policy');
    return data;
  },

  async deleteBudgetPolicy(id) {
    const res = await fetch(`/api/projectbase/billing/policies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete budget policy');
    return data;
  },

  async checkTokenQuota(payload = {}) {
    const res = await fetch('/api/projectbase/billing/quotas/check', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to check token quota');
    return data;
  },

  async reserveTokenQuota(payload = {}) {
    const res = await fetch('/api/projectbase/billing/quotas/reserve', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reserve token quota');
    return data;
  },

  async releaseTokenQuota(payload = {}) {
    const res = await fetch('/api/projectbase/billing/quotas/release', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to release token quota');
    return data;
  },

  async recordTokenUsage(payload = {}) {
    const res = await fetch('/api/projectbase/billing/usage/record', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to record token usage');
    return data;
  },

  async grantBudgetOverride(payload = {}) {
    const res = await fetch('/api/projectbase/billing/overrides/grant', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to grant budget override');
    return data;
  },

  async getFleetBillingAnalytics() {
    const res = await fetch('/api/projectbase/billing/analytics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch billing analytics');
    return data;
  },

  async listCostLedger(params = {}) {
    const qp = new URLSearchParams();
    if (params.session_id) qp.append('session_id', params.session_id);
    if (params.project_id) qp.append('project_id', params.project_id);
    if (params.persona) qp.append('persona', params.persona);
    if (params.model) qp.append('model', params.model);
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/billing/ledger${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list cost ledger');
    return data;
  },

  async getFleetPricing() {
    const res = await fetch('/api/projectbase/billing/pricing', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch model pricing');
    return data;
  },

  async resetCircuitBreaker(payload = {}) {
    const res = await fetch('/api/projectbase/billing/circuit-breaker/reset', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reset circuit breaker');
    return data;
  },

  // Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29)
  async listEvalSuites(params = {}) {
    const qp = new URLSearchParams();
    if (params.domain) qp.append('domain', params.domain);
    if (params.active_only) qp.append('active_only', 'true');
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/evals/suites${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list evaluation suites');
    return data;
  },

  async getEvalSuite(id) {
    const res = await fetch(`/api/projectbase/evals/suites/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get evaluation suite');
    return data;
  },

  async saveEvalSuite(payload = {}) {
    const res = await fetch('/api/projectbase/evals/suites', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save evaluation suite');
    return data;
  },

  async deleteEvalSuite(id) {
    const res = await fetch(`/api/projectbase/evals/suites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete evaluation suite');
    return data;
  },

  async triggerEvalRun(payload = {}) {
    const res = await fetch('/api/projectbase/evals/runs/trigger', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to trigger evaluation run');
    return data;
  },

  async listEvalRuns(params = {}) {
    const qp = new URLSearchParams();
    if (params.model) qp.append('model', params.model);
    if (params.persona) qp.append('persona', params.persona);
    if (params.suite_id) qp.append('suite_id', params.suite_id);
    if (params.status) qp.append('status', params.status);
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/evals/runs${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list evaluation runs');
    return data;
  },

  async getEvalRun(id) {
    const res = await fetch(`/api/projectbase/evals/runs/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get evaluation run');
    return data;
  },

  async recordEvalMetric(runId, payload = {}) {
    const res = await fetch(`/api/projectbase/evals/runs/${encodeURIComponent(runId)}/metrics`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to record evaluation metric');
    return data;
  },

  async getEvalLeaderboard(params = {}) {
    const qp = new URLSearchParams();
    if (params.domain) qp.append('domain', params.domain);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/evals/leaderboard${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get evaluation leaderboard');
    return data;
  },

  async getEvalRegressions() {
    const res = await fetch('/api/projectbase/evals/regressions', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get evaluation regressions');
    return data;
  },

  async compareEvalModels(payload = {}) {
    const res = await fetch('/api/projectbase/evals/compare', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to compare evaluation models');
    return data;
  },

  async seedDefaultEvals() {
    const res = await fetch('/api/projectbase/evals/seed-defaults', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to seed default benchmarks');
    return data;
  },

  // Autonomous Ephemeral Dev Sandboxes & Worktree Container Orchestrator (Milestone 9 / Epic 30)
  async listSandboxes(params = {}) {
    const qp = new URLSearchParams();
    if (params.status) qp.append('status', params.status);
    if (params.project_id) qp.append('project_id', params.project_id);
    if (params.session_id) qp.append('session_id', params.session_id);
    if (params.environment_type) qp.append('environment_type', params.environment_type);
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/sandboxes${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list sandboxes');
    return data;
  },

  async provisionSandbox(payload = {}) {
    const res = await fetch('/api/projectbase/sandboxes/provision', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to provision sandbox');
    return data;
  },

  async getSandbox(id) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get sandbox details');
    return data;
  },

  async deleteSandbox(id) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete sandbox');
    return data;
  },

  async sandboxAction(id, action) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to perform sandbox action');
    return data;
  },

  async execInSandbox(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/exec`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to execute command in sandbox');
    return data;
  },

  async listSandboxExecutions(id, params = {}) {
    const qp = new URLSearchParams();
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/executions${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list sandbox executions');
    return data;
  },

  async createSandboxSnapshot(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/snapshot`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create sandbox snapshot');
    return data;
  },

  async listSandboxSnapshots(id, params = {}) {
    const qp = new URLSearchParams();
    if (params.limit) qp.append('limit', params.limit);
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/snapshots${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list sandbox snapshots');
    return data;
  },

  async updateSandboxHealth(id, payload = {}) {
    const res = await fetch(`/api/projectbase/sandboxes/${encodeURIComponent(id)}/health`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update sandbox health');
    return data;
  },

  async listSandboxTemplates() {
    const res = await fetch('/api/projectbase/sandboxes/templates', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list sandbox templates');
    return data;
  },

  async createSandboxTemplate(payload = {}) {
    const res = await fetch('/api/projectbase/sandboxes/templates', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create sandbox template');
    return data;
  },

  async getSandboxMetrics() {
    const res = await fetch('/api/projectbase/sandboxes/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get sandbox metrics');
    return data;
  },

  async cleanupIdleSandboxes() {
    const res = await fetch('/api/projectbase/sandboxes/cleanup-idle', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to cleanup idle sandboxes');
    return data;
  },

  async seedDefaultSandboxTemplates() {
    const res = await fetch('/api/projectbase/sandboxes/seed-defaults', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to seed sandbox templates');
    return data;
  },

  // ==========================================
  // Incident Response & War-Room Engine APIs (Epic 31)
  // ==========================================
  async listIncidents(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/incidents${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list incidents');
    return data;
  },

  async declareIncident(payload = {}) {
    const res = await fetch('/api/projectbase/incidents', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to declare incident');
    return data;
  },

  async getIncidentDetails(id) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get incident details');
    return data;
  },

  async updateIncident(id, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update incident');
    return data;
  },

  async deleteIncident(id) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete incident');
    return data;
  },

  async transitionIncidentStatus(id, status, note = '', author = '') {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, note, author })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update incident status');
    return data;
  },

  async addIncidentEvent(id, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/events`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to add incident event');
    return data;
  },

  async listIncidentEvents(id) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/events`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list incident events');
    return data;
  },

  async proposeIncidentHypothesis(id, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/hypotheses`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to propose hypothesis');
    return data;
  },

  async updateIncidentHypothesis(id, hypoId, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/hypotheses/${encodeURIComponent(hypoId)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update hypothesis');
    return data;
  },

  async executeIncidentMitigation(id, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/mitigations`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to execute mitigation');
    return data;
  },

  async updateIncidentMitigation(id, mitId, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/mitigations/${encodeURIComponent(mitId)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update mitigation');
    return data;
  },

  async createOrUpdateIncidentPostmortem(id, payload = {}) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/postmortem`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save postmortem');
    return data;
  },

  async getIncidentPostmortem(id) {
    const res = await fetch(`/api/projectbase/incidents/${encodeURIComponent(id)}/postmortem`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get postmortem');
    return data;
  },

  async getIncidentMetrics() {
    const res = await fetch('/api/projectbase/incidents/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get incident metrics');
    return data;
  },

  async seedDemoIncidentWarroom() {
    const res = await fetch('/api/projectbase/incidents/seed-demo', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to seed demo incident');
    return data;
  },

  // ==========================================
  // Knowledge Graph & Architectural Memory APIs (Epic 32)
  // ==========================================
  async listKnowledgeNodes(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/knowledge/nodes${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list knowledge nodes');
    return data;
  },

  async createKnowledgeNode(payload = {}) {
    const res = await fetch('/api/projectbase/knowledge/nodes', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create knowledge node');
    return data;
  },

  async getKnowledgeNodeDetails(id) {
    const res = await fetch(`/api/projectbase/knowledge/nodes/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get knowledge node details');
    return data;
  },

  async updateKnowledgeNode(id, payload = {}) {
    const res = await fetch(`/api/projectbase/knowledge/nodes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update knowledge node');
    return data;
  },

  async deleteKnowledgeNode(id) {
    const res = await fetch(`/api/projectbase/knowledge/nodes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete knowledge node');
    return data;
  },

  async setKnowledgeNodeStatus(id, payload = {}) {
    const res = await fetch(`/api/projectbase/knowledge/nodes/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update node status');
    return data;
  },

  async listKnowledgeRelations(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/knowledge/relations${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list relations');
    return data;
  },

  async createKnowledgeRelation(payload = {}) {
    const res = await fetch('/api/projectbase/knowledge/relations', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create knowledge relation');
    return data;
  },

  async deleteKnowledgeRelation(id) {
    const res = await fetch(`/api/projectbase/knowledge/relations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete relation');
    return data;
  },

  async getKnowledgeGraphTopology(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/knowledge/graph${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get knowledge graph topology');
    return data;
  },

  async listArchitecturalInvariants(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/knowledge/invariants${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list architectural invariants');
    return data;
  },

  async createArchitecturalInvariant(payload = {}) {
    const res = await fetch('/api/projectbase/knowledge/invariants', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create architectural invariant');
    return data;
  },

  async updateArchitecturalInvariant(id, payload = {}) {
    const res = await fetch(`/api/projectbase/knowledge/invariants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update architectural invariant');
    return data;
  },

  async deleteArchitecturalInvariant(id) {
    const res = await fetch(`/api/projectbase/knowledge/invariants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete architectural invariant');
    return data;
  },

  async verifyChangesAgainstInvariants(payload = {}) {
    const res = await fetch('/api/projectbase/knowledge/verify-invariants', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to verify changes against invariants');
    return data;
  },

  async listInvariantVerifications(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/knowledge/verifications${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list verifications');
    return data;
  },

  async getKnowledgeGraphMetrics() {
    const res = await fetch('/api/projectbase/knowledge/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get knowledge graph metrics');
    return data;
  },

  async queryKnowledgeSemantic(payload = {}) {
    const res = await fetch('/api/projectbase/knowledge/query', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to query knowledge graph');
    return data;
  },

  async seedDemoKnowledgeGraph() {
    const res = await fetch('/api/projectbase/knowledge/seed-demo', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to seed demo knowledge graph');
    return data;
  },

  // Milestone 12 / Epic 33 — Autonomous Code Review Swarm & Patch Synthesizer
  async listCodeReviews(params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/reviews${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list code reviews');
    return data;
  },

  async createCodeReview(payload = {}) {
    const res = await fetch('/api/projectbase/reviews', {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create code review');
    return data;
  },

  async getCodeReview(id) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(id)}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get code review');
    return data;
  },

  async updateCodeReview(id, payload = {}) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update code review');
    return data;
  },

  async deleteCodeReview(id) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete code review');
    return data;
  },

  async submitReviewCritique(reviewId, payload = {}) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/critiques`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to submit review critique');
    return data;
  },

  async listReviewCritiques(reviewId, params = {}) {
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/critiques${qs}`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list review critiques');
    return data;
  },

  async updateReviewCritique(id, payload = {}) {
    const res = await fetch(`/api/projectbase/reviews/critiques/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update review critique');
    return data;
  },

  async deleteReviewCritique(id) {
    const res = await fetch(`/api/projectbase/reviews/critiques/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete review critique');
    return data;
  },

  async dispatchReviewSwarm(reviewId) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/swarm`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch review swarm');
    return data;
  },

  async synthesizeReviewPatch(reviewId, payload = {}) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/synthesize-patch`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to synthesize review patch');
    return data;
  },

  async listReviewPatches(reviewId) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/patches`, {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list review patches');
    return data;
  },

  async applyReviewPatch(patchId) {
    const res = await fetch(`/api/projectbase/reviews/patches/${encodeURIComponent(patchId)}/apply`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to apply review patch');
    return data;
  },

  async revertReviewPatch(patchId) {
    const res = await fetch(`/api/projectbase/reviews/patches/${encodeURIComponent(patchId)}/revert`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to revert review patch');
    return data;
  },

  async evaluateMergeGate(reviewId) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/evaluate-gate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to evaluate merge gate');
    return data;
  },

  async overrideMergeGate(reviewId, payload = {}) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/override-gate`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to override merge gate');
    return data;
  },

  async mergeCodeReview(reviewId) {
    const res = await fetch(`/api/projectbase/reviews/${encodeURIComponent(reviewId)}/merge`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to merge code review');
    return data;
  },

  async getCodeReviewMetrics() {
    const res = await fetch('/api/projectbase/reviews/metrics', {
      headers: this._authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to get code review metrics');
    return data;
  }
};
