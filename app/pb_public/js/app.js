// pb_public/js/app.js
// ProjectBase - Vue 3 Main Application

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

// ---------------------------------------------------------------------------
// Data cache: persist the last-known-good workspace snapshot to localStorage so
// a page refresh keeps content on screen while the fresh fetch resolves (no
// blank flash). The cache is a best-effort mirror, never the source of truth.
// Snapshots are isolated per authenticated identity and expire after 24 hours,
// preventing stale/cross-account workspace content from being rendered.
// ---------------------------------------------------------------------------
const DATA_CACHE_PREFIX = 'projectbase_data_cache_v2:';
const DATA_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function currentCacheKey() {
  try {
    const model = API && API.client && API.client.authStore && API.client.authStore.model;
    const id = model && model.id;
    return id ? DATA_CACHE_PREFIX + id : null;
  } catch (e) {
    return null;
  }
}

function readDataCache() {
  try {
    const key = currentCacheKey();
    if (!key) return {};
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 2) return {};
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > DATA_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return {};
    }
    // Validate the fields we consume before handing them to Vue templates.
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.issues) ||
        !Array.isArray(parsed.cycles) || !Array.isArray(parsed.milestones) ||
        !Array.isArray(parsed.labels) || !Array.isArray(parsed.agents) ||
        !Array.isArray(parsed.agentSessions)) return {};
    return parsed;
  } catch (e) {
    return {};
  }
}

function writeDataCache(snapshot) {
  try {
    const key = currentCacheKey();
    if (!key) return;
    // Only persist the workspace snapshot fields (never auth/session state).
    const slim = {
      version: 2,
      cachedAt: Date.now(),
      currentProject: snapshot.currentProject || null,
      projects: snapshot.projects || [],
      issues: snapshot.issues || [],
      cycles: snapshot.cycles || [],
      milestones: snapshot.milestones || [],
      labels: snapshot.labels || [],
      agents: snapshot.agents || [],
      agentSessions: snapshot.agentSessions || [],
      agentSource: snapshot.agentSource || 'bridge'
    };
    localStorage.setItem(key, JSON.stringify(slim));
  } catch (e) {
    // Quota / private-mode: cache is best-effort, ignore failures.
  }
}

