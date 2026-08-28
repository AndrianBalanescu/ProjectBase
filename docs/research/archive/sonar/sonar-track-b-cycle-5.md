There is clear, documented demand for a fast, self‑hostable, Linear‑like issue tracker, and existing tools plus user complaints expose concrete friction points your “projectbase” concept can directly address. [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openreplace.com/linear-alternatives)  
The main gaps are speed and UX, self‑hosting/data ownership, pricing, Kanban limitations for complex work, and rough edges in mobile/offline workflows. [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/) [Source](https://apps.apple.com/us/app/linear-mobile/id1645587184?see-all=reviews&platform=iphone)

---

## 1. Demand evidence for a Linear‑shaped, open‑source tool

* Multiple independent guides now catalog open‑source Linear alternatives (Plane, Huly, Focalboard, OpenProject, etc.), which only exists because many teams explicitly want “Linear, but open‑source/self‑hosted.” [Source](https://openreplace.com/linear-alternatives) [Source](https://zoobbe.com/linear-alternative-open-source/) [Source](https://opensourcechoice.com/alternatives/linear)  
* Plane is repeatedly described as “the closest open‑source equivalent to Linear,” covering issues, cycles/sprints, modules, pages/wikis, and dashboards—essentially mirroring Linear’s mental model. [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://storyflow.so/blog/best-linear-alternatives-2026) [Source](https://zoobbe.com/linear-alternative-open-source/)  
* Plane’s GitHub repo is reported at roughly \( \sim 54\text{k}–56\text{k} \) stars and “pushed within days,” signaling unusually high developer interest and ongoing activity for a niche project management tool. [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openreplace.com/linear-alternatives)  
* Open‑source comparison guides recommend Plane as “the closest drop‑in for Linear’s modern issue‑tracking feel,” often ranking it as the default choice for teams leaving Linear. [Source](https://storyflow.so/blog/best-linear-alternatives-2026) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  
* Several sources emphasize that “Linear is not open source” and offer Plane and Huly as “the two serious options today” for teams who explicitly need the code and self‑hostability, which is exactly the space you’re targeting. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  

Implication: there is proven demand for a Linear‑like UX that is:

* Open source  
* Self‑hostable  
* Less resource‑heavy than existing alternatives (Plane’s ~1.5 GB idle RAM is explicitly called out)[Source](https://use-apify.com/blog/linear-alternatives-2026)  

Your PocketBase + SQLite + zero‑build Vue 3 stack directly aligns with the “lightweight, self‑hostable, no per‑seat pricing” demand profile.

---

## 2. User complaints about Linear you can exploit

### 2.1 Pricing, hosting, and data ownership

* Engineers on forums consistently complain that “per‑seat pricing bites teams that grow,” with Linear’s Basic at \$8/user/month and Business at \$14/user/month; a 20‑person org on Business is cited as \$3,360/year. [Source](https://swaptosaas.com/alternatives/linear/)  
* Linear is repeatedly criticized for having **no self‑host option** at any price, excluding regulated and privacy‑sensitive companies outright. [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  
* Data ownership is described as “theoretical”: exports are CSV per view, with no clean way to retrieve the entire workspace with relationships intact, creating friction for migration and analytics. [Source](https://swaptosaas.com/alternatives/linear/)  
* Independent analyses stress that Linear is proprietary SaaS, cloud‑only, with no self‑hosted edition or public source repo. [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  

Design direction for projectbase:

* Emphasize one‑click self‑host deploy (e.g., single binary + SQLite) and on‑prem in regulated environments.  
* Offer full‑graph exports (issues, relations, comments, attachments) instead of “CSV per view,” and document a reversible data model.  
* Avoid per‑seat pricing; align with server‑based or usage‑based models.

### 2.2 UX, configurability, and “opinionated” workflows

* Linear is described as “opinionated—if Linear’s model doesn’t fit, there’s friction,” and “minimal customization compared to Jira.” [Source](https://openinstead.dev/alternatives-to/linear/)  
* Some users note that Linear retains filter settings only in session state rather than in the URL, which blocks easy sharing of exact filtered views with teammates. [Source](https://www.reddit.com/r/Linear/comments/1qbcqqc/what_dont_you_like_about_linear/)  
* Another recurring complaint is that Linear’s monochromatic visual design harms information hierarchy and grouping, making it difficult to distinguish elements and contributing to “a jumble of black and grey text.” [Source](https://www.reddit.com/r/Linear/comments/1rqox20/anyone_else_having_trouble_with_the_ui/)  

Design direction for projectbase:

* URL‑encoded filters and views as a first‑class design constraint (deep‑linkable queries).  
* Strong visual hierarchy: cards, lanes, swimlanes, and metadata should be visually distinct.  
* More flexible workflow configuration (custom fields, statuses, swimlanes) without losing the “fast” feel.

### 2.3 Mobile, offline, and reliability pain points

* Mobile reviews highlight that the mobile experience lacks many features compared to desktop/web, including creating projects and editing comments. [Source](https://chrome-stats.com/d/app.linear/reviews) [Source](https://apps.apple.com/us/app/linear-mobile/id1645587184?see-all=reviews&platform=iphone)  
* Users report login/signup friction, including missing in‑app sign‑up and problematic login flows that prevent accessing the app. [Source](https://chrome-stats.com/d/app.linear/reviews)  
* Syncing delays and weak feedback (no persistent sync indicator) are reported, with users uncertain whether changes have saved. [Source](https://chrome-stats.com/d/app.linear/reviews)  
* Several reviews describe losing work—editing in separate dialogs that don’t auto‑save, combined with spotty connections or navigation away, leading to data loss. [Source](https://chrome-stats.com/d/app.linear/reviews) [Source](https://apps.apple.com/us/app/linear-mobile/id1645587184?see-all=reviews&platform=iphone)  
* Battery drain is also mentioned for the mobile app on some devices. [Source](https://chrome-stats.com/d/app.linear/reviews)  

Design direction for projectbase:

* Local‑first editing backed by SQLite: edits committed locally instantly, with background sync and explicit conflict resolution.  
* Autosave everywhere; no “unsaved dialog” failure mode.  
* Clear sync state indicators and a durable offline queue.  
* A thin mobile web PWA or lightweight native shell sharing the same Vue 3 zero‑build front‑end.

---

## 3. Failure modes of existing open‑source Linear alternatives (Plane, etc.)

Even though Plane is the strongest current open‑source competitor, its weaknesses are well documented:

* Plane’s interface is described as “noticeably heavier than Linear’s famously snappy keyboard‑driven UI,” which is a direct performance gap your “world’s fastest” goal can target. [Source](https://use-apify.com/blog/linear-alternatives-2026)  
* Guides show Plane with idle RAM around ~1.5 GB, highlighting a relatively heavy footprint for small teams or cheap VPS instances. [Source](https://use-apify.com/blog/linear-alternatives-2026)  
* Self‑hosting Plane requires several services, with guides rating deploy difficulty “moderate” and mentioning Docker/Docker Compose setups, making it less appealing for low‑ops teams. [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://openreplace.com/linear-alternatives) [Source](https://openinstead.dev/alternatives-to/linear/)  
* Plane has “fewer integrations than mature incumbents,” which can be limiting for teams with rich existing tooling. [Source](https://openinstead.dev/alternatives-to/linear/)  
* Plane does not yet offer a native Linear importer; users resort to CSV exports from Linear and manual mapping during Plane import. [Source](https://use-apify.com/blog/linear-alternatives-2026)  
* Reviews note “less polish than Linear and a smaller community,” which affects perceived reliability and ecosystem depth. [Source](https://storyflow.so/blog/best-linear-alternatives-2026)  

Design direction for projectbase:

* Single‑process architecture (PocketBase + SQLite) and static Vue 3 assets for minimal RAM and CPU.  
* One‑file or minimal‑config deployment to appeal to self‑hosted, indie, and small‑team users.  
* Make migration a selling point: robust importer for Linear/Plane CSVs with schema mapping.  
* Focus on “fast and lean” over “maximal feature parity” to avoid Plane’s heaviness.

---

## 4. Structural failure modes of Kanban‑style tools

Kanban‑centric boards have recurring limitations that you must mitigate if projectbase is Kanban‑first.

* Analyses of Kanban boards list oversimplification and misalignment with complex, multi‑phase projects as top drawbacks; Kanban can mask underlying complexity. [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/)  
* Kanban excels for short‑term, linear workflows but struggles with multi‑phase projects that need dependencies, milestones, resource allocation, and sequential relationships. [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/)  
* Kanban boards can create silos: people focus on “their cards,” reducing global awareness of dependencies and system‑level constraints. [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/)  
* In highly dynamic environments (rapidly changing priorities and requirements), Kanban boards grow unwieldy and hard to keep accurate. [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/)  
* Research notes that standalone Kanban often lacks sufficient planning and supervision tools; poorly managed work‑in‑progress limits lead to bottlenecks, procrastination, and inefficient resource use. [Source](https://philarchive.org/archive/NIRLOK)  

Formally, uncontrolled WIP tends to increase cycle time and bottlenecks; for instance, if \( W \) is work‑in‑progress and \( \lambda \) is throughput, average lead time \( L \) often grows approximately with \( L \propto \frac{W}{\lambda} \), so failing to constrain \( W \) increases \( L \). [Source](https://philarchive.org/archive/NIRLOK)  

Design direction for projectbase:

* Integrate Kanban with higher‑level planning: cycles/sprints, roadmaps, epics, dependencies, and resource views.  
* Provide explicit dependency graphs and blockers on cards rather than “just columns.”  
* Make WIP limits first‑class, with visible breaches and agent‑suggested interventions.  
* Keep boards slim by auto‑archiving, grouping, or agent‑driven triage for noisy queues.

---

## 5. Where your “projectbase” can differentiate

Translating all this into concrete opportunity for your concept:

### 5.1 Core positioning

* “Linear‑like UX, but ultra‑lightweight, self‑hostable, and agent‑native.”  
* Powered by PocketBase + SQLite for simple deployments and local‑first data integrity.  
* Zero‑build Vue 3 front‑end for fast, static delivery and easy customization.  
* Sortable drag‑and‑drop Kanban as the primary interaction pattern, but with explicit support for complex projects (dependencies, cycles, roadmaps).

### 5.2 Addressing the most painful complaints

* Self‑host + open source: cover the major “no self‑host” and “not open source” gaps users cite about Linear. [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  
* Lightweight and fast: deliberately out‑perform Plane’s perceived heaviness and Linear‑mobile’s rough edges. [Source](https://chrome-stats.com/d/app.linear/reviews) [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://apps.apple.com/us/app/linear-mobile/id1645587184?see-all=reviews&platform=iphone)  
* Strong data ownership: full workspace export/import, schema docs, and migration helpers to escape the “CSV per view” complaint. [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://use-apify.com/blog/linear-alternatives-2026)  
* Configurable but not chaotic: more flexible than Linear’s opinionated model, less overwhelming than Jira. [Source](https://openinstead.dev/alternatives-to/linear/)  
* URL‑deep‑linkable state: filters, sorts, layouts encoded in URLs to solve the “can’t easily share the same view” problem. [Source](https://www.reddit.com/r/Linear/comments/1qbcqqc/what_dont_you_like_about_linear/)  

### 5.3 Autonomous agent dispatch as a unique angle

Most existing Linear‑like tools are human‑only. The Kanban and WIP weaknesses invite agent augmentation:

* Agents can watch WIP and throughput metrics and recommend or auto‑perform actions like re‑ordering, splitting oversized cards, or reassigning blocked work.  
* Agents can triage inbound tasks, deduplicate, tag, and place them into appropriate lanes, reducing Kanban noise.  
* Agents can detect stale cards and propose closure, escalation, or decomposition, mitigating Kanban’s tendency toward clutter and procrastination. [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/) [Source](https://philarchive.org/archive/NIRLOK)  

This gives projectbase a “beyond Linear” story: not just a clone, but a lightweight, self‑hostable hub where humans and agents co‑manage flows.

---

## 6. Summary of key evidence you can cite in a pitch

* Strong interest in open‑source Linear alternatives (Plane 50k+ stars, multiple comparison guides featuring it as the closest drop‑in). [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openreplace.com/linear-alternatives) [Source](https://storyflow.so/blog/best-linear-alternatives-2026) [Source](https://zoobbe.com/linear-alternative-open-source/) [Source](https://opensourcechoice.com/alternatives/linear)  
* Persistent complaints about Linear’s per‑seat pricing, lack of self‑hosting, and weak data export semantics. [Source](https://swaptosaas.com/alternatives/linear/) [Source](https://openinstead.dev/alternatives-to/linear/) [Source](https://zoobbe.com/linear-alternative-open-source/)  
* Documented UX and reliability issues on mobile and web (missing features, login problems, sync ambiguity, data loss, battery drain). [Source](https://chrome-stats.com/d/app.linear/reviews) [Source](https://www.reddit.com/r/Linear/comments/1qbcqqc/what_dont_you_like_about_linear/) [Source](https://apps.apple.com/us/app/linear-mobile/id1645587184?see-all=reviews&platform=iphone) [Source](https://www.reddit.com/r/Linear/comments/1rqox20/anyone_else_having_trouble_with_the_ui/)  
* Clear weaknesses in current open‑source alternatives: heavier UI, higher RAM footprint, complex deployment, fewer integrations. [Source](https://use-apify.com/blog/linear-alternatives-2026) [Source](https://openreplace.com/linear-alternatives) [Source](https://openinstead.dev/alternatives-to/linear/)  
* Structural limitations of Kanban that you can explicitly tackle with planning features and autonomous agents (oversimplification, poor support for complex projects, WIP mismanagement). [Source](https://projectmanagers.net/kanban-boards-top-10-cons-disadvantages-limitations/) [Source](https://philarchive.org/archive/NIRLOK)  

All of these combine into a strong, evidence‑backed case for “projectbase” as a world’s fastest, zero‑friction, open‑source Linear alternative with a lean stack and agent‑augmented Kanban.
