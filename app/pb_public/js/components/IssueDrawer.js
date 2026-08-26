// pb_public/js/components/IssueDrawer.js
// Minimalist, high-density Issue Drawer supporting Dark and Light themes with subtle, low-contrast accents.

const IssueDrawerComponent = {
  components: {
    'milkdown-editor': window.MilkdownEditorComponent || MilkdownEditorComponent,
    'searchable-select': window.SearchableSelectComponent || SearchableSelectComponent
  },
  props: ['issue', 'projects', 'cycles', 'labels', 'fieldDefs', 'milestones', 'issues', 'widthOverride', 'commentRefreshKey', 'agents', 'sessions'],
  emits: ['close', 'update-issue', 'delete-issue', 'relations-changed', 'update:widthOverride'],
  data() {
    return {
      editTitle: '',
      editDesc: '',
      editStatus: 'backlog',
      editPriority: 'none',
      editEstimate: 0,
      editStartDate: '',
      editDueDate: '',
      editCycle: '',
      editMilestone: '',
      editAssignee: '',
      editLabels: [],
      subtasks: [],
      editCustomFields: {},
      newSubtaskTitle: '',
      descTab: 'rich', // 'rich', 'raw', or 'preview'
      comments: [],
      newCommentContent: '',
      newCommentAuthorType: 'user', // 'user' or 'agent'
      dispatchToSession: true,
      showFullReasoning: false,
      copiedBadge: false,
      copiedLinkBadge: false,
      isAgentDropdownOpen: false,
      agentPrompt: '', // custom instructions sent with an autonomous dispatch
      isFullscreen: false,
      descFocus: false, // true = distraction-free fullscreen description editing
      aiLoadingSubtasks: false,
      aiLoadingDesc: false,
      relationOutgoing: [],
      relationIncoming: [],
      relationType: 'blocks',
      relationQuery: '',
      relationPickerOpen: false,
      relationLoading: false,
      relationError: '',
      drawerWidth: null, // persisted user-resized width (px); null = default
      isResizing: false,
      resizeStartX: 0,
      resizeStartWidth: 0
    };
  },
  computed: {
    drawerStyle() {
      if (this.isFullscreen) return {};
      const width = this.drawerWidth || (this.widthOverride ? Number(this.widthOverride) : null);
      if (!width) return {};
      return {
        width: `${width}px`,
        maxWidth: '95vw',
        minWidth: '380px'
      };
    },
    subtaskStats() {
      if (!this.subtasks || this.subtasks.length === 0) return { total: 0, completed: 0, percent: 0 };
      const completed = this.subtasks.filter(s => s.done).length;
      const total = this.subtasks.length;
      return { total, completed, percent: Math.round((completed / total) * 100) };
    },
    cycleOptions() {
      const opts = [{ value: '', label: 'None' }];
      (this.cycles || []).forEach(c => {
        opts.push({ value: c.id, label: c.name + (c.status === 'active' ? ' (Active)' : '') });
      });
      return opts;
    },
    milestoneOptions() {
      const opts = [{ value: '', label: 'None' }];
      (this.milestones || []).forEach(m => {
        opts.push({ value: m.id, label: (m.icon || '🚩') + ' ' + m.title });
      });
      return opts;
    },
    renderedDesc() {
      if (!this.editDesc) return '<p class="text-zinc-400 italic">No description provided.</p>';
      if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(this.editDesc));
      }
      return this.editDesc;
    },
    blockedByCount() {
      const blocked = (this.relationIncoming || []).filter(r => r.type === 'blocks').length;
      const out = (this.relationOutgoing || []).filter(r => r.type === 'blocked_by').length;
      return blocked + out;
    },
    relationCandidates() {
      const list = Array.isArray(this.issues) ? this.issues : [];
      const q = (this.relationQuery || '').trim().toLowerCase();
      const linked = new Set((this.relationOutgoing || []).map(r => r.issue));
      return list.filter(i => {
        if (!i || i.id === this.issue?.id) return false;
        if (linked.has(i.id)) return false;
        if (!q) return true;
        const hay = `${i.identifier || ''} ${i.title || ''}`.toLowerCase();
        return hay.includes(q);
      }).slice(0, 8);
    },
    relationsByType() {
      const by = { blocks: [], blocked_by: [], related: [] };
      for (const r of (this.relationOutgoing || [])) {
        if (by[r.type]) by[r.type].push(r);
      }
      return by;
    },
    activeSession() {
      if (!this.issue || !this.sessions || this.sessions.length === 0) return null;
      const directMatch = this.sessions.find(s =>
        (s.id && s.id.includes(this.issue.id)) ||
        (s.intention && (s.intention.includes(this.issue.identifier) || s.intention.includes(this.issue.title))) ||
        (s.title && s.title.includes(this.issue.identifier))
      );
      if (directMatch) return directMatch;
      if (this.issue.status === 'in_progress' && (this.issue.assignee === 'flomaster' || !this.issue.assignee)) {
        return this.sessions.find(s => s.is_active) || this.sessions[0] || null;
      }
      return null;
    }
  },
  watch: {
    issue: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.editTitle = newVal.title || '';
          this.editDesc = newVal.description || '';
          this.editStatus = newVal.status || 'backlog';
          this.editPriority = newVal.priority || 'none';
          this.editEstimate = newVal.estimate || 0;
          this.editStartDate = newVal.start_date ? newVal.start_date.split('T')[0] : '';
          this.editDueDate = newVal.due_date ? newVal.due_date.split('T')[0] : '';
          this.editCycle = newVal.cycle || '';
          this.editMilestone = newVal.milestone || '';
          this.editAssignee = newVal.assignee || '';
          this.editLabels = Array.isArray(newVal.labels) ? [...newVal.labels] : [];
          this.subtasks = Array.isArray(newVal.subtasks) ? JSON.parse(JSON.stringify(newVal.subtasks)) : [];
          this.editCustomFields = (newVal.custom_fields && typeof newVal.custom_fields === 'object')
            ? JSON.parse(JSON.stringify(newVal.custom_fields))
            : {};
          this.loadComments();
          this.loadRelations();
        }
      }
    },
    commentRefreshKey() {
      if (this.issue) this.loadComments();
    }
  },
  mounted() {
    try {
      const saved = localStorage.getItem('pb.drawer.width') || localStorage.getItem('projectbase_drawer_width');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 380 && num <= 1600) {
          this.drawerWidth = num;
        }
      }
    } catch (e) {}

    window.addEventListener('mousemove', this.onResizeMove);
    window.addEventListener('mouseup', this.onResizeEnd);
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.onResizeMove);
    window.removeEventListener('mouseup', this.onResizeEnd);
  },
  methods: {
    startResize(e) {
      if (this.isFullscreen) return;
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      const el = this.$el.querySelector('.max-w-3xl, [style*="width"]');
      this.resizeStartWidth = el ? el.getBoundingClientRect().width : (this.drawerWidth || 768);
      document.body.classList.add('select-none');
    },
    onResizeMove(e) {
      if (!this.isResizing) return;
      const delta = this.resizeStartX - e.clientX;
      const newWidth = Math.min(Math.max(this.resizeStartWidth + delta, 380), window.innerWidth * 0.95);
      this.drawerWidth = Math.round(newWidth);
    },
    onResizeEnd() {
      if (!this.isResizing) return;
      this.isResizing = false;
      document.body.classList.remove('select-none');
      if (this.drawerWidth) {
        try {
          localStorage.setItem('pb.drawer.width', String(this.drawerWidth));
          localStorage.setItem('projectbase_drawer_width', String(this.drawerWidth));
        } catch (e) {}
        this.$emit('update:widthOverride', this.drawerWidth);
      }
    },
    resetWidth() {
      this.drawerWidth = null;
      try {
        localStorage.removeItem('pb.drawer.width');
        localStorage.removeItem('projectbase_drawer_width');
      } catch (e) {}
      this.$emit('update:widthOverride', null);
    },
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      if (this.isFullscreen) {
        this.descFocus = false;
      }
    },
    enterDescFocus() {
      this.descFocus = true;
      this.$nextTick(() => {
        const tryFocus = (attempt) => {
          if (!this.descFocus) return;
          const ed = this.$refs.focusMilkdown;
          const el = ed && (ed.$el || ed);
          const pm = el && el.querySelector && el.querySelector('.ProseMirror');
          if (pm) {
            pm.focus();
          } else if (attempt < 10) {
            setTimeout(() => tryFocus(attempt + 1), 50);
          }
        };
        tryFocus(0);
      });
    },
    exitDescFocus() {
      this.descFocus = false;
      this.saveChanges();
    },
    toggleDescFocus() {
      if (this.descFocus) this.exitDescFocus();
      else this.enterDescFocus();
    },
    async loadComments() {
      if (!this.issue) return;
      try {
        this.comments = await API.getComments(this.issue.id);
      } catch (err) {
        console.error('Comments load error:', err);
      }
    },
    async loadRelations() {
      if (!this.issue) return;
      this.relationLoading = true;
      this.relationError = '';
      try {
        const data = await API.getIssueRelations(this.issue.id);
        this.relationOutgoing = Array.isArray(data.outgoing) ? data.outgoing : [];
        this.relationIncoming = Array.isArray(data.incoming) ? data.incoming : [];
      } catch (err) {
        this.relationError = 'Failed to load relationships';
        console.error('Relations load error:', err);
      } finally {
        this.relationLoading = false;
      }
    },
    async addRelation(targetId) {
      if (!this.issue || !targetId) return;
      this.relationLoading = true;
      this.relationError = '';
      try {
        const data = await API.addIssueRelation(this.issue.id, targetId, this.relationType);
        this.relationQuery = '';
        this.relationPickerOpen = false;
        await this.loadRelations();
        this.$emit('relations-changed', {
          id: this.issue.id,
          relations: Array.isArray(data.relations) ? data.relations : [],
          targetId,
          mirrorType: this.mirrorType(this.relationType),
          action: 'add'
        });
      } catch (err) {
        this.relationError = err.message || 'Failed to add relationship';
        console.error('Add relation error:', err);
      } finally {
        this.relationLoading = false;
      }
    },
    async removeRelation(targetId, type) {
      if (!this.issue || !targetId) return;
      this.relationError = '';
      try {
        await API.removeIssueRelation(this.issue.id, targetId, type);
        await this.loadRelations();
        this.$emit('relations-changed', {
          id: this.issue.id,
          relations: this.relationOutgoing.map(r => ({ issue: r.issue, type: r.type })),
          targetId,
          mirrorType: this.mirrorType(type),
          action: 'remove'
        });
      } catch (err) {
        this.relationError = err.message || 'Failed to remove relationship';
        console.error('Remove relation error:', err);
      }
    },
    mirrorType(type) {
      if (type === 'blocks') return 'blocked_by';
      if (type === 'blocked_by') return 'blocks';
      return 'related';
    },
    relationLabel(type) {
      switch (type) {
        case 'blocks': return 'Blocks';
        case 'blocked_by': return 'Blocked by';
        case 'related': return 'Related to';
        default: return type;
      }
    },
    async saveChanges() {
      if (!this.issue) return;
      this.$emit('update-issue', {
        id: this.issue.id,
        title: this.editTitle,
        description: this.editDesc,
        status: this.editStatus,
        priority: this.editPriority,
        estimate: Number(this.editEstimate) || 0,
        start_date: this.editStartDate ? new Date(this.editStartDate).toISOString() : null,
        due_date: this.editDueDate ? new Date(this.editDueDate).toISOString() : null,
        cycle: this.editCycle || null,
        milestone: this.editMilestone || null,
        assignee: this.editAssignee,
        labels: this.editLabels,
        subtasks: this.subtasks,
        custom_fields: this.editCustomFields
      });
    },
    agentAvatar(agent) {
      const a = (this.agents || []).find(x => x.name === agent);
      return a ? a.avatar : null;
    },
    async dispatchAgent(target = 'flomaster', prompt) {
      if (!this.issue) return;
      try {
        const body = { issue_id: this.issue.id, agent_target: target };
        if (prompt && String(prompt).trim()) body.prompt = String(prompt).trim().slice(0, 8000);
        const res = await fetch('/api/projectbase/dispatch-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Dispatch failed');
        this.editStatus = 'in_progress';
        this.editAssignee = data.issue.assignee;
        this.agentPrompt = '';
        await this.loadComments();
      } catch (err) {
        console.error('Agent dispatch failed:', err);
      }
    },
    async generateAiSubtasks() {
      if (!this.editTitle) return;
      this.aiLoadingSubtasks = true;
      try {
        const res = await fetch('/api/projectbase/ai-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'subtasks',
            title: this.editTitle,
            description: this.editDesc
          })
        });
        const data = await res.json();
        if (Array.isArray(data.subtasks)) {
          const newItems = data.subtasks.map(t => ({
            id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: t,
            done: false
          }));
          this.subtasks = [...this.subtasks, ...newItems];
          this.saveChanges();
        }
      } catch (err) {
        console.error('AI subtasks error:', err);
      } finally {
        this.aiLoadingSubtasks = false;
      }
    },
    async polishAiDescription() {
      if (!this.editTitle) return;
      this.aiLoadingDesc = true;
      try {
        const res = await fetch('/api/projectbase/ai-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'description',
            title: this.editTitle,
            description: this.editDesc
          })
        });
        const data = await res.json();
        if (data.description) {
          this.editDesc = data.description;
          this.descTab = 'rich';
          this.saveChanges();
        }
      } catch (err) {
        console.error('AI description polish error:', err);
      } finally {
        this.aiLoadingDesc = false;
      }
    },
    copyIdentifier() {
      if (!this.issue) return;
      navigator.clipboard.writeText(this.issue.identifier || this.issue.id);
      this.copiedBadge = true;
      setTimeout(() => { this.copiedBadge = false; }, 2000);
    },
    copyAgentCurl() {
      if (!this.issue) return;
      const origin = window.location.origin;
      const cmd = `curl -X POST "${origin}/api/projectbase/dispatch-agent" -H "Content-Type: application/json" -d '{"issue_id":"${this.issue.id}","agent_target":"flomaster"}'`;
      navigator.clipboard.writeText(cmd);
      this.copiedBadge = true;
      setTimeout(() => { this.copiedBadge = false; }, 2000);
    },
    copyIssueLink() {
      if (!this.issue) return;
      const url = `${window.location.origin}/#/pb/projects/${this.issue.project}/issue/${this.issue.id}`;
      navigator.clipboard.writeText(url);
      this.copiedLinkBadge = true;
      setTimeout(() => { this.copiedLinkBadge = false; }, 2000);
    },
    addSubtask() {
      if (!this.newSubtaskTitle.trim()) return;
      this.subtasks.push({
        id: 'st_' + Date.now(),
        title: this.newSubtaskTitle.trim(),
        done: false
      });
      this.newSubtaskTitle = '';
      this.saveChanges();
    },
    removeSubtask(index) {
      this.subtasks.splice(index, 1);
      this.saveChanges();
    },
    addLabel(labelName) {
      if (!labelName || this.editLabels.includes(labelName)) return;
      this.editLabels.push(labelName);
      this.saveChanges();
    },
    removeLabel(lbl) {
      this.editLabels = this.editLabels.filter(l => l !== lbl);
      this.saveChanges();
    },
    toolColor(name) {
      if (!name) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
      if (name.includes('edit') || name.includes('write') || name.includes('patch')) {
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60';
      }
      if (name.includes('read') || name.includes('grep') || name.includes('find') || name.includes('ls')) {
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60';
      }
      if (name.includes('bash') || name.includes('cmd') || name.includes('exec')) {
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60';
      }
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
    },
    async submitComment() {
      if (!this.newCommentContent.trim() || !this.issue) return;
      const content = this.newCommentContent.trim();
      try {
        const author = this.newCommentAuthorType === 'agent' ? 'Flomaster Agent' : 'User';
        await API.createComment({
          issue: this.issue.id,
          author: author,
          author_type: this.newCommentAuthorType,
          content: content
        });
        if (this.dispatchToSession && this.activeSession) {
          await this.dispatchAgent(this.issue.assignee || 'flomaster', content);
        }
        this.newCommentContent = '';
        await this.loadComments();
      } catch (err) {
        console.error('Comment creation failed:', err);
      }
    },
    renderCommentBody(content) {
      if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(content || ''));
      }
      return content;
    },
    formatTime(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' +
        d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  },
  template: `
    <div v-if="issue" class="fixed inset-0 z-50 overflow-hidden flex justify-end select-none">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Slide-Over Drawer Container -->
      <div
        :class="isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-[#121215] flex flex-col h-full w-full' : 'relative w-full max-w-3xl bg-white dark:bg-[#121215] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200'"
        :style="drawerStyle"
      >
        <!-- Drag-to-resize handle (hidden in fullscreen; double-click resets) -->
        <div
          v-if="!isFullscreen"
          @mousedown="startResize"
          @dblclick="resetWidth"
          class="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 bg-transparent hover:bg-zinc-400/50 dark:hover:bg-zinc-600/50 transition-colors"
          title="Drag to resize drawer · double-click to reset"
        ></div>

        <!-- Header -->
        <div class="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/60 select-none">
          <div class="flex items-center space-x-2.5">
            <button
              @click="copyIdentifier"
              class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
              title="Click to copy ID"
            >
              <span>{{ issue.identifier }}</span>
              <i data-lucide="copy" class="w-3 h-3 text-zinc-400"></i>
            </button>
            <span v-if="copiedBadge" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Copied!</span>

            <!-- Copy permalink button -->
            <button
              @click="copyIssueLink"
              class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Copy permalink to this issue"
            >
              <i data-lucide="link" class="w-3.5 h-3.5"></i>
            </button>
            <span v-if="copiedLinkBadge" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Link copied!</span>
          </div>

          <!-- Top Drawer Controls -->
          <div class="flex items-center space-x-1">
            <!-- Fullscreen Toggle -->
            <button
              @click="toggleFullscreen"
              class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (Expand)'"
            >
              <i :data-lucide="isFullscreen ? 'minimize-2' : 'maximize-2'" class="w-4 h-4"></i>
            </button>

            <!-- Agent Dispatch Dropdown -->
            <div class="relative">
              <button
                type="button"
                @click="isAgentDropdownOpen = !isAgentDropdownOpen"
                class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
                title="Dispatch this issue to an autonomous agent"
              >
                <span>Trigger Agent</span>
                <i data-lucide="chevron-down" class="w-3 h-3"></i>
              </button>

              <div
                v-if="isAgentDropdownOpen"
                class="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-2 text-xs animate-in fade-in duration-150 space-y-1.5"
              >
                <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Autonomous Agent Dispatch
                </div>

                <div class="space-y-0.5">
                  <button
                    v-for="a in (agents && agents.length ? agents : [{ name: 'flomaster', avatar: '🧠', provider: 'local' }])"
                    :key="a.name"
                    @click="dispatchAgent(a.name, agentPrompt); isAgentDropdownOpen = false;"
                    class="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span>{{ a.avatar || '🤖' }}</span>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold capitalize truncate">{{ a.name }}</div>
                      <div class="text-[10px] text-zinc-400 truncate">{{ a.provider }}</div>
                    </div>
                  </button>
                  <button
                    @click="dispatchAgent('custom', agentPrompt); isAgentDropdownOpen = false;"
                    class="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span>✨</span>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold truncate">Custom Agent</div>
                      <div class="text-[10px] text-zinc-400 truncate">Dispatch with custom prompt</div>
                    </div>
                  </button>
                </div>

                <!-- Custom instruction prompt editor -->
                <div class="pt-1.5 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                  <textarea
                    v-model="agentPrompt"
                    rows="2"
                    maxlength="8000"
                    placeholder="Optional custom instructions for agent..."
                    class="w-full px-2 py-1 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-y"
                  ></textarea>
                  <div class="flex items-center justify-between px-0.5">
                    <span class="text-[9px] text-zinc-400 font-mono">{{ agentPrompt.length }}/8000</span>
                    <button
                      type="button"
                      @click="agentPrompt = ''"
                      class="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >Clear</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Delete Issue -->
            <button
              @click="$emit('delete-issue', issue.id)"
              class="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Delete Issue"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>

            <!-- Close Button -->
            <button
              @click="$emit('close')"
              class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close Drawer (Esc)"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Drawer Body (Scrollable) -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5 text-zinc-800 dark:text-zinc-200 select-text">

          <!-- Title Input -->
          <div class="space-y-1">
            <input
              v-model="editTitle"
              @blur="saveChanges"
              placeholder="Issue title..."
              class="w-full text-lg font-bold bg-transparent text-zinc-900 dark:text-zinc-100 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-500 focus:outline-none transition-colors py-1"
            />
          </div>

          <!-- Metadata Properties Grid (2 columns on desktop) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 select-none">
            <!-- Status -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Status</label>
              <select
                v-model="editStatus"
                @change="saveChanges"
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <!-- Priority -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Priority</label>
              <select
                v-model="editPriority"
                @change="saveChanges"
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <!-- Estimate Points -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Estimate Points</label>
              <input
                v-model="editEstimate"
                type="number"
                min="0"
                @blur="saveChanges"
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <!-- Start Date -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Start Date</label>
              <input
                v-model="editStartDate"
                type="date"
                @change="saveChanges"
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <!-- Due Date -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Due Date</label>
              <input
                v-model="editDueDate"
                type="date"
                @change="saveChanges"
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <!-- Cycle / Sprint -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Cycle</label>
              <searchable-select
                v-model="editCycle"
                :options="cycleOptions"
                placeholder="Select Cycle"
                search-placeholder="Filter cycles..."
                @change="saveChanges"
              ></searchable-select>
            </div>

            <!-- Milestone -->
            <div class="space-y-1">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Milestone</label>
              <searchable-select
                v-model="editMilestone"
                :options="milestoneOptions"
                placeholder="Select Milestone"
                search-placeholder="Filter milestones..."
                @change="saveChanges"
              ></searchable-select>
            </div>

            <!-- Assignee -->
            <div class="space-y-1 sm:col-span-2">
              <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Assignee</label>
              <input
                v-model="editAssignee"
                @blur="saveChanges"
                placeholder="Assign to agent or user..."
                class="w-full px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
              <div v-if="agents && agents.length > 0" class="flex flex-wrap items-center gap-1 pt-1">
                <span class="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">Agents:</span>
                <button
                  v-for="a in agents"
                  :key="a.name"
                  @click="editAssignee = a.name; saveChanges()"
                  class="flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors"
                  :class="editAssignee === a.name ? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500 text-zinc-900 dark:text-white font-semibold' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
                  :title="'Assign to ' + a.name"
                >
                  <span>{{ a.avatar }}</span>
                  <span class="capitalize">{{ a.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Labels Editor -->
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider select-none">Labels</label>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="lbl in editLabels"
                :key="lbl"
                class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium flex items-center space-x-1"
              >
                <span>{{ lbl }}</span>
                <button @click="removeLabel(lbl)" class="hover:text-red-500 ml-1">×</button>
              </span>

              <input
                @keydown.enter.prevent="addLabel($event.target.value); $event.target.value = '';"
                placeholder="+ Add label (press Enter)"
                class="px-2 py-0.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          <!-- Description Section (Milkdown WYSIWYG Editor) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between select-none">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Description</label>
                <div class="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-[11px]">
                  <button
                    @click="descTab = 'rich'"
                    class="px-2 py-0.5 rounded transition-colors"
                    :class="descTab === 'rich' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >WYSIWYG</button>
                  <button
                    @click="descTab = 'raw'"
                    class="px-2 py-0.5 rounded transition-colors"
                    :class="descTab === 'raw' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >Markdown</button>
                  <button
                    @click="descTab = 'preview'"
                    class="px-2 py-0.5 rounded transition-colors"
                    :class="descTab === 'preview' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-2xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'"
                  >Preview</button>
                </div>
              </div>

              <div class="flex items-center space-x-1.5">
                <button
                  @click="toggleDescFocus"
                  class="px-2 py-1 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1 transition-colors"
                  title="Focus mode (distraction-free)"
                >
                  <i data-lucide="expand" class="w-3 h-3"></i>
                  <span>Focus</span>
                </button>
                <button
                  @click="polishAiDescription"
                  :disabled="aiLoadingDesc"
                  class="px-2 py-1 rounded text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 flex items-center space-x-1 transition-colors"
                >
                  <span>{{ aiLoadingDesc ? 'Polishing...' : '✨ Polish AI' }}</span>
                </button>
              </div>
            </div>

            <!-- WYSIWYG Editor Tab -->
            <div v-if="descTab === 'rich'" class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 min-h-[140px]">
              <milkdown-editor
                v-model="editDesc"
                @blur="saveChanges"
              ></milkdown-editor>
            </div>

            <!-- Raw Markdown Tab -->
            <textarea
              v-else-if="descTab === 'raw'"
              v-model="editDesc"
              @blur="saveChanges"
              rows="6"
              placeholder="Write Markdown description..."
              class="w-full p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            ></textarea>

            <!-- Preview Tab -->
            <div
              v-else-if="descTab === 'preview'"
              class="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs markdown-body min-h-[120px]"
              v-html="renderedDesc"
            ></div>
          </div>

          <!-- Subtasks / Checklist Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between select-none">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Checklist Steps</label>
                <span class="text-xs font-mono text-zinc-400">
                  ({{ subtaskStats.completed }}/{{ subtaskStats.total }})
                </span>
              </div>
              <button
                @click="generateAiSubtasks"
                :disabled="aiLoadingSubtasks"
                class="px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-700/60 flex items-center space-x-1 transition-colors"
              >
                <span>{{ aiLoadingSubtasks ? 'Generating...' : '⚡ AI Steps' }}</span>
              </button>
            </div>

            <!-- Progress Bar -->
            <div v-if="subtaskStats.total > 0" class="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all"
                :style="{ width: subtaskStats.percent + '%' }"
              ></div>
            </div>

            <!-- Subtasks List -->
            <div class="space-y-1">
              <div
                v-for="(st, idx) in subtasks"
                :key="st.id || idx"
                class="flex items-center space-x-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 group"
              >
                <input
                  type="checkbox"
                  v-model="st.done"
                  @change="saveChanges"
                  class="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:ring-0 cursor-pointer"
                />
                <input
                  v-model="st.title"
                  @blur="saveChanges"
                  class="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  :class="{ 'line-through text-zinc-400 dark:text-zinc-500': st.done }"
                />
                <button
                  @click="removeSubtask(idx)"
                  class="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>

              <!-- Add subtask input -->
              <div class="flex items-center space-x-2 pt-1">
                <input
                  v-model="newSubtaskTitle"
                  @keydown.enter="addSubtask"
                  placeholder="Add a checklist step... Press Enter"
                  class="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                />
                <button
                  @click="addSubtask"
                  class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium transition-colors shadow-2xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <!-- Issue Relationships (blocks / blocked_by / related) -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between select-none">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Relationships</label>
                <span v-if="relationLoading" class="animate-spin text-[10px]">⏳</span>
                <span v-if="relationOutgoing.length > 0" class="text-xs font-mono text-zinc-500">
                  ({{ relationOutgoing.length }})
                </span>
              </div>
              <span v-if="relationError" class="text-[10px] text-red-500">{{ relationError }}</span>
            </div>

            <!-- Blocks -->
            <div v-if="relationsByType.blocks.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Blocks</div>
              <div
                v-for="r in relationsByType.blocks"
                :key="'rel' + (r.issue || r.target_issue)"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
              >
                <a :href="'#/pb/board/issue/' + (r.issue || r.target_issue)" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-zinc-500 shrink-0">{{ r.target ? r.target.identifier : (r.target_identifier || '') }}</span>
                  <span class="truncate text-xs text-zinc-800 dark:text-zinc-200">{{ r.target ? r.target.title : (r.target_title || '') }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue || r.target_issue, 'blocks')"
                  class="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Remove relation"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Blocked by -->
            <div v-if="relationsByType.blocked_by.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Blocked by</div>
              <div
                v-for="r in relationsByType.blocked_by"
                :key="'rel' + (r.issue || r.target_issue)"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
              >
                <a :href="'#/pb/board/issue/' + (r.issue || r.target_issue)" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-zinc-500 shrink-0">{{ r.target ? r.target.identifier : (r.target_identifier || '') }}</span>
                  <span class="truncate text-xs text-zinc-800 dark:text-zinc-200">{{ r.target ? r.target.title : (r.target_title || '') }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue || r.target_issue, 'blocked_by')"
                  class="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Remove relation"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Related -->
            <div v-if="relationsByType.related.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Related</div>
              <div
                v-for="r in relationsByType.related"
                :key="'rel' + (r.issue || r.target_issue)"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
              >
                <a :href="'#/pb/board/issue/' + (r.issue || r.target_issue)" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-zinc-500 shrink-0">{{ r.target ? r.target.identifier : (r.target_identifier || '') }}</span>
                  <span class="truncate text-xs text-zinc-800 dark:text-zinc-200">{{ r.target ? r.target.title : (r.target_title || '') }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue || r.target_issue, 'related')"
                  class="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Remove relation"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Add relation form -->
            <div class="flex items-center space-x-2 pt-1">
              <select
                v-model="relationType"
                class="px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                title="Relation type"
              >
                <option value="blocks">Blocks</option>
                <option value="blocked_by">Blocked by</option>
                <option value="related">Related</option>
              </select>
              <div class="relative flex-1">
                <input
                  v-model="relationQuery"
                  @focus="relationPickerOpen = true"
                  @keydown.enter="relationCandidates[0] && addRelation(relationCandidates[0].id)"
                  placeholder="Search issues to link..."
                  class="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                <div
                  v-if="relationPickerOpen && relationCandidates.length > 0"
                  class="absolute z-30 mt-1 w-full max-h-44 overflow-y-auto rounded-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 shadow-xl"
                >
                  <button
                    v-for="c in relationCandidates"
                    :key="c.id"
                    @click="addRelation(c.id)"
                    class="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 flex items-center space-x-2 text-xs transition-colors"
                  >
                    <span class="font-mono text-[10px] text-zinc-500 shrink-0">{{ c.identifier }}</span>
                    <span class="truncate text-zinc-800 dark:text-zinc-200">{{ c.title }}</span>
                  </button>
                </div>
                <div
                  v-if="relationPickerOpen && relationQuery && relationCandidates.length === 0"
                  class="absolute z-30 mt-1 w-full p-2 text-center text-xs text-zinc-400 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl"
                >
                  No matching issues found
                </div>
              </div>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- Active Agent Session & Live Reasoning Stream (Multica 2.0) -->
          <!-- ========================================================= -->
          <div v-if="activeSession" class="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center justify-between select-none">
              <div class="flex items-center space-x-2">
                <span class="text-sm">{{ activeSession.avatar || '🧠' }}</span>
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                  Active Session: {{ activeSession.short_name || activeSession.id }}
                </span>
                <span v-if="activeSession.is_active" class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Streaming
                </span>
              </div>
              <span class="text-[10px] font-mono text-zinc-400">{{ activeSession.model }}</span>
            </div>

            <!-- Live Reasoning / Thought Process Box -->
            <div v-if="activeSession.latest_reasoning" class="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-1.5">
              <div class="flex items-center justify-between text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                <span class="flex items-center gap-1">
                  <span>💭</span>
                  <span>Latest Reasoning & Thought</span>
                </span>
                <button
                  type="button"
                  @click="showFullReasoning = !showFullReasoning"
                  class="text-[10px] hover:underline"
                >
                  {{ showFullReasoning ? 'Collapse' : 'Expand' }}
                </button>
              </div>
              <p
                class="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans"
                :class="showFullReasoning ? 'whitespace-pre-wrap' : 'line-clamp-3'"
              >
                {{ activeSession.latest_reasoning }}
              </p>
            </div>

            <!-- Recent Tool Executions Pill List -->
            <div v-if="activeSession.recent_tools && activeSession.recent_tools.length > 0" class="flex flex-wrap gap-1">
              <span class="text-[10px] text-zinc-400 self-center uppercase font-semibold mr-1">Tools:</span>
              <span
                v-for="(t, ti) in activeSession.recent_tools.slice(0, 5)"
                :key="ti"
                class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                :class="toolColor(t.name)"
                :title="t.input"
              >
                {{ t.name }}
              </span>
            </div>
          </div>

          <!-- Comments & Activity Stream -->
          <div class="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <h4 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider select-none">Comments & Agent Audit Stream</h4>

            <!-- Comment Form -->
            <div class="p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div class="flex items-center justify-between select-none">
                <span class="text-xs text-zinc-500 font-medium">Post as:</span>
                <div class="flex items-center space-x-2 text-xs">
                  <label class="flex items-center space-x-1 cursor-pointer">
                    <input type="radio" v-model="newCommentAuthorType" value="user" class="text-zinc-900 dark:text-zinc-100 focus:ring-0" />
                    <span class="text-zinc-700 dark:text-zinc-300">User</span>
                  </label>
                  <label class="flex items-center space-x-1 cursor-pointer">
                    <input type="radio" v-model="newCommentAuthorType" value="agent" class="text-zinc-900 dark:text-zinc-100 focus:ring-0" />
                    <span class="text-zinc-900 dark:text-zinc-200 font-semibold">AI Agent</span>
                  </label>
                </div>
              </div>

              <textarea
                v-model="newCommentContent"
                @keydown.ctrl.enter="submitComment"
                @keydown.meta.enter="submitComment"
                rows="2"
                placeholder="Add execution note or update... (Cmd+Enter to send)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
              ></textarea>

              <div class="flex items-center justify-between pt-1">
                <label v-if="activeSession" class="flex items-center space-x-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                  <input type="checkbox" v-model="dispatchToSession" class="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100" />
                  <span>⚡ Continue discussion in active session</span>
                </label>
                <div v-else></div>

                <button
                  @click="submitComment"
                  :disabled="!newCommentContent.trim()"
                  class="px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-xs font-semibold shadow-2xs transition-colors"
                >
                  Post Comment
                </button>
              </div>
            </div>

            <!-- Comment List -->
            <div class="space-y-2">
              <div
                v-for="c in comments"
                :key="c.id"
                class="p-3 rounded-xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
              >
                <div class="flex items-center justify-between text-xs select-none">
                  <div class="flex items-center space-x-1.5">
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase font-mono"
                      :class="c.author_type === 'agent' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'"
                    >
                      {{ c.author_type }}
                    </span>
                    <span class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{{ c.author }}</span>
                  </div>
                  <span class="text-[11px] font-mono text-zinc-400">{{ formatTime(c.created) }}</span>
                </div>

                <div class="text-xs text-zinc-800 dark:text-zinc-200 markdown-body" v-html="renderCommentBody(c.content)"></div>
              </div>

              <div v-if="comments.length === 0" class="py-4 text-center text-zinc-400 text-xs">
                No comments or agent logs on this issue yet.
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Distraction-free Description Focus Mode -->
      <div
        v-if="descFocus"
        class="fixed inset-0 z-[60] bg-white dark:bg-[#09090b] flex flex-col"
        @keydown.esc.stop="exitDescFocus"
      >
        <!-- Focus header -->
        <div class="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/80 select-none">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold shrink-0">
              {{ issue.identifier }}
            </span>
            <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{{ editTitle || 'Untitled issue' }}</span>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button
              @click="polishAiDescription"
              :disabled="aiLoadingDesc"
              class="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center space-x-1 transition-colors"
            >
              <span>{{ aiLoadingDesc ? 'Polishing...' : '✨ Polish AI' }}</span>
            </button>
            <button
              @click="exitDescFocus"
              class="px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold transition-colors shadow-2xs"
            >
              Done (Esc)
            </button>
          </div>
        </div>

        <!-- Focus editor body -->
        <div class="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          <milkdown-editor
            ref="focusMilkdown"
            v-model="editDesc"
            @blur="saveChanges"
          ></milkdown-editor>
        </div>
      </div>
    </div>
  `
};
