// pb_public/js/components/DocsView.js
// Minimalist, interactive Developer Docs, OpenAPI Explorer, and Agentic Workflow Handbook supporting Dark & Light themes.

const DocsViewComponent = {
  data() {
    return {
      activeTab: 'guide', // 'guide', 'pb_features', 'tester', 'rest', 'projects'
      copiedSnippet: null,
      testEndpoint: '/api/projectbase/stats',
      testMethod: 'GET',
      testPayload: '{\n  "project_key": "LOAD",\n  "title": "Dispatch load to carrier #402",\n  "status": "todo",\n  "priority": "high"\n}',
      testResponse: null,
      testLoading: false
    };
  },
  methods: {
    copyCode(code, id) {
      navigator.clipboard.writeText(code);
      this.copiedSnippet = id;
      setTimeout(() => { this.copiedSnippet = null; }, 2000);
    },
    async runApiTest() {
      this.testLoading = true;
      this.testResponse = null;
      try {
        const opts = {
          method: this.testMethod,
          headers: { 'Content-Type': 'application/json' }
        };
        if (this.testMethod !== 'GET' && this.testPayload) {
          opts.body = this.testPayload;
        }
        const res = await fetch(this.testEndpoint, opts);
        const data = await res.json();
        this.testResponse = JSON.stringify(data, null, 2);
      } catch (err) {
        this.testResponse = 'Error: ' + err.message;
      } finally {
        this.testLoading = false;
      }
    }
  },
  computed: {
  },
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 bg-zinc-50 dark:bg-[#09090b] select-none">
      <div class="w-full space-y-4">

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center space-x-2">
              <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold">
                <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
              </div>
              <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">API Reference & Agent Handbook</h2>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Autonomous AI agent workflows, FastMCP configuration, REST endpoints, and project keys</p>
          </div>

          <!-- Direct Links -->
          <div class="flex items-center space-x-2">
            <a
              href="/docs"
              target="_blank"
              class="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              <span>Scalar OpenAPI UI</span>
            </a>

            <a
              href="/llms.txt"
              target="_blank"
              class="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium font-mono flex items-center space-x-1.5 border border-zinc-200 dark:border-zinc-700/60 transition-colors"
            >
              <i data-lucide="bot" class="w-3.5 h-3.5"></i>
              <span>llms.txt</span>
            </a>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center space-x-1 border-b border-zinc-200 dark:border-zinc-800 pb-2 text-xs overflow-x-auto">
          <button
            @click="activeTab = 'guide'"
            class="px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activeTab === 'guide' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
          >
            🤖 Agent Operating Loop
          </button>
          <button
            @click="activeTab = 'pb_features'"
            class="px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activeTab === 'pb_features' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
          >
            ⚡ Native Capabilities
          </button>
          <button
            @click="activeTab = 'tester'"
            class="px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activeTab === 'tester' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
          >
            🧪 API Tester
          </button>
          <button
            @click="activeTab = 'rest'"
            class="px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activeTab === 'rest' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
          >
            📡 Core Endpoints
          </button>
          <button
            @click="activeTab = 'projects'"
            class="px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activeTab === 'projects' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
          >
            📁 Project Keys
          </button>
        </div>

        <!-- 1. Agent Guide Tab -->
        <div v-show="activeTab === 'guide'" class="space-y-4 animate-in fade-in duration-150">
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <span>Autonomous Agent Lifecycle (5 Steps)</span>
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                How agents inspect tasks, claim work, update progress, log execution results, and mark items complete.
              </p>
            </div>

            <!-- Workflow Steps Grid -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center font-mono">1</div>
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Find Tasks</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Agent queries pending work items for target project key.</p>
                <code class="block text-[10px] text-zinc-800 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">list_issues(project="PB", status="todo")</code>
              </div>

              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center font-mono">2</div>
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Claim Task</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Transitions issue to <code class="text-zinc-800 dark:text-zinc-200 font-mono">in_progress</code> and assigns itself.</p>
                <code class="block text-[10px] text-zinc-800 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">update_issue(id="PB-1", status="in_progress")</code>
              </div>

              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center font-mono">3</div>
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Code & Test</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Implements code, verifies builds, and runs full test suites.</p>
                <span class="inline-block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800 w-full text-center">Local Dev / Test Loop</span>
              </div>

              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center font-mono">4</div>
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Log Audit</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Appends markdown comments with test verification evidence.</p>
                <code class="block text-[10px] text-zinc-800 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">add_comment(id="PB-1", content="...")</code>
              </div>

              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center font-mono">5</div>
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Mark Complete</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">Updates status to <code class="text-zinc-800 dark:text-zinc-200 font-mono">done</code>. Triggers live SSE broadcast.</p>
                <code class="block text-[10px] text-zinc-800 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">update_issue(id="PB-1", status="done")</code>
              </div>
            </div>
          </div>
        </div>

        <!-- 1.5 PocketBase Superpowers Tab -->
        <div v-show="activeTab === 'pb_features'" class="space-y-4 animate-in fade-in duration-150">
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <span>PocketBase Native Superpowers</span>
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Zero-boilerplate features built directly into PocketBase Go core: filter expressions, relation traversal, and realtime SSE.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold">
                  <i data-lucide="filter" class="w-4 h-4 text-zinc-500"></i>
                  <span>1. SQL-Like Filter Expressions</span>
                </div>
                <p class="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Query with operators <code class="text-zinc-800 dark:text-zinc-200 font-mono">=, !=, >, <, ~, !~, ?=</code> and boolean logic. Traverses relations automatically.
                </p>
                <pre class="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 font-mono text-[10px] overflow-x-auto"><code>GET /api/collections/issues/records?filter=(project.identifier='PB' && (status='todo' || priority='urgent'))</code></pre>
              </div>

              <div class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div class="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold">
                  <i data-lucide="git-branch" class="w-4 h-4 text-zinc-500"></i>
                  <span>2. Multi-Level Relations</span>
                </div>
                <p class="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Expand foreign keys forward and backward in a single round-trip HTTP request.
                </p>
                <pre class="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 font-mono text-[10px] overflow-x-auto"><code>GET /api/collections/issues/records?expand=project,cycle,comments_via_issue</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Live API Tester Tab -->
        <div v-show="activeTab === 'tester'" class="space-y-4 animate-in fade-in duration-150">
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
            <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Interactive Endpoint Tester</h3>

            <div class="flex items-center space-x-2">
              <select v-model="testMethod" class="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
              </select>

              <select v-model="testEndpoint" class="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none">
                <option value="/api/projectbase/stats">GET /api/projectbase/stats</option>
                <option value="/api/projectbase/health">GET /api/projectbase/health</option>
                <option value="/api/projectbase/quick-task">POST /api/projectbase/quick-task</option>
              </select>

              <button
                @click="runApiTest"
                :disabled="testLoading"
                class="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-colors"
              >
                {{ testLoading ? 'Executing...' : 'Run Test' }}
              </button>
            </div>

            <div v-if="testResponse" class="space-y-1">
              <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Response:</span>
              <pre class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-mono overflow-x-auto max-h-64"><code>{{ testResponse }}</code></pre>
            </div>
          </div>
        </div>

        <!-- 4. Core Endpoints Tab -->
        <div v-show="activeTab === 'rest'" class="space-y-4 animate-in fade-in duration-150">
          <div class="p-4 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
            <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">REST Endpoints Reference</h3>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-semibold">
                    <th class="py-2 px-2.5">Method</th>
                    <th class="py-2 px-2.5">Route</th>
                    <th class="py-2 px-2.5">Description</th>
                    <th class="py-2 px-2.5">Example Payload</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  <tr>
                    <td class="py-2 px-2.5 text-zinc-700 dark:text-zinc-300 font-bold">GET</td>
                    <td class="py-2 px-2.5 text-zinc-900 dark:text-zinc-100">/api/collections/issues/records</td>
                    <td class="py-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-sans">Query work items with filter & sort</td>
                    <td class="py-2 px-2.5 text-zinc-500 text-[11px]">?filter=(status='todo')</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-2.5 text-zinc-700 dark:text-zinc-300 font-bold">POST</td>
                    <td class="py-2 px-2.5 text-zinc-900 dark:text-zinc-100">/api/projectbase/quick-task</td>
                    <td class="py-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-sans">Fast one-shot task creation by project key</td>
                    <td class="py-2 px-2.5 text-zinc-500 text-[11px]">{"project_key":"PB","title":"..."}</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-2.5 text-zinc-700 dark:text-zinc-300 font-bold">PATCH</td>
                    <td class="py-2 px-2.5 text-zinc-900 dark:text-zinc-100">/api/collections/issues/records/:id</td>
                    <td class="py-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-sans">Update status, assignee, or subtasks</td>
                    <td class="py-2 px-2.5 text-zinc-500 text-[11px]">{"status":"done"}</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-2.5 text-zinc-700 dark:text-zinc-300 font-bold">POST</td>
                    <td class="py-2 px-2.5 text-zinc-900 dark:text-zinc-100">/api/collections/comments/records</td>
                    <td class="py-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-sans">Add execution log / agent comment</td>
                    <td class="py-2 px-2.5 text-zinc-500 text-[11px]">{"issue":"ID","content":"..."}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 5. Project Keys Reference -->
        <div v-show="activeTab === 'projects'" class="space-y-4 animate-in fade-in duration-150">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="p in [
                { key: 'PB', name: 'ProjectBase Core', icon: '⚡', desc: 'Plane & Linear alternative with Vue 3 + PocketBase.' },
                { key: 'LOAD', name: 'LoadETA', icon: '🚚', desc: 'Freight dispatching & driver ETA optimization platform.' },
                { key: 'IBR', name: 'iBrowse Server', icon: '🌐', desc: 'Headless browser automation & QA client on :3000.' },
                { key: 'OMNI', name: 'OmniRoute AI Gateway', icon: '🧠', desc: 'Multi-provider model proxy & router on :20128.' },
                { key: 'MEM', name: 'Memrize Memory Layer', icon: '🔮', desc: 'Cross-session memory & knowledge graph for AI agents.' },
                { key: 'HOME', name: 'Homelab Infrastructure', icon: '🏠', desc: 'Ubuntu server, Tailscale mesh, and monitoring stack.' }
              ]"
              :key="p.key"
              class="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-1.5"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="text-base">{{ p.icon }}</span>
                  <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100">{{ p.name }}</span>
                </div>
                <span class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-semibold border border-zinc-200 dark:border-zinc-700/60">{{ p.key }}</span>
              </div>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ p.desc }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
};