const App = {
  components: {
    'header-bar': HeaderComponent,
    'kanban-board': KanbanBoardComponent,
    'list-view': ListViewComponent,
    'cycles-view': CyclesViewComponent,
    'milestones-view': MilestonesViewComponent,
    'timeline-view': TimelineViewComponent,
    'projects-view': ProjectsViewComponent,
    'stats-view': StatsViewComponent,
    'agents-view': AgentsViewComponent,
    'docs-view': DocsViewComponent,
    'portfolio-view': PortfolioViewComponent,
    'issue-drawer': IssueDrawerComponent,
    'command-palette': CommandPaletteComponent,
    'new-issue-modal': NewIssueModalComponent,
    'import-modal': ImportModalComponent,
    'export-modal': ExportModalComponent,
    'project-modal': ProjectModalComponent,
    'cycle-modal': CycleModalComponent,
    'custom-fields-modal': CustomFieldsModalComponent,
    'notification-settings-modal': NotificationSettingsModalComponent,
    'welcome-modal': WelcomeModalComponent
  },
  data() {
    // Restore the last-known-good snapshot from localStorage so a page refresh
    // keeps content on screen while the fresh fetch resolves (no blank flash).
    const cache = readDataCache();
    return {
      theme: 'dark',
      currentView: 'board', // 'board', 'list', 'cycles', 'timeline', 'projects', 'stats', 'portfolio'
      authReady: false,
      isAuthenticated: false,
      authMode: 'login', // 'login' | 'signup'
      loginEmail: '',
      loginPassword: '',
      signupName: '',
      signupPasswordConfirm: '',
      signingUp: false,
      authError: '',
      currentProject: cache.currentProject || null,
      projects: cache.projects || [],
      issues: cache.issues || [],
      cycles: cache.cycles || [],
      milestones: cache.milestones || [],
      labels: cache.labels || [],
      agents: cache.agents || [], // Agentic-native: detected local AI agents (board teammates)
      agentSessions: cache.agentSessions || [], // Sanitized live flomaster/agent sessions
      activeAgentName: null, // Selected agent name on the Agents view (or null -> team list)
      agentSource: cache.agentSource || 'bridge',
      agentSyncing: false,
      selectedIssue: null,
      selectedIssueIds: new Set(),
      lastSelectedIssueId: null, // shift+click range anchor
      bulkStatus: '',
      bulkPriority: '',
      bulkCycle: '',
      bulkCustomFieldKey: '', // per-project custom field chosen in the bulk bar
      bulkCustomValue: '', // text/number/select/date value to apply
      bulkCustomChecked: false, // checkbox value to apply
      realtimeConnected: true,
      // Bumped on any realtime issue/milestone/project/cycle event so views
      // that aggregate a workspace snapshot (PortfolioView) can refetch.
      realtimeTick: 0,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      
      // Modals
      isOmnibarOpen: false,
      isNewIssueOpen: false,
      pendingNewIssue: null, // pre-filled payload when opening New Issue from a session
      isImportOpen: false,
      isExportOpen: false,
      isNotificationSettingsOpen: false,
      isProjectModalOpen: false,
      editingProject: null,
      isCycleModalOpen: false,
      isCustomFieldsOpen: false,
      isWelcomeOpen: false,

      // Filters (URL-synced: shared as ?q=&priority=&cycle= hash params)
      filterQuery: '',
      filterPriority: '',
      filterCycle: '',

      // URL-synced UI state: selected cycle tab in Cycles view (?cycle=)
      // and drawer width override in px (?w=, session-only; localStorage still wins after a manual resize)
      selectedCycleId: null,
      drawerWidthOverride: null,

      // In-app notifications inbox
      notifications: [],
      isNotificationsOpen: false,

      // Bumped on every realtime comment event so the open IssueDrawer can
      // refresh its comment thread live (see IssueDrawer watch on this key).
      commentRefreshKey: 0,

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
    },
    currentFieldDefs() {
      // Per-project custom field schemas; JSON may arrive as a string from the
      // API, so normalize to an array before exposing to the bulk bar.
      let defs = this.currentProject ? this.currentProject.custom_field_defs : [];
      if (typeof defs === 'string') { try { defs = JSON.parse(defs); } catch (e) { defs = []; } }
      return Array.isArray(defs) ? defs : [];
    },
    selectedBulkCustomField() {
      const key = this.bulkCustomFieldKey;
      if (!key) return null;
      return this.currentFieldDefs.find(f => f.key === key) || null;
    }
  },
  watch: {
    // URL deep-link state: every change rewrites the hash query (replaceState,
    // no history spam), so filters/tabs/drawer width are shareable and survive reload.
    filterQuery() { this.syncRoute(); },
    filterPriority() { this.syncRoute(); },
    filterCycle() { this.syncRoute(); },
    selectedCycleId() { this.syncRoute(); },
    drawerWidthOverride() { this.syncRoute(); },
    currentView() { this.syncRoute(); }
  },
  async mounted() {
    this.initTheme();
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
    initTheme() {
      try {
        const saved = localStorage.getItem('projectbase_theme');
        if (saved === 'light' || saved === 'dark') {
          this.theme = saved;
        } else {
          this.theme = 'dark';
        }
      } catch (e) {
        this.theme = 'dark';
      }
      this.applyTheme();
    },
    setTheme(t) {
      this.theme = t;
      try {
        localStorage.setItem('projectbase_theme', t);
      } catch (e) {}
      this.applyTheme();
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    },
    applyTheme() {
      const root = document.documentElement;
      if (this.theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    },
    handleOnline() {
      this.isOnline = true;
    },
    handleOffline() {
      this.isOnline = false;
    },
    async signIn(e) {
      this.authError = '';
      let email = (this.loginEmail || '').trim();
      let password = this.loginPassword || '';
      if (!email || !password) {
        try {
          const emailInput = (e && e.target && (e.target.querySelector('input[type="email"]') || (e.target.elements && e.target.elements['email']))) || document.querySelector('input[type="email"]');
          const passInput = (e && e.target && (e.target.querySelector('input[type="password"]') || (e.target.elements && e.target.elements['password']))) || document.querySelector('input[type="password"]');
          if (emailInput && emailInput.value && !email) email = emailInput.value.trim();
          if (passInput && passInput.value && !password) password = passInput.value;
        } catch (domErr) {}
      }
      if (!email || !password) {
        this.authError = 'Please enter your email and password.';
        return;
      }
      try {
        try {
          await API.client.collection('users').authWithPassword(email, password);
        } catch (uErr) {
          // Allow superuser login from the same unified gate
          await API.client.collection('_superusers').authWithPassword(email, password);
        }
        this.isAuthenticated = true;
        this.loginPassword = '';
        await this.loadAllData();
        this.setupRealtime();
        // Re-apply the URL hash after auth: a deep link opened before login
        // (e.g. #/pb/portfolio shared with a collaborator) must land on that
        // view, not fall back to the board. applyRoute() bailed on mount while
        // unauthenticated, so the hash never got a chance to route.
        await this.applyRoute();
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
        // Same deep-link handling as signIn: land on the hashed view.
        await this.applyRoute();
        this.showToast('Welcome! You are in the shared demo workspace — press C to create an issue or I to import yours.', 'success');
        // First-run onboarding: show the welcome guide once per browser after
        // a successful sign-up, and re-allow it when the session signs out.
        if (!localStorage.getItem('pb_welcome_seen')) {
          this.isWelcomeOpen = true;
          localStorage.setItem('pb_welcome_seen', '1');
        }
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
      this.isWelcomeOpen = false;
      // Re-allow the welcome guide for a later account on this browser.
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('pb_welcome_seen');
      }
    },
    async loadAllData() {
      try {
        const [projs, iss, cycs, mls, lbls, notifs, agents] = await Promise.all([
          API.getProjects(),
          API.getIssues(this.currentProject ? this.currentProject.id : null),
          API.getCycles(this.currentProject ? this.currentProject.id : null),
          API.getMilestones(this.currentProject ? this.currentProject.id : null),
          API.getLabels(this.currentProject ? this.currentProject.id : null),
          API.getNotifications(),
          API.getAgents().catch(() => ({ agents: [] }))
        ]);

        this.projects = projs;
        this.issues = iss;
        this.cycles = cycs;
        this.milestones = mls;
        this.labels = lbls;
        this.notifications = (notifs && notifs.items) || [];
        this.agents = (agents && agents.agents) || [];
        this.agentSessions = (agents && agents.sessions) || [];
        this.agentSource = (agents && agents.source) || 'bridge';

        // Auto-select first favorite project if none selected, or refresh current project reference
        if (this.currentProject) {
          const fresh = this.projects.find(p => p.id === this.currentProject.id);
          if (fresh) this.currentProject = fresh;
        } else if (this.projects.length > 0) {
          const fav = this.projects.find(p => p.is_favorite);
          this.currentProject = fav || this.projects[0];
          await this.loadIssues();
        }

        // Persist the fresh snapshot so a later refresh keeps content on screen.
        writeDataCache(this);
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
        writeDataCache(this);
      } catch (err) {
        console.error('Error loading issues:', err);
      }
    },

    async loadLiveAgents() {
      if (!this.isAuthenticated) return;
      try {
        const live = await API.getAgents().catch(() => null);
        if (live && Array.isArray(live.agents)) {
          this.agents = live.agents;
          this.agentSessions = live.sessions || [];
          this.agentSource = live.source || 'bridge';
          writeDataCache(this);
        }
      } catch (e) {
        // silent background poll
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
            if (this.selectedIssueIds.has(record.id)) {
              this.selectedIssueIds.delete(record.id);
            }
            if (this.lastSelectedIssueId === record.id) {
              this.lastSelectedIssueId = null;
            }
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

        if (collection === 'cycles') {
          if (action === 'create') {
            // Only add if it belongs to the current project (or All Projects).
            if (!this.currentProject || record.project === this.currentProject.id) {
              const exists = this.cycles.find(c => c.id === record.id);
              if (!exists) this.cycles.push(record);
            }
          } else if (action === 'update') {
            const idx = this.cycles.findIndex(c => c.id === record.id);
            if (idx !== -1) this.cycles[idx] = { ...this.cycles[idx], ...record };
          } else if (action === 'delete') {
            this.cycles = this.cycles.filter(c => c.id !== record.id);
            if (this.selectedCycleId === record.id) this.selectedCycleId = null;
          }
        }

        if (collection === 'comments') {
          // A comment was created/updated/deleted. Bump the refresh key so the
          // open IssueDrawer reloads its thread live (it filters by issue id).
          this.commentRefreshKey++;
        }

        // Any change to the workspace-scoped collections (issues, milestones,
        // projects, cycles) bumps the tick so snapshot-aggregating views
        // (PortfolioView) refetch their cross-project data in realtime.
        if (collection === 'issues' || collection === 'milestones' ||
            collection === 'projects' || collection === 'cycles') {
          this.realtimeTick++;
        }
      });
    },

    setupKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        const target = e.target;
        const isInput = target && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          (target.closest && (target.closest('[contenteditable="true"]') || target.closest('.ProseMirror') || target.closest('.md-editor-shell')))
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
          this.isWelcomeOpen = false;
          if (this.selectedIssue) {
            this.selectedIssue = null;
          } else if (this.selectedIssueIds.size > 0) {
            this.clearIssueSelection();
          }
          return;
        }

        // Ignore single-key shortcuts when typing, when modifiers are pressed (e.g. Cmd+C copy), or when a modal/drawer is open
        if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
        if (this.isNewIssueOpen || this.isOmnibarOpen || this.isProjectModalOpen || this.isCycleModalOpen || this.isImportOpen || this.isExportOpen || this.isNotificationSettingsOpen || this.isWelcomeOpen || this.selectedIssue) return;

        if (e.key === 'c' || e.key === 'C' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          this.isNewIssueOpen = true;
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          this.isImportOpen = true;
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          this.isExportOpen = true;
        } else if (e.key === '1') {
          this.currentView = 'board';
        } else if (e.key === '2') {
          this.currentView = 'list';
        } else if (e.key === '3') {
          this.currentView = 'cycles';
        } else if (e.key === '4') {
          this.currentView = 'timeline';
        } else if (e.key === '5') {
          this.currentView = 'projects';
        } else if (e.key === '6') {
          this.currentView = 'stats';
        } else if (e.key === '7') {
          this.currentView = 'docs';
        } else if (e.key === '8' || e.key === '9') {
          this.currentView = 'portfolio';
        }
      });
    },

    async selectProject(project) {
      this.currentProject = project;
      await this.loadIssues();
      this.currentView = 'board';
      this.clearIssueSelection();
      this.syncRoute();
    },

    changeView(view) {
      this.currentView = view;
      this.syncRoute();
    },

    // First-run welcome guide actions — each performs the real UI action.
    closeWelcome() {
      this.isWelcomeOpen = false;
    },
    openWelcomeCreateProject() {
      this.isWelcomeOpen = false;
      this.editingProject = null;
      this.isProjectModalOpen = true;
    },
    openWelcomeCreateIssue() {
      this.isWelcomeOpen = false;
      this.isNewIssueOpen = true;
    },
    openNewIssue(payload) {
      this.isNewIssueOpen = true;
      // Support pre-filled payload from a session's "Create Ticket" action.
      if (payload && payload.title) {
        this.pendingNewIssue = payload;
      }
    },
    openWelcomeBoard() {
      this.isWelcomeOpen = false;
      if (this.projects.length) {
        this.currentView = 'board';
        this.syncRoute();
      }
    },

    handleRouteChange() {
      this.applyRoute();
    },

    // Hash query helpers — URL state for filters (?q= &priority= &cycle=),
    // the Cycles view tab (?cycle=) and the drawer width override (?w=).
    parseHashQuery(hash) {
      const qIdx = hash.indexOf('?');
      if (qIdx === -1) return { path: hash, params: new URLSearchParams() };
      return { path: hash.slice(0, qIdx), params: new URLSearchParams(hash.slice(qIdx + 1)) };
    },

    applyHashQueryState(params) {
      const q = (params.get('q') || '').slice(0, 200);
      const priority = params.get('priority') || '';
      const cycle = params.get('cycle') || '';
      const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];
      this.filterQuery = q;
      this.filterPriority = validPriorities.includes(priority) ? priority : '';
      this.filterCycle = cycle;
      this.selectedCycleId = cycle || null;
      const w = parseInt(params.get('w') || '', 10);
      // Same clamp range as the IssueDrawer drag handle (360-1280px).
      this.drawerWidthOverride = !isNaN(w) && w >= 360 && w <= 1280 ? w : null;
    },

    async applyRoute() {
      if (!this.isAuthenticated) return;
      const raw = window.location.hash.replace(/^#\/?/, '');
      if (!raw) return;
      const { path: hash, params } = this.parseHashQuery(raw);
      this.applyHashQueryState(params);
      if (!hash) return;
      const parts = hash.split('/').filter(Boolean);
      const viewMap = { board: 'board', list: 'list', cycles: 'cycles', timeline: 'timeline', projects: 'projects', stats: 'stats', docs: 'docs', milestones: 'milestones', portfolio: 'portfolio', agents: 'agents' };

      // parts[0] may be a project identifier or a view name (if no project prefix)
      if (parts.length >= 2 && viewMap[parts[1]]) {
        const projKey = parts[0].toUpperCase();
        const proj = this.projects.find(p => p.identifier === projKey);
        const prevProjId = this.currentProject ? this.currentProject.id : null;
        if (proj) {
          const changed = !this.currentProject || this.currentProject.id !== proj.id;
          this.currentProject = proj;
          if (changed) {
            // The board is project-scoped: reload issues for the route's project so
            // a hard refresh (#/pb/board) shows that project's tasks, not the
            // all-projects snapshot loaded during mounted().
            this.selectedIssue = null;
            await this.loadIssues();
          }
        }
        this.currentView = viewMap[parts[1]] || 'board';
        // Agent detail route: #/<proj-or-@>/agents/<name>
        if (this.currentView === 'agents' && parts[2]) {
          this.activeAgentName = parts[2];
        } else if (this.currentView === 'agents') {
          this.activeAgentName = null;
        }
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
        // Agent detail route: #/agents/<name>
        if (this.currentView === 'agents') {
          this.activeAgentName = parts[1] || null;
        }
        // Plain view route (no project prefix): never a stale drawer.
        this.selectedIssue = null;
      }
    },

    // Navigate the Agents view to a specific agent's detail page.
    navigateAgent(name) {
      this.activeAgentName = name || null;
      const proj = this.currentProject ? this.currentProject.identifier.toLowerCase() : '';
      const base = proj ? `#/${proj}/agents` : `#/agents`;
      const hash = name ? `${base}/${name}` : base;
      if (window.location.hash !== hash) {
        try { window.history.replaceState(null, '', hash); } catch (e) { /* ignore */ }
      }
    },

    // Header "Agent Team" dropdown entry point: switch to the Agents view.
    openAgents(name) {
      this.changeView('agents');
      this.activeAgentName = name || null;
      this.syncRoute();
    },

    syncRoute() {
      const proj = this.currentProject ? this.currentProject.identifier.toLowerCase() : '';
      const viewMap = { board: 'board', list: 'list', cycles: 'cycles', timeline: 'timeline', projects: 'projects', stats: 'stats', docs: 'docs', milestones: 'milestones', portfolio: 'portfolio', agents: 'agents' };
      const v = viewMap[this.currentView] || 'board';
      let hash = proj ? `#/${proj}/${v}` : `#/${v}`;
      if (this.currentView === 'agents' && this.activeAgentName) {
        hash += `/${this.activeAgentName}`;
      }
      if (this.selectedIssue) {
        hash += `/issue/${this.selectedIssue.id}`;
      }
      // Canonical query: only non-empty state lands in the URL, so plain views stay clean.
      const params = new URLSearchParams();
      if (this.filterQuery) params.set('q', this.filterQuery);
      if (this.filterPriority) params.set('priority', this.filterPriority);
      // cycle= doubles as the board/list cycle filter and the Cycles view tab.
      const cycleId = this.currentView === 'cycles' ? this.selectedCycleId : this.filterCycle;
      if (cycleId) params.set('cycle', cycleId);
      if (this.drawerWidthOverride) params.set('w', String(this.drawerWidthOverride));
      const qs = params.toString();
      if (qs) hash += `?${qs}`;
      if (window.location.hash !== hash) {
        try { window.history.replaceState(null, '', hash); } catch (e) { /* ignore */ }
      }
    },

    openIssue(issue) {
      this.selectedIssue = issue;
      this.syncRoute();
    },

    // A global search result may live in a different project than the one
    // currently selected. Switch to that project, load its issues, then open
    // the issue so the drawer has the full record (relations, comments, etc.).
    async openGlobalIssue(issue) {
      const targetProjectId = issue.project_id;
      if (targetProjectId && (!this.currentProject || this.currentProject.id !== targetProjectId)) {
        const proj = this.projects.find(p => p.id === targetProjectId);
        if (proj) {
          this.currentProject = proj;
          await this.loadIssues();
          this.currentView = 'board';
          this.clearIssueSelection();
        }
      }
      // The search result carries the minimal fields we need to render the
      // drawer header; refetch the full record so edits/comments/relations work.
      try {
        const full = await API.client.collection('issues').getOne(issue.id, {
          expand: 'project,cycle,milestone'
        });
        this.selectedIssue = full;
      } catch (err) {
        this.selectedIssue = issue;
      }
      this.syncRoute();
    },

    closeIssueDrawer() {
      this.selectedIssue = null;
      this.syncRoute();
    },

    async handleCreateIssue(issueData) {
      try {
        const created = await API.createIssue(issueData);
        // Add the created issue to the local list immediately so it appears
        // without waiting for (or depending on) the SSE realtime event. This
        // fixes PB-56: creating an item in the UI did not show it in the list
        // until a manual refresh when the realtime event was missed.
        if (!this.currentProject || created.project === this.currentProject.id) {
          const exists = this.issues.find(i => i.id === created.id);
          if (!exists) this.issues.unshift(created);
        }
        // Optimistic (non-SSE) update path: bump the tick so snapshot views
        // (PortfolioView) refetch even when the SSE event is missed (PB-56).
        this.realtimeTick++;
        this.pendingNewIssue = null;
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

    async handleExportComplete(result) {
      this.showToast(`Exported ${result.format.toUpperCase()} for ${result.project || 'project'}`, 'success');
      this.isExportOpen = false;
    },

    handleNotificationSettingsSaved() {
      this.showToast('Notification channels updated', 'success');
    },

    async handleUpdateIssue(updateData) {
      try {
        const updated = await API.updateIssue(updateData.id, updateData);
        const idx = this.issues.findIndex(i => i.id === updateData.id);
        if (idx !== -1) {
          this.issues[idx] = { ...this.issues[idx], ...updated };
        }
        // Optimistic update path (SSE-independent, PB-56): keep snapshot views live.
        this.realtimeTick++;
      } catch (err) {
        console.error('Issue update failed:', err);
        this.showToast('Failed to update issue', 'error');
      }
    },

    handleRelationsChanged({ id, relations, targetId, mirrorType, action }) {
      // Relations were mutated through the custom API routes (which maintain
      // reciprocal mirrors); reflect the change locally so the board's blocked
      // indicators and the open drawer stay in sync without waiting for SSE.
      const rel = Array.isArray(relations) ? relations : [];
      const idx = this.issues.findIndex(i => i.id === id);
      if (idx !== -1) this.issues[idx] = { ...this.issues[idx], relations: rel };
      if (this.selectedIssue && this.selectedIssue.id === id) {
        this.selectedIssue = { ...this.selectedIssue, relations: rel };
      }
      // The custom route also saved the reciprocal mirror edge on the target
      // issue. The mirror save does not reliably broadcast via SSE, so update
      // the target's local relations here to keep its kanban blocked badge in
      // sync without a reload.
      if (targetId && mirrorType) {
        const tIdx = this.issues.findIndex(i => i.id === targetId);
        if (tIdx !== -1) {
          const tRel = Array.isArray(this.issues[tIdx].relations) ? this.issues[tIdx].relations : [];
          const mirror = { issue: id, type: mirrorType };
          const hasMirror = tRel.some(r => r && r.issue === id && r.type === mirrorType);
          let next;
          if (action === 'remove') {
            next = hasMirror ? tRel.filter(r => !(r && r.issue === id && r.type === mirrorType)) : tRel;
          } else {
            next = hasMirror ? tRel : [...tRel, mirror];
          }
          this.issues[tIdx] = { ...this.issues[tIdx], relations: next };
        }
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
        // Optimistic delete path (SSE-independent, PB-56): keep snapshot views live.
        this.realtimeTick++;
        this.showToast('Issue deleted', 'success');
      } catch (err) {
        console.error('Issue delete failed:', err);
        this.showToast('Failed to delete issue', 'error');
      }
    },

    // --- Batch multi-select (board/list) ---
    isIssueSelected(issue) {
      return this.selectedIssueIds.has(issue.id);
    },

    toggleIssueSelection(issue) {
      if (!issue || !issue.id) return;
      if (this.selectedIssueIds.has(issue.id)) {
        this.selectedIssueIds.delete(issue.id);
      } else {
        this.selectedIssueIds.add(issue.id);
      }
      // The last toggled issue becomes the anchor for shift+click ranges.
      this.lastSelectedIssueId = issue.id;
    },

    rangeSelectIssue(orderedIssues, targetIssue) {
      // Linear-style shift+click: select every issue between the anchor and
      // the clicked one (inclusive) in the view's visible order, as a union
      // with the current selection. Falls back to a single selection when the
      // anchor is missing or no longer visible.
      if (!targetIssue || !targetIssue.id) return;
      const ordered = orderedIssues || [];
      const targetIdx = ordered.findIndex(i => i.id === targetIssue.id);
      if (targetIdx === -1) {
        this.selectedIssueIds = new Set([targetIssue.id]);
        this.lastSelectedIssueId = targetIssue.id;
        return;
      }
      let anchorIdx = -1;
      if (this.lastSelectedIssueId) {
        anchorIdx = ordered.findIndex(i => i.id === this.lastSelectedIssueId);
      }
      if (anchorIdx === -1) {
        this.selectedIssueIds = new Set([targetIssue.id]);
      } else {
        const lo = Math.min(anchorIdx, targetIdx);
        const hi = Math.max(anchorIdx, targetIdx);
        for (let i = lo; i <= hi; i++) {
          this.selectedIssueIds.add(ordered[i].id);
        }
      }
      this.lastSelectedIssueId = targetIssue.id;
    },

    selectAllVisibleIssues(issues) {
      // Replace the selection with the currently visible (filtered) set.
      this.selectedIssueIds = new Set((issues || []).map(i => i.id));
      const last = issues && issues.length ? issues[issues.length - 1].id : null;
      this.lastSelectedIssueId = last;
    },

    clearIssueSelection() {
      this.selectedIssueIds = new Set();
      this.lastSelectedIssueId = null;
    },

    selectedIssuesList() {
      return this.issues.filter(i => this.selectedIssueIds.has(i.id));
    },

    async bulkUpdateSelected(patch) {
      const ids = Array.from(this.selectedIssueIds);
      if (ids.length === 0) return;
      const count = ids.length;
      try {
        const res = await API.bulkUpdateIssues(ids, patch);
        // Apply the patch locally immediately; realtime SSE also confirms each
        // record, but this keeps the UI instant for the acting user. For the
        // custom_fields object we merge (preserving unrelated keys) to mirror
        // the backend's partial-update semantics.
        for (const key of Object.keys(patch)) {
          for (const issue of this.issues) {
            if (this.selectedIssueIds.has(issue.id)) {
              if (key === 'custom_fields') {
                let cf = issue[key];
                if (typeof cf === 'string') { try { cf = JSON.parse(cf); } catch (e) { cf = {}; } }
                if (!cf || typeof cf !== 'object' || Array.isArray(cf)) cf = {};
                // Mirror the backend's partial-update semantics exactly: a
                // null/undefined/'' value REMOVES that key (the backend deletes
                // it from the custom_fields JSON); everything else is set.
                const merged = { ...cf };
                for (const cfk of Object.keys(patch[key] || {})) {
                  const cfv = patch[key][cfk];
                  if (cfv === null || cfv === undefined || cfv === '') {
                    delete merged[cfk];
                  } else {
                    merged[cfk] = cfv;
                  }
                }
                issue[key] = merged;
              } else {
                issue[key] = patch[key];
              }
            }
          }
        }
        this.clearIssueSelection();
        // Optimistic bulk update path (SSE-independent): keep snapshot views live.
        this.realtimeTick++;
        this.showToast(`Updated ${res.updated || count} issue${(res.updated || count) === 1 ? '' : 's'}`, 'success');
      } catch (err) {
        console.error('Bulk update failed:', err);
        this.showToast('Failed to bulk update issues', 'error');
      }
    },

    async applyBulkField(field, value) {
      if (!value) return;
      const patch = {};
      patch[field] = value;
      await this.bulkUpdateSelected(patch);
      this.bulkStatus = '';
      this.bulkPriority = '';
      this.bulkCycle = '';
    },

    // Apply a per-project custom field value to every selected issue. The
    // backend merges this partial object into each record's custom_fields JSON,
    // preserving unrelated values (a null/'' value clears that one key).
    async applyBulkCustomField(field, value) {
      if (!field) return;
      const patch = {};
      patch.custom_fields = {};
      patch.custom_fields[field] = value;
      await this.bulkUpdateSelected(patch);
      this.bulkCustomFieldKey = '';
      this.bulkCustomValue = '';
      this.bulkCustomChecked = false;
    },

    async bulkDeleteSelected() {
      const ids = Array.from(this.selectedIssueIds);
      if (ids.length === 0) return;
      if (!confirm(`Delete ${ids.length} selected issue${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
      try {
        const res = await API.bulkDeleteIssues(ids);
        this.issues = this.issues.filter(i => !this.selectedIssueIds.has(i.id));
        if (this.selectedIssue && this.selectedIssueIds.has(this.selectedIssue.id)) {
          this.selectedIssue = null;
        }
        this.clearIssueSelection();
        // Optimistic bulk delete path (SSE-independent): keep snapshot views live.
        this.realtimeTick++;
        this.showToast(`Deleted ${res.deleted || ids.length} issue${(res.deleted || ids.length) === 1 ? '' : 's'}`, 'success');
      } catch (err) {
        console.error('Bulk delete failed:', err);
        this.showToast('Failed to bulk delete issues', 'error');
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

    async handleSyncAgents() {
      this.agentSyncing = true;
      try {
        const res = await API.syncAgents();
        // Refetch the live view so the stack + statuses reflect persisted records.
        const live = await API.getAgents().catch(() => ({ agents: [] }));
        this.agents = (live && live.agents) || [];
        this.agentSessions = (live && live.sessions) || [];
        this.agentSource = (live && live.source) || 'bridge';
        const n = (res && res.synced) || 0;
        this.showToast(`${n} agent${n === 1 ? '' : 's'} synced to the board`, 'success');
      } catch (err) {
        console.warn('Agent sync failed:', err);
        this.showToast('Agent sync failed', 'error');
      } finally {
        this.agentSyncing = false;
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
