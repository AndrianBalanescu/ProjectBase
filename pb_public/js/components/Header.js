// pb_public/js/components/Header.js

const HeaderComponent = {
  props: ['projects', 'currentProject', 'currentView', 'realtimeConnected'],
  emits: ['select-project', 'change-view', 'open-new-issue', 'open-omnibar', 'open-new-project'],
  data() {
    return {
      dropdownOpen: false
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
    },
    selectProj(proj) {
      this.dropdownOpen = false;
      this.$emit('select-project', proj);
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
            @click="$emit('change-view', 'docs')" 
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium"
            :class="currentView === 'docs' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
          >
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Docs & API</span>
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

        <!-- Omnibar Search Trigger -->
        <button 
          @click="$emit('open-omnibar')"
          class="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-gray-950/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 text-xs transition-all"
        >
          <i data-lucide="search" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Search...</span>
          <kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] text-gray-400 font-mono border border-gray-700/60">⌘K</kbd>
        </button>

        <!-- New Issue Button -->
        <button 
          @click="$emit('open-new-issue')"
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>New Issue</span>
          <kbd class="hidden sm:inline-block px-1 py-0.2 rounded bg-indigo-700 text-[10px] font-mono ml-1">C</kbd>
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
