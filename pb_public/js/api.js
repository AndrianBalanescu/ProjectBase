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

    pb.collection('comments').subscribe('*', (e) => {
      this.notifySubscribers('comments', e);
    }).catch(err => console.warn('Comments subscription error:', err));
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
      sort: 'target_date'
    });
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

  // Stats
  async getStats() {
    try {
      const res = await fetch('/api/projectbase/stats');
      if (!res.ok) throw new Error('Stats failed');
      return await res.json();
    } catch (err) {
      return null;
    }
  }
};
