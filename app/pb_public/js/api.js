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
  }
};
