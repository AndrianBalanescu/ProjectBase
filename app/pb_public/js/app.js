// pb_public/js/app.js
// ProjectBase - Vue 3 Main Application

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

const App = {
  components: {
    'header-bar': HeaderComponent,
    'kanban-board': KanbanBoardComponent,
    'list-view': ListViewComponent,
    'cycles-view': CyclesViewComponent,
    'milestones-view': MilestonesViewComponent,
    'projects-view': ProjectsViewComponent,
    'stats-view': StatsViewComponent,
    'docs-view': DocsViewComponent,
    'marketplace-view': MarketplaceViewComponent,
    'issue-drawer': IssueDrawerComponent,
    'command-palette': CommandPaletteComponent,
    'new-issue-modal': NewIssueModalComponent,
    'import-modal': ImportModalComponent,
    'project-modal': ProjectModalComponent,
    'cycle-modal': CycleModalComponent,
    'custom-fields-modal': CustomFieldsModalComponent
  },
  data() {
    return {
      currentView: 'board', // 'board', 'list', 'cycles', 'projects', 'stats'
      authReady: false,
      isAuthenticated: false,
      authMode: 'login', // 'login' | 'signup'
      loginEmail: '',
      loginPassword: '',
      signupName: '',
      signupPasswordConfirm: '',
      signingUp: false,
      authError: '',
      currentProject: null,
      projects: [],
      issues: [],
      cycles: [],
      milestones: [],
      labels: [],
      selectedIssue: null,
      realtimeConnected: true,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      
      // Modals
      isOmnibarOpen: false,
      isNewIssueOpen: false,
      isImportOpen: false,
      isProjectModalOpen: false,
      editingProject: null,
      isCycleModalOpen: false,
      isCustomFieldsOpen: false,

      // Filters
      filterQuery: '',
      filterPriority: '',
      filterCycle: '',

      // In-app notifications inbox
      notifications: [],
      isNotificationsOpen: false,

      // Toast Notifications
      toasts: []
    };
  },
  computed: {
    filteredIssuesCount() {
      return this.issues.length;
    },
    unreadNotifications() {
      return this.notifications.filter(n => !n.read).length;
    }
  },
  async mounted() {
    this.isAuthenticated = !!API.client.authStore.isValid;
    this.authReady = true;
    if (this.isAuthenticated) {
      await this.loadAllData();
      this.setupRealtime();
    }
    this.setupKeyboardShortcuts();

    // Client-side URL routing (hash-based, PocketBase-friendly)
    window.addEventListener('hashchange', this.handleRouteChange);

    // Online / offline indicator (Service Worker keeps the shell usable offline)
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    nextTick(() => {
      this.applyRoute();
      if (window.lucide) window.lucide.createIcons();
    });
  },
  beforeUnmount() {
    window.removeEventListener('hashchange', this.handleRouteChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  },
  updated() {
    nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  methods: {
    handleOnline() {
      this.isOnline = true;
    },
    handleOffline() {
      this.isOnline = false;
    },
    async signIn() {
      this.authError = '';
      try {
        try {
          await API.client.collection('users').authWithPassword(this.loginEmail, this.loginPassword);
        } catch (uErr) {
          // Allow superuser login from the same unified gate
          await API.client.collection('_superusers').authWithPassword(this.loginEmail, this.loginPassword);
        }
        this.isAuthenticated = true;
        this.loginPassword = '';
        await this.loadAllData();
        this.setupRealtime();
      } catch (err) {
        this.authError = err?.response?.message || 'Unable to sign in with those credentials.';
      }
    },
    async signUp() {
      this.authError = '';
      if (this.loginPassword !== this.signupPasswordConfirm) {
        this.authError = 'Passwords do not match.';
        return;
      }
      this.signingUp = true;
      try {
        await API.client.collection('users').create({
          email: this.loginEmail,
          password: this.loginPassword,
          passwordConfirm: this.signupPasswordConfirm,
          name: this.signupName || '',
        });
        // Auto sign-in the freshly created account.
        await API.client.collection('users').authWithPassword(this.loginEmail, this.loginPassword);
        this.isAuthenticated = true;
        this.loginPassword = '';
        this.signupPasswordConfirm = '';
        await this.loadAllData();
        this.setupRealtime();
        this.showToast('Welcome! You are in the shared demo workspace — press C to create an issue or I to import yours.', 'success');
      } catch (err) {
        this.authError = err?.response?.data?.email?.message
          || err?.response?.data?.password?.message
          || err?.response?.message
          || 'Unable to create account.';
      } finally {
        this.signingUp = false;
      }
    },
    signOut() {
      API.unsubscribeAll();
      API.client.authStore.clear();
      this.isAuthenticated = false;
      this.projects = [];
      this.issues = [];
      this.cycles = [];
      this.labels = [];
      this.currentProject = null;
      this.selectedIssue = null;
    },
    async loadAllData() {
      try {
        const [projs, iss, cycs, mls, lbls, notifs] = await Promise.all([
          API.getProjects(),
          API.getIssues(this.currentProject ? this.currentProject.id : null),
          API.getCycles(this.currentProject ? this.currentProject.id : null),
          API.getMilestones(this.currentProject ? this.currentProject.id : null),
          API.getLabels(this.currentProject ? this.currentProject.id : null),
          API.getNotifications()
        ]);

        this.projects = projs;
        this.issues = iss;
        this.cycles = cycs;
        this.milestones = mls;
        this.labels = lbls;
        this.notifications = (notifs && notifs.items) || [];

        // Auto-select first favorite project if none selected
        if (!this.currentProject && this.projects.length > 0) {
          const fav = this.projects.find(p => p.is_favorite);
          this.currentProject = fav || this.projects[0];
          await this.loadIssues();
        }
      } catch (err) {
        console.error('Initial data load error:', err);
        this.showToast('Failed to connect to PocketBase backend', 'error');
      }
    },

    async loadIssues() {
      try {
        this.issues = await API.getIssues(this.currentProject ? this.currentProject.id : null);
        this.cycles = await API.getCycles(this.currentProject ? this.currentProject.id : null);
        this.milestones = await API.getMilestones(this.currentProject ? this.currentProject.id : null);
      } catch (err) {
        console.error('Error loading issues:', err);
      }
    },

    setupRealtime() {
      API.initRealtime((collection, event) => {
        const { action, record } = event;
        
        if (collection === 'notifications') {
          // In-app notifications: refresh the inbox + unread badge live.
          this.loadNotifications();
          return;
        }

        if (collection === 'issues') {
          if (action === 'create') {
            // Only add if belongs to current project or in All Projects mode
            if (!this.currentProject || record.project === this.currentProject.id) {
              const exists = this.issues.find(i => i.id === record.id);
              if (!exists) this.issues.unshift(record);
            }
          } else if (action === 'update') {
            const idx = this.issues.findIndex(i => i.id === record.id);
            if (idx !== -1) {
              this.issues[idx] = { ...this.issues[idx], ...record };
            }
            if (this.selectedIssue && this.selectedIssue.id === record.id) {
              this.selectedIssue = { ...this.selectedIssue, ...record };
            }
          } else if (action === 'delete') {
            this.issues = this.issues.filter(i => i.id !== record.id);
            if (this.selectedIssue && this.selectedIssue.id === record.id) {
              this.selectedIssue = null;
            }
          }
        } else 
        if (collection === 'milestones') {
          if (action === 'create') {
            this.milestones.push(record);
          } else if (action === 'update') {
            const idx = this.milestones.findIndex(m => m.id === record.id);
            if (idx !== -1) this.milestones[idx] = record;
          } else if (action === 'delete') {
            this.milestones = this.milestones.filter(m => m.id !== record.id);
          }
        }

        if (collection === 'projects') {
          if (action === 'create') {
            this.projects.push(record);
          } else if (action === 'update') {
            const idx = this.projects.findIndex(p => p.id === record.id);
            if (idx !== -1) this.projects[idx] = record;
            if (this.currentProject && this.currentProject.id === record.id) {
              this.currentProject = record;
            }
          } else if (action === 'delete') {
            this.projects = this.projects.filter(p => p.id !== record.id);
            if (this.currentProject && this.currentProject.id === record.id) {
              this.currentProject = this.projects[0] || null;
            }
          }
        }
      });
    },

    setupKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        const target = e.target;
        const isInput = target && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          (target.closest && (target.closest('[contenteditable="true"]') || target.closest('.ProseMirror') || target.closest('.milkdown')))
        );

        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          this.isOmnibarOpen = !this.isOmnibarOpen;
          return;
        }

        if (e.key === 'Escape') {
          this.isOmnibarOpen = false;
          this.isNewIssueOpen = false;
          this.isProjectModalOpen = false;
          this.isCycleModalOpen = false;
          this.isImportOpen = false;
          this.selectedIssue = null;
          return;
        }

        // Ignore single-key shortcuts when typing, when modifiers are pressed (e.g. Cmd+C copy), or when a modal/drawer is open
        if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
        if (this.isNewIssueOpen || this.isOmnibarOpen || this.isProjectModalOpen || this.isCycleModalOpen || this.isImportOpen || this.selectedIssue) return;

        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          this.isNewIssueOpen = true;
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          this.isImportOpen = true;
        } else if (e.key === '1') {
          this.currentView = 'board';
        } else if (e.key === '2') {
          this.currentView = 'list';
        } else if (e.key === '3') {
          this.currentView = 'cycles';
        } else if (e.key === '4') {
          this.currentView = 'projects';
        } else if (e.key === '5') {
          this.currentView = 'stats';
        } else if (e.key === '6') {
          this.currentView = 'docs';
        } else if (e.key === '7') {
          this.currentView = 'marketplace';
        }
      });
    },

    async selectProject(project) {
      this.currentProject = project;
      await this.loadIssues();
      this.currentView = 'board';
      this.syncRoute();
    },

    changeView(view) {
      this.currentView = view;
      this.syncRoute();
    },

    handleRouteChange() {
      this.applyRoute();
    },

    async applyRoute() {
      if (!this.isAuthenticated) return;
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash) return;
      const parts = hash.split('/').filter(Boolean);
      const viewMap = { board: 'board', list: 'list', cycles: 'cycles', projects: 'projects', stats: 'stats', docs: 'docs', marketplace: 'marketplace', milestones: 'milestones' };

      // parts[0] may be a project identifier or a view name (if no project prefix)
      if (parts.length >= 2 && viewMap[parts[1]]) {
        const projKey = parts[0].toUpperCase();
        const proj = this.projects.find(p => p.identifier === projKey);
        const prevProjId = this.currentProject ? this.currentProject.id : null;
        if (proj && proj.id !== prevProjId) {
          this.currentProject = proj;
          // The board is project-scoped: reload issues for the route's project so
          // a hard refresh (#/pb/board) shows that project's tasks, not the
          // all-projects snapshot loaded during mounted().
          this.selectedIssue = null;
          await this.loadIssues();
        }
        this.currentView = viewMap[parts[1]] || 'board';
        if (parts[2] === 'issue' && parts[3]) {
          const issue = this.issues.find(i => i.id === parts[3]);
          // Never show a stale drawer: close it when the route's issue
          // doesn't exist (deleted or broken shared link).
          this.selectedIssue = issue || null;
        } else {
          // The route no longer denotes an issue (plain board/list/... hash):
          // close any stale drawer from a previous deep link.
          this.selectedIssue = null;
        }
      } else if (viewMap[parts[0]]) {
        this.currentView = viewMap[parts[0]] || 'board';
        // Plain view route (no project prefix): never a stale drawer.
        this.selectedIssue = null;
      }
    },

    syncRoute() {
      const proj = this.currentProject ? this.currentProject.identifier.toLowerCase() : '';
      const base = proj ? `#/${proj}` : '';
      const viewMap = { board: 'board', list: 'list', cycles: 'cycles', projects: 'projects', stats: 'stats', docs: 'docs', marketplace: 'marketplace', milestones: 'milestones' };
      const v = viewMap[this.currentView] || 'board';
      let hash = base ? `${base}/${v}` : `#/${v}`;
      if (this.selectedIssue) {
        hash += `/issue/${this.selectedIssue.id}`;
      }
      if (window.location.hash !== hash) {
        try { window.history.replaceState(null, '', hash); } catch (e) { /* ignore */ }
      }
    },

    openIssue(issue) {
      this.selectedIssue = issue;
      this.syncRoute();
    },

    closeIssueDrawer() {
      this.selectedIssue = null;
      this.syncRoute();
    },

    async handleCreateIssue(issueData) {
      try {
        const created = await API.createIssue(issueData);
        this.showToast(`Created issue ${created.identifier}`, 'success');
      } catch (err) {
        console.error('Issue create failed:', err);
        this.showToast('Failed to create issue', 'error');
      }
    },

    async handleImportComplete(result) {
      // After a CSV import, refresh the issue list so new records appear.
      await this.loadIssues();
      this.showToast(`Imported ${result.imported} issue(s)`, 'success');
      this.isImportOpen = false;
    },

    async handleUpdateIssue(updateData) {
      try {
        const updated = await API.updateIssue(updateData.id, updateData);
        const idx = this.issues.findIndex(i => i.id === updateData.id);
        if (idx !== -1) {
          this.issues[idx] = { ...this.issues[idx], ...updated };
        }
      } catch (err) {
        console.error('Issue update failed:', err);
        this.showToast('Failed to update issue', 'error');
      }
    },

    handleRelationsChanged({ id, relations }) {
      // Relations were mutated through the custom API routes (which maintain
      // reciprocal mirrors); reflect the change locally so the board's blocked
      // indicators and the open drawer stay in sync without waiting for SSE.
      const rel = Array.isArray(relations) ? relations : [];
      const idx = this.issues.findIndex(i => i.id === id);
      if (idx !== -1) this.issues[idx] = { ...this.issues[idx], relations: rel };
      if (this.selectedIssue && this.selectedIssue.id === id) {
        this.selectedIssue = { ...this.selectedIssue, relations: rel };
      }
    },

    async handleDeleteIssue(issueId) {
      if (!confirm('Are you sure you want to delete this issue?')) return;
      try {
        await API.deleteIssue(issueId);
        this.issues = this.issues.filter(i => i.id !== issueId);
        if (this.selectedIssue && this.selectedIssue.id === issueId) {
          this.selectedIssue = null;
        }
        this.showToast('Issue deleted', 'success');
      } catch (err) {
        console.error('Issue delete failed:', err);
        this.showToast('Failed to delete issue', 'error');
      }
    },

    async handleSaveProject(projectData) {
      try {
        if (projectData.id) {
          const updated = await API.updateProject(projectData.id, projectData);
          const idx = this.projects.findIndex(p => p.id === projectData.id);
          if (idx !== -1) this.projects[idx] = updated;
          this.showToast(`Updated project ${updated.name}`, 'success');
        } else {
          const created = await API.createProject(projectData);
          this.projects.unshift(created);
          this.currentProject = created;
          await this.loadIssues();
          this.showToast(`Created project ${created.name}`, 'success');
        }
      } catch (err) {
        console.error('Project save error:', err);
        this.showToast('Failed to save project', 'error');
      }
    },

    async handleCustomFieldsSaved(fields) {
      // Update the current project's cached defs so the IssueDrawer can render them.
      if (this.currentProject) {
        this.currentProject.custom_field_defs = fields;
      }
      this.showToast('Custom fields saved', 'success');
    },

    async handleDeleteProject(projectId) {
      if (!confirm('Delete this project and all its issues?')) return;
      try {
        await API.deleteProject(projectId);
        this.projects = this.projects.filter(p => p.id !== projectId);
        if (this.currentProject && this.currentProject.id === projectId) {
          this.currentProject = this.projects[0] || null;
          await this.loadIssues();
        }
        this.showToast('Project deleted', 'success');
      } catch (err) {
        console.error('Project delete failed:', err);
        this.showToast('Failed to delete project', 'error');
      }
    },

    async handleToggleFavorite(proj) {
      try {
        const updated = await API.updateProject(proj.id, { is_favorite: !proj.is_favorite });
        proj.is_favorite = updated.is_favorite;
      } catch (err) {
        console.error('Toggle favorite failed:', err);
      }
    },

    
    async handleCreateMilestone(milestoneData) {
      try {
        const created = await API.createMilestone(milestoneData);
        this.milestones.push(created);
        this.showToast(`Milestone created: ${created.name}`, 'success');
      } catch (err) {
        console.error('Milestone create error:', err);
        this.showToast('Failed to create milestone', 'error');
      }
    },

    async handleUpdateMilestone(id, data) {
      try {
        const updated = await API.updateMilestone(id, data);
        const idx = this.milestones.findIndex(m => m.id === id);
        if (idx !== -1) this.milestones[idx] = { ...this.milestones[idx], ...updated };
        this.showToast('Milestone updated', 'success');
      } catch (err) {
        console.error('Milestone update error:', err);
        this.showToast('Failed to update milestone', 'error');
      }
    },

    async handleDeleteMilestone(id) {
      if (!confirm('Are you sure you want to delete this milestone?')) return;
      try {
        await API.deleteMilestone(id);
        this.milestones = this.milestones.filter(m => m.id !== id);
        this.showToast('Milestone deleted', 'success');
      } catch (err) {
        console.error('Milestone delete error:', err);
        this.showToast('Failed to delete milestone', 'error');
      }
    },

    async handleCreateCycle(cycleData) {
      try {
        const created = await API.createCycle(cycleData);
        this.cycles.unshift(created);
        this.showToast(`Created cycle ${created.name}`, 'success');
      } catch (err) {
        console.error('Cycle creation failed:', err);
        this.showToast('Failed to create cycle', 'error');
      }
    },

    async loadNotifications() {
      try {
        const res = await API.getNotifications();
        this.notifications = (res && res.items) || [];
      } catch (err) {
        // Non-fatal: the inbox just stays stale on a transient failure.
        console.warn('Notification load failed:', err);
      }
    },

    async handleNotificationClick(notification) {
      // Open the referenced issue (if any) and mark the notification read.
      if (notification && !notification.read) {
        try {
          await API.markNotificationRead(notification.id);
          notification.read = true;
          this.notifications = [...this.notifications];
        } catch (err) {
          console.warn('Mark notification read failed:', err);
        }
      }
      if (notification && notification.issue) {
        const issueId = typeof notification.issue === 'string'
          ? notification.issue
          : notification.issue.id;
        // The API request uses expand=issue,issue.project so the full record
        // (and its project) ride along even when the issue is not in the
        // currently-loaded project-scoped list.
        const issue = this.issues.find(i => i.id === issueId)
          || (notification.expand && notification.expand.issue);
        if (issue) {
          // Switch to the issue's project so the board shows the right context.
          const projId = typeof issue.project === 'string'
            ? issue.project
            : (issue.project && (issue.project.id || issue.project));
          if (projId && this.currentProject && projId !== this.currentProject.id) {
            const proj = this.projects.find(p => p.id === projId);
            if (proj) {
              this.currentProject = proj;
              await this.loadIssues();
            }
          }
          // Prefer the freshly loaded record after any project switch.
          this.openIssue(this.issues.find(i => i.id === issueId) || issue);
        }
      }
      this.isNotificationsOpen = false;
    },

    async handleMarkAllNotificationsRead() {
      try {
        await API.markAllNotificationsRead();
        this.notifications = this.notifications.map(n => ({ ...n, read: true }));
      } catch (err) {
        console.warn('Mark all notifications read failed:', err);
      }
    },

    showToast(message, type = 'info') {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 3500);
    }
  }
};

createApp(App).mount('#app');
