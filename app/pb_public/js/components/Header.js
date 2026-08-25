// pb_public/js/components/Header.js

const HeaderComponent = {
  props: ['projects', 'currentProject', 'currentView', 'realtimeConnected', 'notifications', 'unreadNotifications'],
  emits: ['select-project', 'change-view', 'open-new-issue', 'open-omnibar', 'open-new-project', 'open-custom-fields', 'toggle-notifications', 'notification-click', 'mark-all-read'],
  data() {
    return {
      dropdownOpen: false,
      notifOpen: false
    };
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    handleClickOutside(e) {
      if (this.$refs.dropdown && !this.$refs.dropdown.contains(e.target)) {
        this.dropdownOpen = false;
      }
      if (this.$refs.notifDropdown && !this.$refs.notifDropdown.contains(e.target)) {
        this.notifOpen = false;
      }
    },
    selectProj(proj) {
      this.dropdownOpen = false;
      this.$emit('select-project', proj);
    },
    toggleNotif() {
      this.notifOpen = !this.notifOpen;
      if (this.notifOpen) this.$emit('toggle-notifications');
    },
    clickNotif(n) {
      this.notifOpen = false;
      this.$emit('notification-click', n);
    },
    fmtTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    },
    notifIcon(type) {
      const map = {
        assigned: 'user-plus',
        mentioned: 'at-sign',
        commented: 'message-square',
        status: 'arrow-right-circle',
        priority: 'flag',
        system: 'bell'
      };
      return map[type] || 'bell';
    }
  },
  template: `
    <header class="h-14 border-b border-gray-800 bg-gray-900/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      <!-- Left: Logo & Project Switcher -->
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2 font-bold text-white tracking-tight cursor-pointer" @click="$emit('change-view', 'projects')">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <i data-lucide="layers" class="w-4 h-4"></i>
          </div>
          <span class="text-base font-semibold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">ProjectBase</span>
          <span class="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/50 select-none">v0.9.0</span>
        </div>

        <div class="h-5 w-px bg-gray-800"></div>

        <!-- Project Selector Dropdown -->
        <div class="relative" ref="dropdown">
          <button 
            @click="dropdownOpen = !dropdownOpen"
            class="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 text-sm text-gray-200 transition-colors border border-transparent hover:border-gray-700/60"
          >
            <span v-if="currentProject" class="flex items-center space-x-2">
              <span class="text-base leading-none">{{ currentProject.icon || '📁' }}</span>
              <span class="font-medium max-w-[140px] truncate">{{ currentProject.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">{{ currentProject.identifier }}</span>
            </span>
            <span v-else class="flex items-center space-x-2 text-gray-400">
              <i data-lucide="layout-grid" class="w-4 h-4"></i>
              <span class="font-medium">All Projects</span>
            </span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-500"></i>
          </button>

          <!-- Dropdown Menu -->
          <div 
            v-if="dropdownOpen" 
            class="absolute left-0 mt-2 w-64 glass-dropdown rounded-xl shadow-2xl p-1.5 z-50 border border-gray-800 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div class="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</div>
            
            <button 
              @click="selectProj(null)" 
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors"
              :class="!currentProject ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-gray-300 hover:bg-gray-800/60'"
            >
              <div class="flex items-center space-x-2">
                <i data-lucide="layout-grid" class="w-4 h-4 text-gray-400"></i>
                <span>All Projects</span>
              </div>
              <i v-if="!currentProject" data-lucide="check" class="w-3.5 h-3.5 text-indigo-400"></i>
            </button>

            <div class="my-1 border-t border-gray-800/60"></div>

            <div class="max-h-56 overflow-y-auto space-y-0.5">
              <button 
                v-for="p in projects" 
                :key="p.id"
                @click="selectProj(p)"
                class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors"
                :class="currentProject && currentProject.id === p.id ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-gray-300 hover:bg-gray-800/60'"
              >
                <div class="flex items-center space-x-2 min-w-0">
                  <span class="text-sm flex-shrink-0">{{ p.icon || '📁' }}</span>
                  <span class="truncate">{{ p.name }}</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono flex-shrink-0 ml-2">{{ p.identifier }}</span>
              </button>
            </div>

            <div class="my-1 border-t border-gray-800/60"></div>

            <button 
              @click="$emit('open-new-project'); dropdownOpen = false;"
              class="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition-colors"
            >
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>Create New Project</span>
            </button>
          </div>
        </div>

        <!-- View Switcher Tabs -->
        <div class="hidden md:flex items-center bg-gray-950/80 p-0.5 rounded-lg border border-gray-800/80 text-xs">
          <button 
            @click="$emit('change-view', 'board')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'board' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
            <span>Board</span>
          </button>
          <button 
            @click="$emit('change-view', 'list')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="list-todo" class="w-3.5 h-3.5"></i>
            <span>List</span>
          </button>
          <button 
            @click="$emit('change-view', 'cycles')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'cycles' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Cycles</span>
          </button>
          <button
            @click="$emit('change-view', 'timeline')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'timeline' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
            <span>Timeline</span>
          </button>
          <button
            @click="$emit('change-view', 'milestones')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'milestones' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="flag" class="w-3.5 h-3.5"></i>
            <span>Milestones</span>
          </button>
          <button 
            @click="$emit('change-view', 'projects')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'projects' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="folder-kanban" class="w-3.5 h-3.5"></i>
            <span>Projects</span>
          </button>
          <button 
            @click="$emit('change-view', 'stats')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'stats' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i>
            <span>Analytics</span>
          </button>
          <button
            @click="$emit('change-view', 'portfolio')"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'portfolio' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
            title="Portfolio Dashboard (9)"
          >
            <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
            <span>Portfolio</span>
          </button>
          <button 
            @click="$emit('change-view', 'docs')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'docs' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Docs & API</span>
          </button>
          <button 
            @click="$emit('change-view', 'marketplace')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'marketplace' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="puzzle" class="w-3.5 h-3.5 text-purple-400"></i>
            <span>Plugins</span>
          </button>
        </div>
      </div>

      <!-- Right: Search, Actions, Live Status -->
      <div class="flex items-center space-x-3">
        <!-- Live SSE Status Indicator -->
        <div class="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-400 select-none" title="PocketBase Realtime SSE Active">
          <span class="w-2 h-2 rounded-full bg-emerald-400 live-pulse"></span>
          <span class="hidden sm:inline font-mono font-medium">Live SSE</span>
        </div>

        <!-- Notifications Inbox Bell -->
        <div class="relative" ref="notifDropdown">
          <button
            @click.stop="toggleNotif"
            class="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="Notifications"
          >
            <i data-lucide="bell" class="w-4 h-4"></i>
            <span
              v-if="unreadNotifications > 0"
              class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center shadow"
            >{{ unreadNotifications > 99 ? '99+' : unreadNotifications }}</span>
          </button>

          <!-- Dropdown Inbox -->
          <div
            v-if="notifOpen"
            class="absolute right-0 mt-2 w-80 glass-dropdown rounded-xl shadow-2xl z-50 border border-gray-800 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-gray-800/70">
              <div class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Inbox</div>
              <button
                v-if="unreadNotifications > 0"
                @click="$emit('mark-all-read')"
                class="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >Mark all read</button>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <template v-if="notifications && notifications.length > 0">
                <button
                  v-for="n in notifications"
                  :key="n.id"
                  @click="clickNotif(n)"
                  class="w-full flex items-start space-x-2.5 px-3 py-2.5 text-left transition-colors"
                  :class="n.read ? 'hover:bg-gray-800/40' : 'bg-indigo-950/30 hover:bg-indigo-950/50 border-l-2 border-indigo-500'"
                >
                  <i :data-lucide="notifIcon(n.type)" class="w-4 h-4 mt-0.5 flex-shrink-0" :class="n.read ? 'text-gray-500' : 'text-indigo-400'"></i>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs text-gray-200 leading-snug break-words">{{ n.message }}</span>
                    <span class="block mt-0.5 text-[10px] text-gray-500">{{ fmtTime(n.created) }}</span>
                  </span>
                </button>
              </template>
              <div v-else class="px-4 py-8 text-center text-gray-500 text-xs">
                <i data-lucide="bell-off" class="w-5 h-5 mx-auto mb-2 opacity-40"></i>
                <p>No notifications yet.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Omnibar Search Trigger -->
        <button 
          @click="$emit('open-omnibar')"
          class="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-gray-950/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 text-xs transition-all"
        >
          <i data-lucide="search" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Search...</span>
          <kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] text-gray-400 font-mono border border-gray-700/60">⌘K</kbd>
        </button>

        <!-- Custom Fields Manager -->
        <button
          v-if="currentProject"
          @click="$emit('open-custom-fields')"
          class="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gray-950/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 text-xs transition-all"
          title="Manage custom fields for this project"
        >
          <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Fields</span>
        </button>

        <!-- Export Issues Button -->
        <button
          @click="$emit('open-export')"
          class="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gray-950/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 text-xs transition-all"
          title="Export issues as CSV or JSON"
        >
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Export</span>
        </button>

        <!-- New Issue Button -->
        <button 
          @click="$emit('open-new-issue')"
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>New Issue</span>
          <kbd class="hidden sm:inline-block px-1 py-0.5 rounded bg-indigo-700 text-[10px] font-mono ml-1">C</kbd>
        </button>

        <!-- PocketBase Admin Dashboard Link -->
        <a 
          href="/_/" 
          target="_blank" 
          rel="noopener"
          class="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          title="Open PocketBase Admin Dashboard"
        >
          <i data-lucide="database" class="w-4 h-4"></i>
        </a>
      </div>
    </header>
  `
};
