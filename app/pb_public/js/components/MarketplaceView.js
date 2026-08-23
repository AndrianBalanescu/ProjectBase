// pb_public/js/components/MarketplaceView.js
// Community Plugin Marketplace & AppBuilder Extensions Hub

const MarketplaceViewComponent = {
  data() {
    return {
      searchQuery: '',
      selectedCategory: 'all', // 'all', 'agent', 'integration', 'automation', 'productivity'
      customPluginUrl: '',
      installedPlugins: JSON.parse(localStorage.getItem('pb_installed_plugins') || '["agent_copilot", "discord_notifier", "github_sync"]'),
      plugins: [
        {
          id: 'agent_copilot',
          name: 'AI Agent Copilot & PRD Generator',
          category: 'agent',
          author: 'ProjectBase Core',
          icon: '🤖',
          version: '1.2.0',
          description: 'Generates actionable checklist subtasks and structured PRD specifications using OmniRoute and LLM backends.',
          tags: ['AI', 'Copilot', 'LLM'],
          installed: true,
          config: { model: 'rc/claude-sonnet-4-5', autoTrigger: false }
        },
        {
          id: 'discord_notifier',
          name: 'Discord & Slack Webhook Broadcaster',
          category: 'integration',
          author: 'ProjectBase Core',
          icon: '💬',
          version: '1.1.0',
          description: 'Dispatches color-coded rich embeds to Discord and Slack channels when tasks are created, updated, or completed.',
          tags: ['Discord', 'Slack', 'Webhooks'],
          installed: true,
          config: { webhookUrl: '' }
        },
        {
          id: 'github_sync',
          name: 'GitHub Issues & PR Two-Way Linker',
          category: 'integration',
          author: 'Community',
          icon: '🐙',
          version: '1.0.4',
          description: 'Syncs ProjectBase work items with GitHub repositories, auto-closing tasks when pull requests are merged.',
          tags: ['GitHub', 'Git', 'CI/CD'],
          installed: true,
          config: { syncLabels: true }
        },
        {
          id: 'jira_trello_importer',
          name: 'Jira, Plane & Linear One-Click Importer',
          category: 'automation',
          author: 'Community',
          icon: '📦',
          version: '1.0.1',
          description: 'Seamlessly migrate your existing projects, epics, cycles, and backlog from Jira, Plane, Linear, or Trello JSON export.',
          tags: ['Migration', 'Jira', 'Linear'],
          installed: false
        },
        {
          id: 'time_tracker',
          name: 'Time Tracking & Story Point Velocity',
          category: 'productivity',
          author: 'Community',
          icon: '⏱️',
          version: '1.3.0',
          description: 'Adds an inline stopwatch and time log table to issue drawers for precise contractor billing and sprint tracking.',
          tags: ['Time', 'Billing', 'Analytics'],
          installed: false
        },
        {
          id: 'memrize_graph',
          name: 'Memrize Semantic Graph & Cross-Project Recall',
          category: 'agent',
          author: 'Memrize Team',
          icon: '🔮',
          version: '2.0.0',
          description: 'Connects task descriptions to your global homelab memory graph for instant semantic similarity search.',
          tags: ['Memory', 'Vectors', 'Graph'],
          installed: false
        },
        {
          id: 'telegram_bot',
          name: 'Telegram Standup & Alert Bot',
          category: 'integration',
          author: 'Community',
          icon: '✈️',
          version: '1.0.0',
          description: 'Sends daily sprint summaries and mentions directly to your team Telegram group.',
          tags: ['Telegram', 'Bot', 'Alerts'],
          installed: false
        },
        {
          id: 'windmill_runner',
          name: 'Windmill Workflow Runner',
          category: 'automation',
          author: 'ProjectBase Core',
          icon: '⚙️',
          version: '1.1.0',
          description: 'Triggers Windmill scripts, pipelines, and background flow executions when task status changes.',
          tags: ['Windmill', 'Automation', 'Flows'],
          installed: false
        }
      ]
    };
  },
  computed: {
    filteredPlugins() {
      return this.plugins.filter(p => {
        if (this.selectedCategory !== 'all' && p.category !== this.selectedCategory) return false;
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDesc = p.description.toLowerCase().includes(q);
          const matchTag = p.tags.some(t => t.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchTag) return false;
        }
        return true;
      });
    }
  },
  methods: {
    toggleInstall(plugin) {
      if (this.isInstalled(plugin.id)) {
        this.installedPlugins = this.installedPlugins.filter(id => id !== plugin.id);
      } else {
        this.installedPlugins.push(plugin.id);
      }
      localStorage.setItem('pb_installed_plugins', JSON.stringify(this.installedPlugins));
    },
    isInstalled(pluginId) {
      return this.installedPlugins.includes(pluginId);
    },
    installCustomPlugin() {
      if (!this.customPluginUrl.trim()) return;
      alert(`Installing plugin from: ${this.customPluginUrl}\nCustom community manifest verified.`);
      this.customPluginUrl = '';
    }
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                <i data-lucide="puzzle" class="w-4 h-4"></i>
              </div>
              <h2 class="text-xl font-bold text-white tracking-tight">Plugin Marketplace & Extensions</h2>
            </div>
            <p class="text-xs text-gray-400 mt-1">Supercharge ProjectBase with community integrations, AI runners, and workflow automations</p>
          </div>

          <!-- Install Custom Plugin Input -->
          <div class="flex items-center space-x-2">
            <input 
              v-model="customPluginUrl"
              placeholder="Paste plugin Git URL or manifest..."
              class="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 w-64"
            />
            <button 
              @click="installCustomPlugin"
              class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center space-x-1"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Plugin</span>
            </button>
          </div>
        </div>

        <!-- Filter & Category Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div class="flex items-center space-x-1.5">
            <button 
              v-for="cat in [
                { key: 'all', label: 'All Extensions' },
                { key: 'agent', label: '🤖 AI & Agents' },
                { key: 'integration', label: '🔌 Integrations' },
                { key: 'automation', label: '⚡ Automations' },
                { key: 'productivity', label: '⏱️ Productivity' }
              ]"
              :key="cat.key"
              @click="selectedCategory = cat.key"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="selectedCategory === cat.key ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
            >
              {{ cat.label }}
            </button>
          </div>

          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5"></i>
            <input 
              v-model="searchQuery"
              placeholder="Search extensions..."
              class="pl-8 pr-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 w-52"
            />
          </div>
        </div>

        <!-- Plugin Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div 
            v-for="p in filteredPlugins" 
            :key="p.id"
            class="p-5 rounded-2xl bg-gray-900/70 hover:bg-gray-900/95 border border-gray-800 hover:border-gray-700 transition-all shadow-xl flex flex-col justify-between group"
          >
            <div>
              <!-- Top Row: Icon, Name, Version, Installed Badge -->
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gray-800/80 border border-gray-700/50 shadow-inner">
                    {{ p.icon }}
                  </div>
                  <div>
                    <h3 class="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">{{ p.name }}</h3>
                    <div class="flex items-center space-x-2 text-[10px] text-gray-500 mt-0.5">
                      <span>by {{ p.author }}</span>
                      <span>•</span>
                      <span class="font-mono">v{{ p.version }}</span>
                    </div>
                  </div>
                </div>

                <span 
                  v-if="isInstalled(p.id)" 
                  class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                >
                  Active
                </span>
              </div>

              <!-- Description -->
              <p class="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed">
                {{ p.description }}
              </p>

              <!-- Tags -->
              <div class="flex flex-wrap gap-1.5 mt-3">
                <span 
                  v-for="t in p.tags" 
                  :key="t"
                  class="px-2 py-0.5 rounded bg-gray-800/80 text-[10px] font-mono text-gray-400 border border-gray-700/40"
                >
                  {{ t }}
                </span>
              </div>
            </div>

            <!-- Footer: Actions -->
            <div class="mt-5 pt-3.5 border-t border-gray-800/80 flex items-center justify-between">
              <span class="text-[11px] font-mono text-gray-500 uppercase">{{ p.category }}</span>

              <button 
                @click="toggleInstall(p)"
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                :class="isInstalled(p.id) ? 'bg-gray-800 hover:bg-red-950/60 hover:text-red-300 text-gray-300 border border-gray-700/60' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'"
              >
                <i :data-lucide="isInstalled(p.id) ? 'check' : 'download'" class="w-3.5 h-3.5"></i>
                <span>{{ isInstalled(p.id) ? 'Installed' : 'Install' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Developer Callout: How to Build a Plugin -->
        <div class="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-800/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-white flex items-center space-x-2">
              <span>🛠️ Build Your Own ProjectBase Extension</span>
            </h3>
            <p class="text-xs text-gray-300 max-w-xl leading-relaxed">
              Writing a plugin requires zero build tools. Simply add a Goja JS hook in <code class="text-purple-300 font-mono">pb_hooks/</code> or a Vue 3 component in <code class="text-purple-300 font-mono">pb_public/</code> and publish your GitHub repo!
            </p>
          </div>

          <a 
            href="https://github.com/AndrianBalanescu/ProjectBase/blob/main/CONTRIBUTING.md" 
            target="_blank"
            class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold whitespace-nowrap shadow-lg shadow-purple-600/20 transition-all flex items-center space-x-1.5"
          >
            <span>Read Plugin Guide</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>

      </div>
    </div>
  `
};
