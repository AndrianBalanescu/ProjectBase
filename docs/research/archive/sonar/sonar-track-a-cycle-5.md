Projectbase can position as a ultra-fast, self-hosted, open-source Linear/Plane alternative by leveraging PocketBase+SQLite with a lean Vue 3 + Sortable Kanban UI and agent-powered workflows, undercutting seat-based SaaS pricing while trading off some scalability, ecosystem, and enterprise features. [Source](https://github.com/pocketbase/pocketbase) [Source](https://pocketbase.io/) [Source](https://pocketbase.io/faq/) [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://openley.com/directory/linear) [Source](https://openalternative.co/plane)  

Below is a 2026 snapshot of the competitive landscape, pricing, and key technical trade-offs relevant to this vision.

## Competitive landscape (2026)

|Tool|Type|Hosting model|Pricing (indicative)|Notes vs projectbase|
|---|---|---|---|---|
|Linear|Proprietary issue tracker & project management|Cloud-only SaaS; no self-hosting option|Free: $0 (2 teams, 250 issues). Basic: $10/user/month. Business: $16/user/month, billed annually. Enterprise: custom quote. [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/) [Source](https://www.softwaresuggest.com/linear/pricing) [Source](https://openley.com/directory/linear)|Benchmarks “fast, keyboard-driven” UX and AI features (Triage Intelligence, Loops, Code Intelligence, Asks). [Source](https://saascrmreview.com/linear-review/) [Source](https://openley.com/directory/linear) Projectbase must match perceived speed and UX while differentiating on self-hosting and cost.|
|Plane|Open-source Linear/Jira alternative|Self-hosted (AGPL-3.0) plus hosted cloud option|Core is free/open-source; commercial cloud workspace pricing layered on top (varies by provider). [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://openley.com/directory/linear) [Source](https://openalternative.co/plane) [Source](https://use-apify.com/blog/linear-alternatives-2026)|Closest OSS “drop-in” Linear alternative today, combining issues, cycles, modules and AI-powered workflows. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://openalternative.co/plane) [Source](https://use-apify.com/blog/linear-alternatives-2026) Competes directly with projectbase on OSS + self-host; projectbase must win on simplicity, performance, and frictionless setup.|
|Tegon|Open-source dev-first issue tracker|Self-hosted (open-source) plus community/self-host deployments|Free/open-source; commercial support or cloud may be offered separately. [Source](https://www.gitfounders.com/alternatives/linear) [Source](https://github.com/RedPlanetHQ/tegon)|Focuses on lightweight dev workflows as an alternative to Jira/Linear. [Source](https://www.gitfounders.com/alternatives/linear) [Source](https://github.com/RedPlanetHQ/tegon) Less polished than Linear, but shows demand for simple OSS tools; projectbase can push even further on speed and ease-of-use.|
|PocketBase Cloud (hosting)|Managed hosting for PocketBase instances|Multi-tenant cloud, flat, non-metered pricing per compute|Free: 1 instance, 50 MB storage, 500 API requests/hour. Starter: ~$5–10/month. Pro: ~$20/month for dedicated compute with “unlimited” PocketBase instances and API requests. [Source](https://pocketbasecloud.com/pricing/)|Not a competitor feature-wise, but defines the cost baseline for a PocketBase-based product: very low infra cost compared with per-seat SaaS. [Source](https://pocketbasecloud.com/pricing/) [Source](https://saaslens.app/tools/pocketbase)|

Linear remains the premium, high-UX SaaS choice, while Plane and Tegon show the appetite for self-hosted, OSS issue trackers with more control over data and cost. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://www.gitfounders.com/alternatives/linear) [Source](https://openley.com/directory/linear) [Source](https://github.com/RedPlanetHQ/tegon) [Source](https://openalternative.co/plane) [Source](https://use-apify.com/blog/linear-alternatives-2026)  

Projectbase slots logically into the “PocketBase + SQLite + Vue 3 OSS” niche: thin, fast, and highly self-hostable, with agent dispatch and Kanban-specific optimizations as differentiators.

## Pricing positioning

**Linear and similar SaaS tools**

* Linear charges per user with tiers from free to Business/Enterprise, and all paid plans are billed annually in 2026. [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/) [Source](https://www.softwaresuggest.com/linear/pricing)  
* The Business plan is $16/user/month (annual billing), which for \(10 \times 16 = 160\) gives \$160/month for a 10-person team. [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/) [Source](https://www.softwaresuggest.com/linear/pricing)  
* Linear offers no self-hosting, so costs scale directly with team size and seat count. [Source](https://saascrmreview.com/linear-review/) [Source](https://openley.com/directory/linear) [Source](https://ossalt.com/alternatives/linear)  

Plane’s hosted cloud and other SaaS alternatives have similar per-seat or per-workspace billing, even if the core is open-source. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://openley.com/directory/linear) [Source](https://openalternative.co/plane) [Source](https://use-apify.com/blog/linear-alternatives-2026)  

**PocketBase and self-hosting economics**

* PocketBase itself is MIT-licensed, free, and open-source; it can be embedded as a single Go binary with SQLite. [Source](https://github.com/pocketbase/pocketbase) [Source](https://pocketbase.io/) [Source](https://pocketbase.io/faq/) [Source](https://pkg.go.dev/github.com/samdevbr/pocketbase)  
* The upstream project is intentionally self-hosted only; there is no official managed cloud from the core maintainer, though third parties offer PocketBase hosting. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  
* Typical infrastructure to self-host PocketBase comfortably is a small VPS at about \$5–\$10/month, or even a Raspberry Pi, supporting thousands of realtime connections. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  

**Implication for projectbase pricing**

* If projectbase is fully open-source (MIT/AGPL) and self-hosted, the marginal “license” cost per user can be driven to zero; cost becomes infrastructure only (e.g., a \$5–\$20/month VPS or PocketBase Cloud compute). [Source](https://pocketbasecloud.com/pricing/) [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  
* A commercial layer can be added on top (support, hosted projectbase instances, or agent credits) while still undercutting Linear for teams above a handful of users, given the stark difference between flat infra cost and per-seat SaaS pricing. [Source](https://pocketbasecloud.com/pricing/) [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/)  

A simple positioning is: “Seat-free OSS issue tracking and Kanban with AI agents, at VPS prices,” which directly contrasts with Linear’s $10–$16/user/month structure. [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/) [Source](https://www.softwaresuggest.com/linear/pricing)

## Technical stack & trade-offs

### PocketBase + SQLite

**Strengths**

* PocketBase is a single-file Go backend with built-in auth, file storage, realtime subscriptions, and an admin UI, running on embedded SQLite in WAL mode. [Source](https://github.com/pocketbase/pocketbase) [Source](https://pocketbase.io/) [Source](https://pocketbase.io/faq/)  
* It is capable of handling 10 000+ persistent realtime connections on a small \$4 VPS (Hetzner CAX11: 2 vCPU, 4 GB RAM), which is robust enough for most small and mid-sized teams. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  
* SQLite gives extremely low-latency local storage, simple backups, and easy deployment (no separate DB service), aligning with a “zero-friction” deployment story. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  

**Trade-offs**

* SQLite is embedded and single-file; scaling horizontally (multi-region, multi-tenant at very large scale) requires sharding or splitting instances rather than conventional clustering. [Source](https://pocketbase.io/faq/)  
* PocketBase explicitly limits scope and has no plans to support other databases, which constrains future migration paths. [Source](https://pocketbase.io/faq/)  
* Realtime notifications are tied to changes going through PocketBase’s API or Go DAO; direct writes to SQLite bypass realtime subscriptions. [Source](https://pocketbase.io/faq/) [Source](https://github.com/pocketbase/pocketbase/discussions/2590)  
* Offline/online sync is not built-in; clients must implement their own sync logic around PocketBase and SQLite. [Source](https://github.com/pocketbase/pocketbase/discussions/67)  

For projectbase, this means exceptional performance and simplicity for up to tens of thousands of connections per instance, but more architectural work if aiming at very large organizations or multi-tenant SaaS at Linear’s scale. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)

### Vue 3 + zero-build + Sortable Kanban

**Drag-and-drop options**

* Several Vue 3 wrappers around SortableJS exist, notably `vue3-sortablejs` and `sortablejs-vue3`, providing thin, directive- or component-based re-orderable lists with full Sortable features. [Source](https://github.com/eliottvincent/vue3-sortablejs) [Source](https://madewithvuejs.com/sortablejs-vue3) [Source](https://www.npmjs.com/package/sortablejs-vue3)  
* The `vuedraggable@next` component (Vue 3 compatible) exposes SortableJS with support for drag-and-drop between lists, touch devices, smart auto-scrolling, and more. [Source](https://vueschool.io/articles/vuejs-tutorials/how-do-i-drag-and-drop-in-vue/) [Source](https://github.com/SortableJS/vue.draggable.next)  
* `vue-draggable-plus` is recommended for Vue 3 drag-and-drop use cases and supports Kanban-style boards, including dragging cards between columns using a shared `group` option. [Source](https://www.mironsoft.de/en/blog/vue-drag-and-drop-in-vue-without-ui-chaos)  
* Dedicated Kanban components (e.g., drag-and-drop Vue Kanban libraries and commercial components) provide more opinionated Kanban UIs with advanced card metadata, deadlines, tagging, and attachments. [Source](https://www.npmjs.com/package/dragandropvue) [Source](https://github.com/BrockReece/vue-kanban) [Source](https://ej2.syncfusion.com/vue/documentation/kanban/drag-and-drop) [Source](https://www.npmjs.com/package/@techvootsolutions/drag-and-drop-vue)  

**Zero-build angle**

Using Vue 3 in “zero-build” mode (via ES modules and CDN or very light tooling) is realistic for a PocketBase-backed app, since the backend is a single binary and the frontend can be static + JS modules. [Source](https://pocketbase.io/) [Source](https://pocketbase.io/faq/) [Source](https://github.com/eliottvincent/vue3-sortablejs) [Source](https://www.npmjs.com/package/sortablejs-vue3)  

**Trade-offs**

* SortableJS-based Kanban is DOM-driven and can become heavy with very large boards; careful virtualization and batching are needed for Linear-level performance on huge datasets. [Source](https://github.com/eliottvincent/vue3-sortablejs) [Source](https://www.cnblogs.com/yfceshi/p/19014619) [Source](https://vueschool.io/articles/vuejs-tutorials/how-do-i-drag-and-drop-in-vue/) [Source](https://www.mironsoft.de/en/blog/vue-drag-and-drop-in-vue-without-ui-chaos) [Source](https://github.com/SortableJS/vue.draggable.next)  
* A custom Kanban built directly on SortableJS provides maximum control and speed but lacks the rich ecosystem, templates, and plugins available in more established SaaS products. [Source](https://www.npmjs.com/package/dragandropvue) [Source](https://github.com/BrockReece/vue-kanban) [Source](https://ej2.syncfusion.com/vue/documentation/kanban/drag-and-drop)  
* Accessibility and keyboard shortcuts must be engineered carefully; out-of-the-box SortableJS and many wrappers focus on pointer/touch interactions. [Source](https://www.cnblogs.com/yfceshi/p/19014619) [Source](https://www.mironsoft.de/en/blog/vue-drag-and-drop-in-vue-without-ui-chaos) [Source](https://github.com/SortableJS/vue.draggable.next)  

### Autonomous agent dispatch

The “autonomous agent dispatch” layer is where projectbase can differentiate most clearly from other OSS Linear alternatives:

* Linear is already incorporating AI features like Triage Intelligence, Loops, Code Intelligence beta, Insights, and Asks, all coordinated around issues and customer requests. [Source](https://saascrmreview.com/linear-review/)  
* Plane highlights AI-powered workflows across issues, docs, and project planning. [Source](https://openalternative.co/plane)  

Projectbase’s opportunity is to make agents a **first-class scheduler**:

* Agents that auto-triage incoming issues, assign them to Kanban columns, create subtasks, and adjust priorities based on velocity and due dates.  
* Agents that watch PocketBase events (realtime subscriptions) and continuously rebalance work across columns or teams.  
* Agents that translate natural language “intents” into structured PocketBase records and Kanban operations, reducing friction further than Linear’s form-based AI helpers.  

This layer is mostly design and integration work rather than a specific commodity feature from competitors, making it a valid differentiator if executed well.

## Key trade-offs and design decisions for projectbase

* **Performance vs scalability**  
  * PocketBase + SQLite gives exceptional performance on one node and simple maintenance but requires manual sharding or multiple instances for very large or multi-tenant deployments. [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  
* **Scope vs extensibility**  
  * PocketBase is intentionally constrained in scope; advanced workflows, automation, and integrations must live in your own agent/services layer or custom Go extensions. [Source](https://pocketbase.io/docs/go-overview/) [Source](https://pocketbase.io/faq/)  
* **Self-hosted simplicity vs enterprise compliance**  
  * Self-hosting favors privacy and control but leaves SOC2, HIPAA, enterprise SSO, audit logs, and compliance features for projectbase to implement, whereas Linear’s Enterprise tier bundles many of these. [Source](https://saascrmreview.com/linear-review/)  
* **Kanban-first UX vs broad project features**  
  * A hyper-optimized Kanban with autonomous agents can outperform generalist tools for teams that live in boards, but may lag on advanced roadmapping, documentation, or multi-product portfolio management that Plane and Linear cover. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://saascrmreview.com/linear-review/) [Source](https://openalternative.co/plane) [Source](https://use-apify.com/blog/linear-alternatives-2026)  
* **Pricing model differentiation**  
  * A flat, infra-based or “per-instance” pricing model (e.g., PocketBase Cloud-style) scales much better for larger teams than seat-based SaaS, but may reduce revenue per seat and require volume or premium agent features to compensate. [Source](https://pocketbasecloud.com/pricing/) [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://saascrmreview.com/linear-review/)  

## Practical positioning summary

For “projectbase” as described:

* Target teams who want Linear-grade speed and UX but insist on OSS, self-hosting, and low, predictable infra costs.  
* Use PocketBase+SQLite for a **single-binary, fast, realtime backend** with simple deployment and high connection density. [Source](https://github.com/pocketbase/pocketbase) [Source](https://pocketbase.io/) [Source](https://pocketbase.io/faq/) [Source](https://saaslens.app/tools/pocketbase)  
* Implement a **Vue 3 zero-build Kanban** using SortableJS-based libraries (`vue3-sortablejs`, `vuedraggable@next`, or `vue-draggable-plus`) to achieve minimal friction and strong performance. [Source](https://github.com/eliottvincent/vue3-sortablejs) [Source](https://vueschool.io/articles/vuejs-tutorials/how-do-i-drag-and-drop-in-vue/) [Source](https://www.mironsoft.de/en/blog/vue-drag-and-drop-in-vue-without-ui-chaos) [Source](https://github.com/SortableJS/vue.draggable.next)  
* Make **autonomous agents** core to the product—dispatch, triage, and scheduling—rather than an add-on, leapfrogging Linear’s current AI helper model. [Source](https://saascrmreview.com/linear-review/) [Source](https://openalternative.co/plane)  
* Monetize via optional managed hosting and agent-enhanced features, keeping the OSS core free to drive adoption and undercut seat-based competitors. [Source](https://pocketbasecloud.com/pricing/) [Source](https://saaslens.app/tools/pocketbase) [Source](https://linear.app/pricing) [Source](https://lifestack.ai/blog/linear-pricing) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://openalternative.co/plane)  

This combination positions projectbase as the **fastest, zero-friction, OSS Kanban-first Linear alternative** with a distinctive PocketBase+SQLite core and agent-native workflow, at infrastructure-level pricing instead of per-seat SaaS pricing.
