// pb_public/js/components/IssueDrawer.js

const IssueDrawerComponent = {
  components: {
    'milkdown-editor': window.MilkdownEditorComponent || MilkdownEditorComponent,
    'searchable-select': window.SearchableSelectComponent || SearchableSelectComponent
  },
  props: ['issue', 'projects', 'cycles', 'labels', 'fieldDefs', 'milestones', 'issues', 'widthOverride'],
  emits: ['close', 'update-issue', 'delete-issue', 'relations-changed', 'update:widthOverride'],
  data() {
    return {
      editTitle: '',
      editDesc: '',
      editStatus: 'backlog',
      editPriority: 'none',
      editEstimate: 0,
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
      copiedBadge: false,
      copiedLinkBadge: false,
      isAgentDropdownOpen: false,
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
      drawerWidth: null, // persisted user-resized width (px); null = default max-w-3xl
      isResizing: false
    };
  },
  computed: {
    drawerStyle() {
      if (this.isFullscreen || !this.drawerWidth) return null;
      const maxW = Math.max(360, Math.min(1280, window.innerWidth - 64));
      const w = Math.min(this.drawerWidth, maxW);
      return { width: w + 'px', maxWidth: '95vw' };
    },
    renderedDescription() {
      if (!this.editDesc) return '<p class="text-gray-500 italic">No description provided. Click write to add details.</p>';
      if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(this.editDesc));
      }
      return this.editDesc;
    },
    subtaskStats() {
      const total = this.subtasks.length;
      const completed = this.subtasks.filter(s => s.done).length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, percent };
    },
    fieldDefsNormalized() {
      let defs = this.fieldDefs;
      if (typeof defs === 'string') { try { defs = JSON.parse(defs); } catch (e) { defs = []; } }
      return Array.isArray(defs) ? defs : [];
    },
    blockedByCount() {
      const blocked = this.relationIncoming.filter(r => r.type === 'blocks').length;
      const out = this.relationOutgoing.filter(r => r.type === 'blocked_by').length;
      return blocked + out;
    },
    relationCandidates() {
      const list = Array.isArray(this.issues) ? this.issues : [];
      const q = this.relationQuery.trim().toLowerCase();
      const linked = new Set(this.relationOutgoing.map(r => r.issue));
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
      for (const r of this.relationOutgoing) {
        if (by[r.type]) by[r.type].push(r);
      }
      return by;
    },
    projectMilestones() {
      const list = Array.isArray(this.milestones) ? this.milestones : [];
      const proj = this.issue && this.issue.project ? this.issue.project : null;
      if (!proj) return list;
      return list.filter(m => !m.project || m.project === proj);
    },
    statusOptions() {
      return [
        { value: 'backlog', label: 'Backlog', icon: '📥' },
        { value: 'todo', label: 'Todo', icon: '📋' },
        { value: 'in_progress', label: 'In Progress', icon: '⚡' },
        { value: 'in_review', label: 'In Review', icon: '👀' },
        { value: 'done', label: 'Done', icon: '✅' },
        { value: 'cancelled', label: 'Cancelled', icon: '🚫' }
      ];
    },
    priorityOptions() {
      return [
        { value: 'urgent', label: 'Urgent', icon: '🔴', color: '#ef4444' },
        { value: 'high', label: 'High', icon: '🟠', color: '#f97316' },
        { value: 'medium', label: 'Medium', icon: '🟡', color: '#eab308' },
        { value: 'low', label: 'Low', icon: '🔵', color: '#3b82f6' },
        { value: 'none', label: 'None', icon: '⚪', color: '#6b7280' }
      ];
    },
    cycleOptions() {
      const opts = [{ value: '', label: 'No Cycle', icon: '⭕' }];
      (this.cycles || []).forEach(c => {
        opts.push({
          value: c.id,
          label: c.name || `Cycle ${c.number}`,
          icon: '🔄',
          badge: c.status ? c.status.toUpperCase() : null
        });
      });
      return opts;
    },
    milestoneOptions() {
      const opts = [{ value: '', label: 'No Milestone', icon: '⚬' }];
      (this.projectMilestones || []).forEach(m => {
        opts.push({
          value: m.id,
          label: m.name || 'Milestone',
          icon: '🎯',
          badge: m.status ? m.status.toUpperCase() : null
        });
      });
      return opts;
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
          this.editDueDate = newVal.due_date ? newVal.due_date.substring(0, 10) : '';
          this.editCycle = newVal.cycle || '';
          this.editMilestone = newVal.milestone || '';
          this.editAssignee = newVal.assignee || '';
          this.editLabels = Array.isArray(newVal.labels) ? [...newVal.labels] : [];
          this.subtasks = Array.isArray(newVal.subtasks) ? JSON.parse(JSON.stringify(newVal.subtasks)) : [];
          let cf = newVal.custom_fields;
          if (typeof cf === 'string') { try { cf = JSON.parse(cf); } catch (e) { cf = {}; } }
          this.editCustomFields = (cf && typeof cf === 'object' && !Array.isArray(cf)) ? { ...cf } : {};
          this.loadComments();
          this.loadRelations();
        }
      }
    },
    // Live ?w= URL param: clamped 360-1280 like the drag handle. While an
    // override is active the URL wins; any manual resize clears it so the
    // user's localStorage preference takes back over.
    widthOverride: {
      immediate: true,
      handler(v) {
        const w = parseInt(v, 10);
        if (!isNaN(w) && w >= 360 && w <= 1280) this.drawerWidth = w;
      }
    }
  },
  mounted() {
    const saved = parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('pb.drawer.width')) || '', 10);
    if (!isNaN(saved) && saved >= 360 && saved <= 1280) this.drawerWidth = saved;
    // URL ?w= overrides the saved width for this deep link (not persisted).
    if (this.widthOverride) {
      const w = parseInt(this.widthOverride, 10);
      if (!isNaN(w) && w >= 360 && w <= 1280) this.drawerWidth = w;
    }
    this.$nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  beforeUnmount() {
    this.stopResize();
  },
  updated() {
    this.$nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  },
  methods: {
    startResize(e) {
      if (this.isFullscreen) return;
      e.preventDefault();
      this.isResizing = true;
      document.body.classList.add('select-none');
      this._resizeMove = (ev) => this.onResizeMove(ev);
      this._resizeUp = () => this.stopResize();
      window.addEventListener('mousemove', this._resizeMove);
      window.addEventListener('mouseup', this._resizeUp);
    },
    onResizeMove(e) {
      if (!this.isResizing) return;
      const maxW = Math.max(360, Math.min(1280, window.innerWidth - 64));
      const w = window.innerWidth - e.clientX;
      this.drawerWidth = Math.round(Math.min(Math.max(w, 360), maxW));
    },
    stopResize() {
      if (!this.isResizing) return;
      this.isResizing = false;
      document.body.classList.remove('select-none');
      window.removeEventListener('mousemove', this._resizeMove);
      window.removeEventListener('mouseup', this._resizeUp);
      try {
        if (this.drawerWidth) localStorage.setItem('pb.drawer.width', String(this.drawerWidth));
      } catch (err) { /* private mode: ignore */ }
      // Manual resize ends any ?w= URL override; localStorage is the source of truth again.
      this.$emit('update:widthOverride', null);
    },
    resetWidth() {
      this.stopResize();
      this.drawerWidth = null;
      try {
        localStorage.removeItem('pb.drawer.width');
      } catch (err) { /* private mode: ignore */ }
      this.$emit('update:widthOverride', null);
    },
    enterDescFocus() {
      this.descFocus = true;
      this.descTab = 'rich';
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
        // Focus the Milkdown editor root so typing starts immediately. The
        // editor mounts asynchronously (crepe.create()), so retry briefly.
        const tryFocus = (attempt) => {
          const root = document.querySelector('.fixed.inset-0.z-\\[60\\] [contenteditable="true"]');
          if (root && root.focus) { root.focus(); return; }
          if (attempt < 30) setTimeout(() => tryFocus(attempt + 1), 100);
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
    saveChanges() {
      if (!this.issue) return;
      this.$emit('update-issue', {
        id: this.issue.id,
        title: this.editTitle,
        description: this.editDesc,
        status: this.editStatus,
        priority: this.editPriority,
        estimate: Number(this.editEstimate) || 0,
        due_date: this.editDueDate ? new Date(this.editDueDate).toISOString() : null,
        cycle: this.editCycle || null,
        milestone: this.editMilestone || null,
        assignee: this.editAssignee,
        labels: this.editLabels,
        subtasks: this.subtasks,
        custom_fields: this.editCustomFields
      });
    },
    async dispatchAgent(target = 'flomaster') {
      if (!this.issue) return;
      try {
        const res = await fetch('/api/projectbase/dispatch-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: this.issue.id, agent_target: target })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Dispatch failed');
        this.editStatus = 'in_progress';
        this.editAssignee = data.issue.assignee;
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
            action: 'generate_subtasks',
            title: this.editTitle,
            description: this.editDesc
          })
        });
        const data = await res.json();
        if (data.subtasks && Array.isArray(data.subtasks)) {
          for (const s of data.subtasks) {
            this.subtasks.push({
              id: 'st_' + Date.now() + Math.random().toString(36).substring(2, 5),
              title: s,
              done: false
            });
          }
          this.saveChanges();
        }
      } catch (err) {
        console.error('AI subtask error:', err);
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
            action: 'polish_description',
            title: this.editTitle,
            description: this.editDesc
          })
        });
        const data = await res.json();
        if (data.description) {
          this.editDesc = data.description;
          this.descTab = 'preview';
          this.saveChanges();
        }
      } catch (err) {
        console.error('AI polish error:', err);
      } finally {
        this.aiLoadingDesc = false;
      }
    },
    toggleSubtask(sub) {
      sub.done = !sub.done;
      this.saveChanges();
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
    async submitComment() {
      if (!this.newCommentContent.trim() || !this.issue) return;
      try {
        const author = this.newCommentAuthorType === 'agent' ? 'Flomaster Agent' : 'User';
        await API.createComment({
          issue: this.issue.id,
          author: author,
          author_type: this.newCommentAuthorType,
          content: this.newCommentContent.trim()
        });
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
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },
    copyIdentifier() {
      if (!this.issue) return;
      navigator.clipboard.writeText(this.issue.identifier);
      this.copiedBadge = true;
      setTimeout(() => { this.copiedBadge = false; }, 2000);
    },
    copyAgentCurl() {
      if (!this.issue) return;
      const cmd = `curl -X PATCH ${window.location.origin}/api/collections/issues/records/${this.issue.id} \\
  -H "Content-Type: application/json" \\
  -d '{"status":"done"}'`;
      navigator.clipboard.writeText(cmd);
      alert('Copied Agent cURL command to clipboard!');
    },
    copyIssueLink() {
      if (!this.issue) return;
      // Deep link straight to this card: hash route opens the drawer on reload.
      const url = `${window.location.origin}${window.location.pathname}#/pb/board/issue/${this.issue.id}`;
      navigator.clipboard.writeText(url);
      this.copiedLinkBadge = true;
      setTimeout(() => { this.copiedLinkBadge = false; }, 2000);
    }
  },
  template: `
    <div v-if="issue" class="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Slide-Over Drawer Container -->
      <div :class="isFullscreen ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col h-full w-full' : 'relative w-full max-w-3xl bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200'" :style="drawerStyle">

        <!-- Drag-to-resize handle (hidden in fullscreen; double-click resets) -->
        <div
          v-if="!isFullscreen"
          @mousedown="startResize"
          @dblclick="resetWidth"
          class="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500/70 transition-colors"
          title="Drag to resize drawer · double-click to reset"
        ></div>
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60 select-none">
          <div class="flex items-center space-x-3">
            <button 
              @click="copyIdentifier"
              class="px-2.5 py-1 rounded-md bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/40 text-indigo-400 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              title="Click to copy ID"
            >
              <span>{{ issue.identifier }}</span>
              <i data-lucide="copy" class="w-3 h-3 text-indigo-400"></i>
            </button>

            <span v-if="copiedBadge" class="text-[10px] text-emerald-400 font-medium animate-pulse">Copied!</span>

            <span
              v-if="blockedByCount > 0"
              class="px-2 py-0.5 rounded-md bg-red-950/70 border border-red-800/60 text-red-300 text-[10px] font-semibold flex items-center space-x-1"
              title="This issue is blocked by another issue"
            >
              <i data-lucide="lock" class="w-3 h-3"></i>
              <span>Blocked{{ blockedByCount > 1 ? ' x' + blockedByCount : '' }}</span>
            </span>

            <span v-if="issue.expand && issue.expand.project" class="text-xs text-gray-400 font-medium">
              {{ issue.expand.project.name }}
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <!-- Share / Copy deep link -->
            <button
              @click="copyIssueLink"
              class="px-2.5 py-1 rounded-md text-[11px] font-mono text-sky-300 hover:text-white bg-sky-950/60 hover:bg-sky-900/70 border border-sky-800/40 transition-colors flex items-center space-x-1.5 shadow-sm select-none"
              title="Copy direct link to this card"
            >
              <i data-lucide="link" class="w-3 h-3"></i>
              <span>Copy Link</span>
              <span v-if="copiedLinkBadge" class="text-[10px] text-emerald-400 font-semibold animate-pulse">✓</span>
            </button>
            <!-- Agent Dispatch Controls -->
            <div class="relative">
              <button
                type="button"
                @click="isAgentDropdownOpen = !isAgentDropdownOpen"
                class="px-2.5 py-1 rounded-md text-[11px] font-mono text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/70 border border-purple-800/40 transition-colors flex items-center space-x-1.5 shadow-sm select-none"
                title="Dispatch this issue to an autonomous agent"
              >
                <i data-lucide="bot" class="w-3 h-3"></i>
                <span>Trigger Agent</span>
                <span class="text-[9px] transition-transform duration-150" :class="{ 'rotate-180': isAgentDropdownOpen }">▼</span>
              </button>
              <div
                v-show="isAgentDropdownOpen"
                class="absolute right-0 top-full mt-1.5 w-48 p-1.5 rounded-xl bg-gray-900/95 border border-gray-700 shadow-2xl backdrop-blur-md z-30 space-y-0.5"
                @click.stop
              >
                <div class="px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800/80 mb-1">
                  Autonomous Dispatch
                </div>
                <button
                  @click="dispatchAgent('flomaster'); isAgentDropdownOpen = false;"
                  class="w-full flex items-center space-x-2 text-left px-2 py-1.5 text-xs text-gray-200 hover:bg-purple-950/60 hover:text-purple-300 rounded-lg transition-colors"
                >
                  <span class="text-sm">⚡</span>
                  <div>
                    <div class="font-medium">Flomaster</div>
                    <div class="text-[10px] text-gray-500">Autonomous loop</div>
                  </div>
                </button>
                <button
                  @click="dispatchAgent('hermes'); isAgentDropdownOpen = false;"
                  class="w-full flex items-center space-x-2 text-left px-2 py-1.5 text-xs text-gray-200 hover:bg-purple-950/60 hover:text-purple-300 rounded-lg transition-colors"
                >
                  <span class="text-sm">🪽</span>
                  <div>
                    <div class="font-medium">Hermes</div>
                    <div class="text-[10px] text-gray-500">Subtask solver</div>
                  </div>
                </button>
                <button
                  @click="dispatchAgent('windmill'); isAgentDropdownOpen = false;"
                  class="w-full flex items-center space-x-2 text-left px-2 py-1.5 text-xs text-gray-200 hover:bg-purple-950/60 hover:text-purple-300 rounded-lg transition-colors"
                >
                  <span class="text-sm">🌬️</span>
                  <div>
                    <div class="font-medium">Windmill Flow</div>
                    <div class="text-[10px] text-gray-500">Scheduled worker</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Agent cURL Helper -->
            <button 
              @click="copyAgentCurl"
              class="px-2 py-1 rounded-md text-[11px] font-mono text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors flex items-center space-x-1"
              title="Copy Agent REST cURL snippet"
            >
              <i data-lucide="terminal" class="w-3 h-3"></i>
              <span>Agent API</span>
            </button>

            <!-- Delete Button -->
            <button 
              @click="$emit('delete-issue', issue.id); $emit('close');"
              class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
              title="Delete Issue"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>

            <!-- Fullscreen Toggle -->
            <button
              @click="isFullscreen = !isFullscreen"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
            >
              <i :data-lucide="isFullscreen ? 'minimize-2' : 'maximize-2'" class="w-4 h-4"></i>
            </button>

            <!-- Close Button -->
            <button 
              @click="$emit('close')"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Body: Scrollable Content & Sidebar Grid -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          
          <!-- Title Input -->
          <div>
            <input 
              v-model="editTitle"
              @blur="saveChanges"
              @keydown.enter="$event.target.blur()"
              placeholder="Issue title..."
              class="w-full text-xl font-bold bg-transparent text-white border-b border-transparent hover:border-gray-800 focus:border-indigo-500 focus:outline-none transition-colors py-1"
            />
          </div>

          <!-- Properties Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-950/60 border border-gray-800 text-xs">
            <!-- Status -->
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Status</label>
              <searchable-select
                v-model="editStatus"
                :options="statusOptions"
                placeholder="Select Status"
                :searchable="false"
                @change="saveChanges"
              ></searchable-select>
            </div>

            <!-- Priority -->
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Priority</label>
              <searchable-select
                v-model="editPriority"
                :options="priorityOptions"
                placeholder="Select Priority"
                :searchable="false"
                @change="saveChanges"
              ></searchable-select>
            </div>

            <!-- Estimate -->
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Estimate (Pts)</label>
              <input
                type="number"
                v-model.number="editEstimate"
                @blur="saveChanges"
                min="0"
                max="100"
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <!-- Due Date -->
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                v-model="editDueDate"
                @change="saveChanges"
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <!-- Cycle / Sprint -->
            <div class="space-y-1 sm:col-span-2">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Sprint Cycle</label>
              <searchable-select
                v-model="editCycle"
                :options="cycleOptions"
                placeholder="Select Sprint Cycle"
                search-placeholder="Filter cycles..."
                @change="saveChanges"
              ></searchable-select>
            </div>

            <!-- Milestone -->
            <div class="space-y-1 sm:col-span-2">
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Milestone</label>
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
              <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Assignee</label>
              <input
                v-model="editAssignee"
                @blur="saveChanges"
                placeholder="Assign to agent or user..."
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Labels Manager -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Labels & Tags</label>
            </div>
            
            <div class="flex flex-wrap items-center gap-1.5">
              <span 
                v-for="lbl in editLabels" 
                :key="lbl"
                class="px-2 py-1 rounded-md bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 text-xs font-medium flex items-center space-x-1.5"
              >
                <span>{{ lbl }}</span>
                <button @click="removeLabel(lbl)" class="hover:text-red-400 transition-colors">
                  <i data-lucide="x" class="w-3 h-3"></i>
                </button>
              </span>

              <!-- Quick add label dropdown / preset buttons -->
              <button 
                v-for="preset in ['feature', 'bug', 'core', 'frontend', 'api', 'infra', 'agent']"
                :key="preset"
                v-show="!editLabels.includes(preset)"
                @click="addLabel(preset)"
                class="px-2 py-0.5 rounded text-[11px] bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                +{{ preset }}
              </button>
            </div>
          </div>

          <!-- Custom Fields -->
          <div v-if="fieldDefsNormalized.length" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Fields</label>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div v-for="f in fieldDefsNormalized" :key="f.key" class="space-y-1">
                <label class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                  {{ f.label }} <span v-if="f.required" class="text-red-400">*</span>
                </label>

                <input
                  v-if="f.type === 'text'"
                  v-model="editCustomFields[f.key]"
                  @blur="saveChanges"
                  placeholder="—"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <input
                  v-else-if="f.type === 'number'"
                  v-model.number="editCustomFields[f.key]"
                  @blur="saveChanges"
                  type="number"
                  placeholder="—"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <select
                  v-else-if="f.type === 'select'"
                  v-model="editCustomFields[f.key]"
                  @change="saveChanges"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">—</option>
                  <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>

                <label v-else-if="f.type === 'checkbox'" class="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" v-model="editCustomFields[f.key]" @change="saveChanges" class="accent-indigo-500" />
                  {{ editCustomFields[f.key] ? 'Yes' : 'No' }}
                </label>

                <input
                  v-else-if="f.type === 'date'"
                  v-model="editCustomFields[f.key]"
                  @change="saveChanges"
                  type="date"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <!-- Description Section (Write & Preview Tabs & AI Polish) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between border-b border-gray-800 pb-1.5">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</label>
                <button 
                  @click="polishAiDescription"
                  :disabled="aiLoadingDesc"
                  class="px-2 py-0.5 rounded-md bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-[11px] font-medium flex items-center space-x-1 transition-all"
                  title="Enhance description into structured PRD with Acceptance Criteria"
                >
                  <span v-if="aiLoadingDesc" class="animate-spin text-xs">🌀</span>
                  <span v-else>✨</span>
                  <span>{{ aiLoadingDesc ? 'Generating...' : 'AI Enhance PRD' }}</span>
                </button>
                <button
                  @click="toggleDescFocus"
                  class="px-2 py-0.5 rounded-md bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[11px] font-medium flex items-center space-x-1 transition-all"
                  :title="descFocus ? 'Exit focus mode (Esc)' : 'Open distraction-free focus mode'"
                >
                  <i :data-lucide="descFocus ? 'minimize-2' : 'maximize-2'" class="w-3 h-3"></i>
                  <span>{{ descFocus ? 'Exit Focus' : 'Focus' }}</span>
                </button>
              </div>
              
              <div class="flex items-center bg-gray-950 p-0.5 rounded-lg border border-gray-800 text-xs">
                <button
                  @click="descTab = 'rich'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'rich' || descTab === 'write' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Rich
                </button>
                <button
                  @click="descTab = 'raw'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'raw' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Raw
                </button>
                <button
                  @click="descTab = 'preview'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Preview
                </button>
              </div>
            </div>

            <!-- Rich Mode (Milkdown WYSIWYG) -->
            <div v-show="descTab === 'rich' || descTab === 'write'">
              <milkdown-editor
                v-model="editDesc"
                @blur="saveChanges"
                placeholder="Detailed markdown description, requirements, architecture notes..."
                class="w-full min-h-[140px] px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-gray-100 text-xs focus-within:ring-1 focus-within:ring-indigo-500 leading-relaxed"
              ></milkdown-editor>
            </div>

            <!-- Raw Mode (Monospace Textarea) -->
            <div v-show="descTab === 'raw'">
              <textarea
                v-model="editDesc"
                @blur="saveChanges"
                rows="6"
                placeholder="Detailed markdown description, requirements, architecture notes..."
                class="w-full px-3 py-2 rounded-xl bg-gray-950/80 border border-gray-800 text-gray-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              ></textarea>
            </div>
            <!-- Preview Mode -->
            <div 
              v-show="descTab === 'preview'"
              class="p-4 rounded-xl bg-gray-950/80 border border-gray-800 min-h-[140px] markdown-body"
              v-html="renderedDescription"
            ></div>
          </div>

          <!-- Subtasks / Checklist -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Checklist & Subtasks</label>
                <button 
                  @click="generateAiSubtasks"
                  :disabled="aiLoadingSubtasks"
                  class="px-2 py-0.5 rounded-md bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-[11px] font-medium flex items-center space-x-1 transition-all"
                  title="Automatically generate sequential checklist steps with AI"
                >
                  <span v-if="aiLoadingSubtasks" class="animate-spin text-xs">🌀</span>
                  <span v-else>✨</span>
                  <span>{{ aiLoadingSubtasks ? 'Generating...' : 'AI Auto-Breakdown' }}</span>
                </button>
                <span v-if="subtaskStats.total > 0" class="text-xs font-mono text-indigo-400">
                  ({{ subtaskStats.completed }}/{{ subtaskStats.total }})
                </span>
              </div>

              <span v-if="subtaskStats.total > 0" class="text-xs font-mono text-gray-400">
                {{ subtaskStats.percent }}% complete
              </span>
            </div>

            <!-- Progress bar -->
            <div v-if="subtaskStats.total > 0" class="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden">
              <div class="bg-indigo-500 h-full rounded-full transition-all" :style="{ width: subtaskStats.percent + '%' }"></div>
            </div>

            <!-- Subtask items list -->
            <div class="space-y-1.5">
              <div 
                v-for="(sub, idx) in subtasks" 
                :key="sub.id"
                class="group flex items-center justify-between p-2 rounded-lg bg-gray-950/60 border border-gray-800/80 hover:border-gray-700 text-xs transition-colors"
              >
                <div class="flex items-center space-x-2.5 min-w-0">
                  <input 
                    type="checkbox" 
                    :checked="sub.done" 
                    @change="toggleSubtask(sub)"
                    class="w-4 h-4 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span class="truncate" :class="{ 'line-through text-gray-500': sub.done, 'text-gray-200': !sub.done }">
                    {{ sub.title }}
                  </span>
                </div>

                <button 
                  @click="removeSubtask(idx)"
                  class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
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
                  class="flex-1 px-3 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button 
                  @click="addSubtask"
                  class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <!-- Issue Relationships (blocks / blocked_by / related) -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Relationships</label>
                <span v-if="relationLoading" class="animate-spin text-[10px]">⏳</span>
                <span v-if="relationOutgoing.length > 0" class="text-xs font-mono text-indigo-400">
                  ({{ relationOutgoing.length }})
                </span>
              </div>
              <span v-if="relationError" class="text-[10px] text-red-400">{{ relationError }}</span>
            </div>

            <!-- Blocks -->
            <div v-if="relationsByType.blocks.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Blocks</div>
              <div
                v-for="r in relationsByType.blocks"
                :key="'blk' + r.issue"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800"
              >
                <a :href="'#/pb/board/issue/' + r.issue" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-amber-400 shrink-0">{{ r.target.identifier }}</span>
                  <span class="truncate text-xs text-gray-200">{{ r.target.title }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue, 'blocks')"
                  class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Blocked by -->
            <div v-if="relationsByType.blocked_by.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-red-400/80 font-medium uppercase tracking-wider">Blocked by</div>
              <div
                v-for="r in relationsByType.blocked_by"
                :key="'blb' + r.issue"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40"
              >
                <a :href="'#/pb/board/issue/' + r.issue" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-red-400 shrink-0">{{ r.target.identifier }}</span>
                  <span class="truncate text-xs text-gray-200">{{ r.target.title }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue, 'blocked_by')"
                  class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Related -->
            <div v-if="relationsByType.related.length > 0" class="space-y-1.5">
              <div class="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Related</div>
              <div
                v-for="r in relationsByType.related"
                :key="'rel' + r.issue"
                class="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800"
              >
                <a :href="'#/pb/board/issue/' + r.issue" class="flex items-center space-x-2 min-w-0">
                  <span class="font-mono text-[10px] text-indigo-400 shrink-0">{{ r.target.identifier }}</span>
                  <span class="truncate text-xs text-gray-200">{{ r.target.title }}</span>
                </a>
                <button
                  @click="removeRelation(r.issue, 'related')"
                  class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Add relation form -->
            <div class="flex items-center space-x-2 pt-1">
              <select
                v-model="relationType"
                class="px-2 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  class="w-full px-3 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div
                  v-if="relationPickerOpen && relationCandidates.length > 0"
                  class="absolute z-30 mt-1 w-full max-h-44 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 shadow-xl"
                >
                  <button
                    v-for="c in relationCandidates"
                    :key="c.id"
                    @click="addRelation(c.id)"
                    class="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center space-x-2 text-xs"
                  >
                    <span class="font-mono text-[10px] text-indigo-400 shrink-0">{{ c.identifier }}</span>
                    <span class="truncate text-gray-200">{{ c.title }}</span>
                  </button>
                </div>
                <div
                  v-else-if="relationPickerOpen && relationQuery && relationCandidates.length === 0"
                  class="absolute z-30 mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 shadow-xl px-3 py-2 text-[11px] text-gray-500"
                >
                  No matching issues
                </div>
              </div>
              <button
                @click="relationCandidates[0] && addRelation(relationCandidates[0].id)"
                :disabled="relationLoading || relationCandidates.length === 0"
                class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                Link
              </button>
            </div>
          </div>

          <!-- Comments & Activity Timeline -->
          <div class="space-y-4 pt-4 border-t border-gray-800">
            <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Comments & Agent Audit Stream</h4>
            
            <!-- Comment Form -->
            <div class="p-3 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400 font-medium">Post as:</span>
                <div class="flex items-center space-x-2 text-xs">
                  <label class="flex items-center space-x-1 cursor-pointer">
                    <input type="radio" v-model="newCommentAuthorType" value="user" class="text-indigo-600 focus:ring-0" />
                    <span class="text-gray-300">User</span>
                  </label>
                  <label class="flex items-center space-x-1 cursor-pointer">
                    <input type="radio" v-model="newCommentAuthorType" value="agent" class="text-indigo-600 focus:ring-0" />
                    <span class="text-purple-400 font-medium">AI Agent</span>
                  </label>
                </div>
              </div>

              <textarea 
                v-model="newCommentContent"
                @keydown.ctrl.enter="submitComment"
                @keydown.meta.enter="submitComment"
                rows="2"
                placeholder="Add execution note or update... (Cmd+Enter to send)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              ></textarea>

              <div class="flex items-center justify-end">
                <button 
                  @click="submitComment"
                  class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-all"
                >
                  Send
                </button>
              </div>
            </div>

            <!-- Comments Timeline List -->
            <div class="space-y-3">
              <div 
                v-for="c in comments" 
                :key="c.id"
                class="p-3.5 rounded-xl border bg-gray-950/60 border-gray-800/80 space-y-2"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span 
                      class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase"
                      :class="c.author_type === 'agent' ? 'bg-purple-950 text-purple-300 border border-purple-800/40' : 'bg-blue-950 text-blue-300 border border-blue-800/40'"
                    >
                      {{ c.author_type }}
                    </span>
                    <span class="text-xs font-semibold text-gray-200">{{ c.author }}</span>
                  </div>
                  <span class="text-[11px] font-mono text-gray-500">{{ formatTime(c.created) }}</span>
                </div>

                <div class="text-xs text-gray-300 markdown-body" v-html="renderCommentBody(c.content)"></div>
              </div>

              <div v-if="comments.length === 0" class="py-4 text-center text-gray-500 text-xs">
                No comments or agent logs on this issue yet.
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Distraction-free Description Focus Mode -->
      <div
        v-if="descFocus"
        class="fixed inset-0 z-[60] bg-gray-950 flex flex-col"
        @keydown.esc.stop="exitDescFocus"
      >
        <!-- Focus header -->
        <div class="px-6 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/80 select-none">
          <div class="flex items-center space-x-3 min-w-0">
            <span class="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 font-mono text-xs font-semibold shrink-0">
              {{ issue.identifier }}
            </span>
            <span class="text-sm font-semibold text-gray-200 truncate">{{ editTitle || 'Untitled issue' }}</span>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button
              @click="polishAiDescription"
              :disabled="aiLoadingDesc"
              class="px-2.5 py-1 rounded-md bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-xs font-medium flex items-center space-x-1 transition-all"
              title="Enhance description into structured PRD with Acceptance Criteria"
            >
              <span v-if="aiLoadingDesc" class="animate-spin text-xs">🌀</span>
              <span v-else>✨</span>
              <span>{{ aiLoadingDesc ? 'Generating...' : 'AI Enhance PRD' }}</span>
            </button>
            <button
              @click="exitDescFocus"
              class="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              title="Save and exit focus mode (Esc)"
            >
              Done
            </button>
          </div>
        </div>

        <!-- Focus body: centered, max-width editor -->
        <div class="flex-1 overflow-y-auto">
          <div class="max-w-3xl mx-auto px-6 py-8 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-xs">
                <button
                  @click="descTab = 'rich'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'rich' || descTab === 'write' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Rich
                </button>
                <button
                  @click="descTab = 'raw'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'raw' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Raw
                </button>
                <button
                  @click="descTab = 'preview'"
                  class="px-2.5 py-1 rounded-md font-medium transition-all"
                  :class="descTab === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'"
                >
                  Preview
                </button>
              </div>
              <span class="text-[11px] text-gray-500">Press Esc to save &amp; exit</span>
            </div>

            <!-- Rich Mode -->
            <div v-show="descTab === 'rich' || descTab === 'write'">
              <milkdown-editor
                v-model="editDesc"
                @blur="saveChanges"
                placeholder="Detailed markdown description, requirements, architecture notes..."
                class="w-full min-h-[60vh] px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 text-sm focus-within:ring-1 focus-within:ring-indigo-500 leading-relaxed"
              ></milkdown-editor>
            </div>

            <!-- Raw Mode -->
            <div v-show="descTab === 'raw'">
              <textarea
                v-model="editDesc"
                @blur="saveChanges"
                rows="24"
                placeholder="Detailed markdown description, requirements, architecture notes..."
                class="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              ></textarea>
            </div>

            <!-- Preview Mode -->
            <div
              v-show="descTab === 'preview'"
              class="p-4 rounded-xl bg-gray-900/80 border border-gray-800 min-h-[60vh] markdown-body"
              v-html="renderedDescription"
            ></div>
          </div>
        </div>
      </div>
    </div>
  `
};
