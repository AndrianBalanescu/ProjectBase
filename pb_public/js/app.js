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
    'project-modal': ProjectModalComponent,
    'cycle-modal': CycleModalComponent
  },
  data() {
    return {
      currentView: 'board', // 'board', 'list', 'cycles', 'projects', 'stats'
      authReady: false,
      isAuthenticated: false,
      loginEmail: '',
      loginPassword: '',
      authError: '',
      currentProject: null,
      projects: [],
      issues: [],
      cycles: [],
      milestones: [],
      labels: [],
      selectedIssue: null,
      realtimeConnected: true,
      
      // Modals
      isOmnibarOpen: false,
      isNewIssueOpen: false,
      isProjectModalOpen: false,
      editingProject: null,
      isCycleModalOpen: false,

      // Filters
      filterQuery: '',
      filterPriority: '',
      filterCycle: '',

      // Toast Notifications
      toasts: []
    };
  },
  computed: {
    filteredIssuesCount() {
      return this.issues.length;
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

    nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  updated() {
    nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  methods: {
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
        const [projs, iss, cycs, mls, lbls] = await Promise.all([
          API.getProjects(),
          API.getIssues(this.currentProject ? this.currentProject.id : null),
          API.getCycles(this.currentProject ? this.currentProject.id : null),
          API.getMilestones(this.currentProject ? this.currentProject.id : null),
          API.getLabels(this.currentProject ? this.currentProject.id : null)
        ]);

        this.projects = projs;
        this.issues = iss;
        this.cycles = cycs;
        this.milestones = mls;
        this.labels = lbls;

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
        // Ignore inside input/textarea unless it's Cmd+K or Escape
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          this.isOmnibarOpen = !this.isOmnibarOpen;
          return;
        }

        if (e.key === 'Escape') {
          this.isOmnibarOpen = false;
          this.isNewIssueOpen = false;
          this.isProjectModalOpen = false;
          this.isCycleModalOpen = false;
          this.selectedIssue = null;
          return;
        }

        if (isInput) return;

        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          this.isNewIssueOpen = true;
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
    },

    changeView(view) {
      this.currentView = view;
    },

    openIssue(issue) {
      this.selectedIssue = issue;
    },

    closeIssueDrawer() {
      this.selectedIssue = null;
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
