// pb_public/js/components/Header.js
// Minimalist, high-density header with Dark/Light theme toggle, clean tabs, and agent fleet access.

const HeaderComponent = {
  props: ['projects', 'currentProject', 'currentView', 'realtimeConnected', 'notifications', 'unreadNotifications', 'agents', 'agentSource', 'agentSyncing', 'theme'],
  emits: ['select-project', 'change-view', 'open-new-issue', 'open-omnibar', 'open-new-project', 'open-custom-fields', 'open-notification-settings', 'toggle-notifications', 'notification-click', 'mark-all-read', 'sync-agents', 'open-agents', 'toggle-theme'],
  data() {
    return {
      dropdownOpen: false,
      notifOpen: false,
      moreOpen: false,
      teamOpen: false
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
      if (this.$refs.moreDropdown && !this.$refs.moreDropdown.contains(e.target)) {
        this.moreOpen = false;
      }
      if (this.$refs.teamDropdown && !this.$refs.teamDropdown.contains(e.target)) {
        this.teamOpen = false;
      }
    },
    selectProj(proj) {
      this.dropdownOpen = false;
      this.$emit('select-project', proj);
    },
    agentInitial(agent) {
      const name = (agent && agent.name) || '?';
      return name.charAt(0).toUpperCase();
    },
    toggleNotif() {
      this.notifOpen = !this.notifOpen;
      if (this.notifOpen) {
        this.$emit('toggle-notifications');
      }
    },
    formatTime(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now - d) / 1000);
      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
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
    <header class="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md px-3 flex items-center gap-2 sticky top-0 z-30 select-none">
      <!-- Left: Logo & Project Switcher -->
      <div class="flex items-center space-x-3 flex-shrink-0">
        <div class="flex items-center space-x-2 font-bold text-zinc-900 dark:text-white tracking-tight cursor-pointer" @click="$emit('change-view', 'projects')">
          <div class="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-2xs">
            ⚡
          </div>
          <span class="text-sm font-semibold tracking-tight">ProjectBase</span>
          <span class="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 select-none">v1.29.0</span>
        </div>

        <div class="h-4 w-px bg-zinc-200 dark:bg-zinc-800"></div>

        <!-- Project Selector Dropdown -->
        <div class="relative" ref="dropdown">
          <button
            @click="dropdownOpen = !dropdownOpen"
            class="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
          >
            <span v-if="currentProject" class="flex items-center space-x-1.5">
              <span>{{ currentProject.icon || '📁' }}</span>
              <span class="font-semibold">{{ currentProject.name }}</span>
            </span>
            <span v-else class="text-zinc-500">All Projects</span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="dropdownOpen"
            class="absolute left-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 py-1 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Switch Project
            </div>

            <div class="max-h-56 overflow-y-auto py-0.5 space-y-0.5">
              <button
                @click="selectProj(null)"
                class="w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-200"
                :class="{ 'font-semibold text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/50': !currentProject }"
              >
                <span>🌐</span>
                <span class="flex-1">All Projects</span>
              </button>

              <button
                v-for="p in projects"
                :key="p.id"
                @click="selectProj(p)"
                class="w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-200"
                :class="{ 'font-semibold text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/50': currentProject && currentProject.id === p.id }"
              >
                <span>{{ p.icon || '📁' }}</span>
                <span class="flex-1 truncate">{{ p.name }}</span>
                <span class="text-[10px] font-mono text-zinc-400">{{ p.identifier }}</span>
              </button>
            </div>

            <div class="border-t border-zinc-200 dark:border-zinc-800 my-1"></div>

            <button
              @click="$emit('open-new-project'); dropdownOpen = false;"
              class="w-full text-left px-3 py-1.5 flex items-center space-x-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>New Project...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Center: View Switcher Tabs (Minimalist Strip) -->
      <div class="hidden md:flex items-center flex-1 min-w-0 justify-center px-2">
        <div class="flex items-center bg-zinc-100 dark:bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs overflow-x-auto scrollbar-none">
          <button
            @click="$emit('change-view', 'board')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'board' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
            <span>Board</span>
          </button>
          <button
            @click="$emit('change-view', 'list')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'list' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="list-todo" class="w-3.5 h-3.5"></i>
            <span>List</span>
          </button>
          <button
            @click="$emit('change-view', 'cycles')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'cycles' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Cycles</span>
          </button>
          <button
            @click="$emit('change-view', 'timeline')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'timeline' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
            title="Timeline Schedule"
          >
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
            <span>Timeline</span>
          </button>
          <button
            @click="$emit('change-view', 'milestones')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'milestones' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="milestone" class="w-3.5 h-3.5"></i>
            <span>Roadmap</span>
          </button>
          <button
            @click="$emit('change-view', 'projects')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'projects' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="folder" class="w-3.5 h-3.5"></i>
            <span>Projects</span>
          </button>
          <button
            @click="$emit('change-view', 'stats')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'stats' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
            <span>Stats</span>
          </button>
          <button
            @click="$emit('change-view', 'agents')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'agents' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
            title="AI Agents & Live Sessions"
          >
            <i data-lucide="bot" class="w-3.5 h-3.5"></i>
            <span>Agents</span>
          </button>
          <button
            @click="$emit('change-view', 'portfolio')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'portfolio' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
            title="Portfolio Dashboard"
          >
            <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
            <span>Portfolio</span>
          </button>
          <button
            @click="$emit('change-view', 'docs')"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
            :class="currentView === 'docs' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
          >
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
            <span>Docs</span>
          </button>
        </div>
      </div>

      <!-- Right: Search, Theme Toggle, Actions, Live Status -->
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Omnibar Search Trigger -->
        <button
          @click="$emit('open-omnibar')"
          class="flex items-center space-x-2 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs transition-colors"
          title="Search across all issues (⌘K)"
        >
          <i data-lucide="search" class="w-3.5 h-3.5"></i>
          <span class="hidden md:inline">Search</span>
          <kbd class="hidden md:inline-block px-1 py-0.5 rounded bg-white dark:bg-zinc-800 text-[10px] text-zinc-500 font-mono border border-zinc-200 dark:border-zinc-700">⌘K</kbd>
        </button>

        <!-- Theme Switcher (Dark / Light Minimalist Toggle) -->
        <button
          @click="$emit('toggle-theme')"
          class="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          :title="theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'"
        >
          <i :data-lucide="theme === 'dark' ? 'sun' : 'moon'" class="w-4 h-4"></i>
        </button>

        <!-- Notifications Inbox Bell -->
        <div class="relative" ref="notifDropdown">
          <button
            @click.stop="toggleNotif"
            class="relative p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Notifications"
          >
            <i data-lucide="bell" class="w-4 h-4"></i>
            <span
              v-if="unreadNotifications > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-bold flex items-center justify-center shadow-2xs"
            >{{ unreadNotifications > 99 ? '99+' : unreadNotifications }}</span>
          </button>

          <!-- Dropdown Inbox -->
          <div
            v-if="notifOpen"
            class="absolute right-0 mt-1.5 w-80 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
              <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Inbox</div>
              <button
                v-if="unreadNotifications > 0"
                @click="$emit('mark-all-read')"
                class="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors"
              >Mark all read</button>
            </div>

            <!-- Notifications list -->
            <div class="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <template v-if="notifications && notifications.length > 0">
                <div
                  v-for="n in notifications"
                  :key="n.id"
                  @click="$emit('notification-click', n); notifOpen = false;"
                  class="p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors flex items-start space-x-2.5"
                  :class="{ 'bg-zinc-50/50 dark:bg-zinc-800/20': !n.read }"
                >
                  <div
                    class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                  >
                    <i :data-lucide="notifIcon(n.type)" class="w-3.5 h-3.5"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2">
                      <span class="font-semibold">{{ n.title }}</span>
                      <span v-if="n.message" class="text-zinc-500 dark:text-zinc-400"> — {{ n.message }}</span>
                    </div>
                    <div class="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center justify-between">
                      <span>{{ formatTime(n.created) }}</span>
                      <span v-if="!n.read" class="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100"></span>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                <i data-lucide="bell-off" class="w-5 h-5 mx-auto mb-2 opacity-40"></i>
                No notifications
              </div>
            </div>

            <!-- Footer: notification channel config link -->
            <div class="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between text-[11px]">
              <span class="text-zinc-400 dark:text-zinc-500">Discord / Telegram / Webhook</span>
              <a
                href="javascript:void(0)"
                @click.prevent="$emit('open-notification-settings'); notifOpen = false;"
                class="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium flex items-center space-x-1"
              >
                <i data-lucide="settings" class="w-3 h-3"></i>
                <span>Configure</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Agentic-native: live agent stack + team dropdown -->
        <div class="relative" ref="teamDropdown">
          <button
            @click.stop="teamOpen = !teamOpen"
            class="flex items-center -space-x-1.5 rounded-full px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            :title="(agents && agents.length) ? (agents.length + ' agents detected') : 'No agents detected'"
          >
            <template v-if="agents && agents.length > 0">
              <span
                v-for="a in agents.slice(0, 3)"
                :key="a.name"
                class="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] select-none"
              >{{ a.avatar }}</span>
              <span
                v-if="agents.length > 3"
                class="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[8px] flex items-center justify-center font-semibold"
              >+{{ agents.length - 3 }}</span>
            </template>
            <span v-else class="text-zinc-400 flex items-center space-x-1 px-1 text-xs">
              <i data-lucide="bot" class="w-3.5 h-3.5"></i>
            </span>
          </button>

          <!-- Team dropdown -->
          <div
            v-if="teamOpen"
            class="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
          >
            <div class="p-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                <i data-lucide="bot" class="w-3.5 h-3.5"></i>
                <span>Agent Fleet</span>
              </div>
              <button
                @click="$emit('sync-agents')"
                :disabled="agentSyncing"
                class="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center space-x-1"
                title="Rescan agent runtimes"
              >
                <i data-lucide="refresh-cw" class="w-3 h-3" :class="{ 'animate-spin': agentSyncing }"></i>
                <span>{{ agentSyncing ? 'Scanning...' : 'Rescan' }}</span>
              </button>
            </div>

            <!-- Agent List -->
            <div class="py-1 divide-y divide-zinc-100 dark:divide-zinc-800/40">
              <template v-if="agents && agents.length > 0">
                <button
                  v-for="a in agents"
                  :key="a.name"
                  @click="$emit('open-agents', a.name); teamOpen = false;"
                  class="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <span class="text-sm shrink-0">{{ a.avatar }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center space-x-1.5">
                      <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate capitalize">{{ a.name }}</span>
                      <span class="w-1.5 h-1.5 rounded-full" :class="a.status === 'online' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-600'" :title="a.status === 'online' ? 'online' : 'offline'"></span>
                      <span v-if="a.session_count" class="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">{{ a.session_count }} live</span>
                    </div>
                    <div class="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{{ a.provider }} · {{ a.runtime }}</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-400 shrink-0"></i>
                </button>
              </template>
              <div v-else class="px-3 py-4 text-center">
                <i data-lucide="bot" class="w-5 h-5 text-zinc-400 mx-auto mb-1.5"></i>
                <div class="text-xs text-zinc-500">No agents detected.</div>
              </div>
            </div>

            <!-- Footer: open agents page link -->
            <div class="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between text-[11px]">
              <span class="text-[10px] font-mono text-zinc-400">source: {{ agentSource || 'bridge' }}</span>
              <button
                @click="$emit('open-agents', null); teamOpen = false;"
                class="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium flex items-center space-x-1"
              >
                <span>Cockpit</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Create Task CTA Button (Minimalist) -->
        <button
          @click="$emit('open-new-issue')"
          class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
          title="Create New Issue (C)"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">New Task</span>
        </button>

        <!-- More Settings Menu -->
        <div class="relative" ref="moreDropdown">
          <button
            @click.stop="moreOpen = !moreOpen"
            class="p-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="More actions (Export, Fields, Admin)"
          >
            <i data-lucide="more-vertical" class="w-4 h-4"></i>
          </button>

          <div
            v-if="moreOpen"
            class="glass-dropdown absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 py-1 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <button
              @click="$emit('open-custom-fields'); moreOpen = false;"
              class="w-full text-left px-3 py-1.5 flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <i data-lucide="sliders" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Custom Fields</span>
            </button>
            <button
              @click="$emit('open-export'); moreOpen = false;"
              class="w-full text-left px-3 py-1.5 flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <i data-lucide="download" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Export Issues</span>
            </button>
            <button
              @click="$emit('open-notification-settings'); moreOpen = false;"
              class="w-full text-left px-3 py-1.5 flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <i data-lucide="bell-ring" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Notification Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  `
};
