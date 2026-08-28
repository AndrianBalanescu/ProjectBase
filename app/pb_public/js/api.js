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
  }
};
