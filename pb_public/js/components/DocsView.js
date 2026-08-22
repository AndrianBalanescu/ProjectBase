// pb_public/js/components/DocsView.js
// In-App Interactive Developer Docs, OpenAPI Explorer, and Agentic Workflow Handbook

const DocsViewComponent = {
  data() {
    return {
      activeTab: 'guide', // 'guide', 'mcp', 'rest', 'projects', 'scalar'
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
  template: `
    <div class="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 bg-[#0b0f19]">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                <i data-lucide="book-open" class="w-4 h-4"></i>
              </div>
              <h2 class="text-xl font-bold text-white tracking-tight">API Reference & Agent Handbook</h2>
            </div>
            <p class="text-xs text-gray-400 mt-1">Autonomous AI agent workflows, FastMCP configuration, REST endpoints, and project keys</p>
          </div>

          <!-- Direct Links -->
          <div class="flex items-center space-x-2">
            <a 
              href="/docs" 
              target="_blank" 
              class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              <span>Scalar OpenAPI UI</span>
            </a>

            <a 
              href="/llms.txt" 
              target="_blank" 
              class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium font-mono flex items-center space-x-1.5 border border-gray-700/60 transition-colors"
            >
              <i data-lucide="bot" class="w-3.5 h-3.5 text-purple-400"></i>
              <span>llms.txt</span>
            </a>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center space-x-1 border-b border-gray-800 pb-2 text-xs">
          <button 
            @click="activeTab = 'guide'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'guide' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            🤖 Agent Operating Loop
          </button>
          <button 
            @click="activeTab = 'pb_features'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'pb_features' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            ⚡ PocketBase Superpowers
          </button>
          <button 
            @click="activeTab = 'mcp'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'mcp' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            🔌 FastMCP Setup
          </button>
          <button 
            @click="activeTab = 'tester'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'tester' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            🧪 Live API Tester
          </button>
          <button 
            @click="activeTab = 'rest'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'rest' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            📡 REST Cheat Sheet
          </button>
          <button 
            @click="activeTab = 'projects'"
            class="px-3 py-1.5 rounded-lg font-medium transition-all"
            :class="activeTab === 'projects' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'"
          >
            📁 Project Keys
          </button>
        </div>

        <!-- 1. Agent Guide Tab -->
        <div v-show="activeTab === 'guide'" class="space-y-6 animate-in fade-in duration-150">
          <div class="p-6 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-6">
            <div>
              <h3 class="text-base font-bold text-white flex items-center space-x-2">
                <span>Autonomous Agent Lifecycle (5 Steps)</span>
              </h3>
              <p class="text-xs text-gray-400 mt-1">
                How agents like Flomaster, Hermes, and Cursor autonomously inspect tasks, claim work, update subtask progress, log execution results, and mark items complete.
              </p>
            </div>

            <!-- Workflow Steps Grid -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
                <div class="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center">1</div>
                <h4 class="text-xs font-semibold text-white">Find Pending Tasks</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed">Agent queries active todo items for target project key (e.g. LOAD, IBR, PB).</p>
                <code class="block text-[10px] text-indigo-300 font-mono bg-gray-900 p-1.5 rounded">list_issues(project="LOAD", status="todo")</code>
              </div>

              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
                <div class="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center">2</div>
                <h4 class="text-xs font-semibold text-white">Claim Work Item</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed">Transitions issue to <code class="text-blue-300">in_progress</code> and sets assignee.</p>
                <code class="block text-[10px] text-blue-300 font-mono bg-gray-900 p-1.5 rounded">update_issue(id="LOAD-1", status="in_progress")</code>
              </div>

              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
                <div class="w-6 h-6 rounded-full bg-amber-600/20 text-amber-400 text-xs font-bold flex items-center justify-center">3</div>
                <h4 class="text-xs font-semibold text-white">Code & Test</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed">Implements code in local repository, verifies builds, and runs test suites.</p>
                <span class="inline-block text-[10px] text-amber-400 font-mono bg-gray-900 p-1.5 rounded w-full text-center">Local Dev / Test Loop</span>
              </div>

              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
                <div class="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 text-xs font-bold flex items-center justify-center">4</div>
                <h4 class="text-xs font-semibold text-white">Log Audit Trail</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed">Appends markdown comments with evidence and test outputs.</p>
                <code class="block text-[10px] text-purple-300 font-mono bg-gray-900 p-1.5 rounded">add_comment(id="LOAD-1", content="...")</code>
              </div>

              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
                <div class="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-bold flex items-center justify-center">5</div>
                <h4 class="text-xs font-semibold text-white">Mark Complete</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed">Updates status to <code class="text-emerald-300">done</code>. Triggers live SSE on web boards.</p>
                <code class="block text-[10px] text-emerald-300 font-mono bg-gray-900 p-1.5 rounded">update_issue(id="LOAD-1", status="done")</code>
              </div>
            </div>
          </div>
        </div>

        <!-- 1.5 PocketBase Superpowers Tab -->
        <div v-show="activeTab === 'pb_features'" class="space-y-6 animate-in fade-in duration-150">
          <div class="p-6 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-6">
            <div>
              <h3 class="text-base font-bold text-white flex items-center space-x-2">
                <span>PocketBase Native Capabilities & Superpowers</span>
              </h3>
              <p class="text-xs text-gray-400 mt-1">
                Zero-boilerplate features built directly into PocketBase's Go core: filter query expressions, relation traversal, live SSE, file attachments, and built-in cron.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <!-- Filter Engine -->
              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2">
                <div class="flex items-center space-x-2 text-indigo-400 font-bold">
                  <i data-lucide="filter" class="w-4 h-4"></i>
                  <span>1. SQL-Like Filter Expressions</span>
                </div>
                <p class="text-gray-300 text-[11px] leading-relaxed">
                  Query with operators <code class="text-indigo-300">=, !=, >, <, ~, !~, ?=</code> and boolean logic. Traverses relations automatically without manual SQL joins.
                </p>
                <pre class="p-2.5 rounded-lg bg-gray-900 text-indigo-200 font-mono text-[10px] overflow-x-auto"><code>GET /api/collections/issues/records?filter=(project.identifier='LOAD' && (status='todo' || priority='urgent'))</code></pre>
              </div>

              <!-- Relation & Back-Relation Expansion -->
              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2">
                <div class="flex items-center space-x-2 text-blue-400 font-bold">
                  <i data-lucide="git-branch" class="w-4 h-4"></i>
                  <span>2. Multi-Level Relation & Back-Relations</span>
                </div>
                <p class="text-gray-300 text-[11px] leading-relaxed">
                  Expand foreign keys forward and backward (e.g. fetch an issue and all its comments in 1 single HTTP request).
                </p>
                <pre class="p-2.5 rounded-lg bg-gray-900 text-blue-200 font-mono text-[10px] overflow-x-auto"><code>GET /api/collections/issues/records?expand=project,cycle,comments_via_issue</code></pre>
              </div>

              <!-- File Storage & Thumbnails -->
              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2">
                <div class="flex items-center space-x-2 text-emerald-400 font-bold">
                  <i data-lucide="image" class="w-4 h-4"></i>
                  <span>3. File Storage & Dynamic Thumbnails</span>
                </div>
                <p class="text-gray-300 text-[11px] leading-relaxed">
                  Attach screenshots, test artifacts, or logs. PocketBase resizes and crops image thumbnails on the fly.
                </p>
                <pre class="p-2.5 rounded-lg bg-gray-900 text-emerald-200 font-mono text-[10px] overflow-x-auto"><code>GET /api/files/issues/RECORD_ID/screenshot.png?thumb=100x100</code></pre>
              </div>

              <!-- Built-in Cron Scheduler -->
              <div class="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2">
                <div class="flex items-center space-x-2 text-purple-400 font-bold">
                  <i data-lucide="clock" class="w-4 h-4"></i>
                  <span>4. Built-in Background Cron Engine</span>
                </div>
                <p class="text-gray-300 text-[11px] leading-relaxed">
                  Runs background tasks (sprint rollover, automated agent checks, velocity heartbeat) natively inside the binary.
                </p>
                <pre class="p-2.5 rounded-lg bg-gray-900 text-purple-200 font-mono text-[10px] overflow-x-auto"><code>cronAdd("daily_rollover", "0 0 * * *", (e) => { ... })</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. FastMCP Setup Tab -->
        <div v-show="activeTab === 'mcp'" class="space-y-6 animate-in fade-in duration-150">
          <div class="p-6 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-white">FastMCP Client Configuration</h3>
                <p class="text-xs text-gray-400">Add to <code class="text-indigo-400 font-mono">~/.cursor/mcp.json</code> or <code class="text-indigo-400 font-mono">~/.flomaster/config.json</code></p>
              </div>
              <button 
                @click="copyCode(mcpJsonSnippet, 'mcp')" 
                class="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-indigo-300 flex items-center space-x-1"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>{{ copiedSnippet === 'mcp' ? 'Copied!' : 'Copy JSON' }}</span>
              </button>
            </div>

            <pre class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs text-indigo-200 font-mono overflow-x-auto"><code>{{ mcpJsonSnippet }}</code></pre>
          </div>
        </div>

        <!-- 3. Live API Tester Tab -->
        <div v-show="activeTab === 'tester'" class="space-y-6 animate-in fade-in duration-150">
          <div class="p-6 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
            <h3 class="text-sm font-bold text-white">Interactive Endpoint Tester</h3>
            
            <div class="flex items-center space-x-2">
              <select v-model="testMethod" class="px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white font-mono">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
              </select>

              <select v-model="testEndpoint" class="flex-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white font-mono">
                <option value="/api/projectbase/stats">GET /api/projectbase/stats</option>
                <option value="/api/projectbase/health">GET /api/projectbase/health</option>
                <option value="/api/projectbase/quick-task">POST /api/projectbase/quick-task</option>
                <option value="/api/collections/projects/records">GET /api/collections/projects/records</option>
                <option value="/api/collections/issues/records?perPage=10">GET /api/collections/issues/records</option>
                <option value="/api/collections/cycles/records">GET /api/collections/cycles/records</option>
              </select>

              <button 
                @click="runApiTest"
                class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5"
                :disabled="testLoading"
              >
                <i data-lucide="play" class="w-3.5 h-3.5"></i>
                <span>{{ testLoading ? 'Sending...' : 'Send' }}</span>
              </button>
            </div>

            <div v-if="testMethod !== 'GET'" class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">JSON Body</label>
              <textarea 
                v-model="testPayload"
                rows="4"
                class="w-full p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white font-mono"
              ></textarea>
            </div>

            <!-- Response -->
            <div v-if="testResponse" class="space-y-1">
              <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Response</label>
              <pre class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs text-emerald-300 font-mono max-h-72 overflow-y-auto"><code>{{ testResponse }}</code></pre>
            </div>
          </div>
        </div>

        <!-- 4. REST Cheat Sheet -->
        <div v-show="activeTab === 'rest'" class="space-y-6 animate-in fade-in duration-150">
          <div class="p-6 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
            <h3 class="text-sm font-bold text-white">Core REST Endpoints</h3>
            
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                    <th class="py-2.5 px-3">Method</th>
                    <th class="py-2.5 px-3">Endpoint</th>
                    <th class="py-2.5 px-3">Purpose</th>
                    <th class="py-2.5 px-3">Example Payload</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/60 font-mono">
                  <tr>
                    <td class="py-2.5 px-3 text-emerald-400 font-bold">GET</td>
                    <td class="py-2.5 px-3 text-indigo-300">/api/projectbase/stats</td>
                    <td class="py-2.5 px-3 text-gray-300 font-sans">Workspace statistics & completion rates</td>
                    <td class="py-2.5 px-3 text-gray-500">—</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-3 text-blue-400 font-bold">POST</td>
                    <td class="py-2.5 px-3 text-indigo-300">/api/projectbase/quick-task</td>
                    <td class="py-2.5 px-3 text-gray-300 font-sans">Fast task creation by project key</td>
                    <td class="py-2.5 px-3 text-gray-400 text-[11px]">{"project_key":"LOAD","title":"Task"}</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-3 text-emerald-400 font-bold">GET</td>
                    <td class="py-2.5 px-3 text-indigo-300">/api/collections/issues/records</td>
                    <td class="py-2.5 px-3 text-gray-300 font-sans">Query tasks with filter & sort</td>
                    <td class="py-2.5 px-3 text-gray-500">?filter=(status='todo')</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-3 text-amber-400 font-bold">PATCH</td>
                    <td class="py-2.5 px-3 text-indigo-300">/api/collections/issues/records/{id}</td>
                    <td class="py-2.5 px-3 text-gray-300 font-sans">Update status, priority, or subtasks</td>
                    <td class="py-2.5 px-3 text-gray-400 text-[11px]">{"status":"done"}</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-3 text-blue-400 font-bold">POST</td>
                    <td class="py-2.5 px-3 text-indigo-300">/api/collections/comments/records</td>
                    <td class="py-2.5 px-3 text-gray-300 font-sans">Add execution log / agent comment</td>
                    <td class="py-2.5 px-3 text-gray-400 text-[11px]">{"issue":"ID","content":"..."}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 5. Project Keys Reference -->
        <div v-show="activeTab === 'projects'" class="space-y-6 animate-in fade-in duration-150">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              class="p-4 rounded-xl bg-gray-900/70 border border-gray-800 shadow-lg space-y-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="text-lg">{{ p.icon }}</span>
                  <span class="text-xs font-bold text-white">{{ p.name }}</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-xs font-bold border border-indigo-800/40">{{ p.key }}</span>
              </div>
              <p class="text-xs text-gray-400">{{ p.desc }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  computed: {
    mcpJsonSnippet() {
      return JSON.stringify({
        mcpServers: {
          projectbase: {
            command: "uv",
            args: [
              "run",
              "/home/ubuntu/projects/projectbase/scripts/mcp_server.py"
            ],
            env: {
              PROJECTBASE_URL: "http://100.70.158.21:8120"
            }
          }
        }
      }, null, 2);
    }
  }
};
