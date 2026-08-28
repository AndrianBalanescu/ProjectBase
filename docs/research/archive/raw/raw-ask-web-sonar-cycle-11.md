Here is a compact benchmark-style overview of Linear vs Plane for cross‑project blocker detection, sprint retrospective metrics to track, and the most valuable competitive analysis sources you can use.

## 1. Linear vs Plane: cross‑project blocker detection

Linear and Plane both support explicit blocker modeling, but they surface and analyze it in different ways. [Source](https://linear.app/docs/project-dependencies) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://linear.app/docs) [Source](https://github.com/makeplane/plane)

|Capability|Linear|Plane|
|---|---|---|
|Mark blocked work|Issues can be labeled as **blocked**, **blocking**, **related**, or **duplicate**, visible in issue properties and views. [Source](https://linear.app/docs)|Tasks are treated as **project blockers** when work cannot move forward at all; blockers are explicitly named with the missing decision, approval, or access. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)|
|Cross‑project dependencies|Projects can be linked with **Blocked by** / **Blocking** relationships in timelines; lines connect dependent projects and violations are shown with a red line. [Source](https://linear.app/docs/project-dependencies)|Project blockers are modeled at the task/workstream level, focusing on stalled tasks across projects rather than explicit project‑to‑project timelines. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://github.com/makeplane/plane)|
|Detection signal|Dependencies are visible in project overview and timeline, helping teams see which projects are blocking others. [Source](https://linear.app/docs/project-dependencies)|Blocked work is detected by watching for stalled tasks with no stage movement or updates, then marking them as blockers. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)|
|Analytics on blockers|Issue and project views show blocked relationships; teams can query and filter by blocked/blocking states. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs)|Analytics features emphasize “visualize trends, remove blockers, and keep your projects moving forward,” giving real‑time insights across Plane data. [Source](https://github.com/makeplane/plane)|
|Resolution workflow|Dependencies can be created/edited via project menus or timeline drag interactions, making it easy to adjust blocking relationships. [Source](https://linear.app/docs/project-dependencies)|Guidance stresses making blockers visible immediately, documenting the dependency/decision required, and turning that into clear ownership for resolution. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)|

**Implication for benchmarks**

* Linear is strong on explicit cross‑project dependency visualization; a benchmark feature is full timeline‑level visualization of “blocked by / blocking” relationships plus violation signals. [Source](https://linear.app/docs/project-dependencies)  
* Plane is strong on **operational blocker detection** (stalled work, visibility, analytics); a benchmark feature is automatic surfacing of stalled tasks as blockers and analytics on blocker trends. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://github.com/makeplane/plane)

## 2. Sprint retrospective feature benchmarks

For a sprint‑retro feature, focus on metrics that teams commonly track and the outcomes high‑performing teams achieve. [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://www.projectmanagement.com/blog-post/46051/metrics-and-measuring-techniques-in-the-retrospective-meeting) [Source](https://www.scrum.org/resources/what-is-a-sprint-retrospective) [Source](https://predictable.delivery/blog/sprint-retrospective-that-works) [Source](https://dl.acm.org/doi/pdf/10.1145/3639474.3640074)

### Core metrics to support

* **Commitment vs completion**: story points or items completed vs committed per sprint. [Source](https://www.projectmanagement.com/blog-post/46051/metrics-and-measuring-techniques-in-the-retrospective-meeting) [Source](https://predictable.delivery/blog/sprint-retrospective-that-works)  
* **Blocked work**: count and duration of blocked items, plus which dependencies caused them. [Source](https://predictable.delivery/blog/sprint-retrospective-that-works) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
* **Flow metrics**: cycle time, throughput, and unplanned work arriving mid‑sprint. [Source](https://predictable.delivery/blog/sprint-retrospective-that-works)  
* **Action item completion**: percent of retro action items completed by the next sprint. [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://predictable.delivery/blog/sprint-retrospective-that-works)  
* **Team satisfaction / friction**: simple ratings or one‑word/one‑sentence feedback on the sprint and retro. [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://www.projectmanagement.com/blog-post/46051/metrics-and-measuring-techniques-in-the-retrospective-meeting) [Source](https://workshopweaver.com/retrospectives/sprint-retrospective) [Source](https://dl.acm.org/doi/pdf/10.1145/3639474.3640074)  
* **Process improvement rate**: measurable improvements across quarters (e.g., reduced cycle time, fewer blockers). [Source](https://count.co/metric/sprint-retrospective-analysis)

### Benchmarks from industry data

Count.co’s retrospective benchmark data for SaaS/tech teams shows typical ranges. [Source](https://count.co/metric/sprint-retrospective-analysis)

|Metric|Benchmark (SaaS/Tech)|Notes|
|---|---|---|
|Retro frequency|100% of sprints run a retro [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://www.scrum.org/resources/what-is-a-sprint-retrospective)|Run one retro every sprint.|
|Action item completion|~70–85% of retro action items completed [Source](https://count.co/metric/sprint-retrospective-analysis)|Higher completion correlates with better process improvement.|
|Team satisfaction|~4.0–4.5/5 average score [Source](https://count.co/metric/sprint-retrospective-analysis)|Use a simple rating scale post‑retro.|
|Process improvement|~15–25% quarterly improvement in key process metrics [Source](https://count.co/metric/sprint-retrospective-analysis)|Track a primary metric (cycle time, throughput, blockers).|

Good practice patterns for retrospectives include starting from data (commit vs complete, blocked items) then identifying the single biggest friction source and turning it into **one concrete experiment** with an owner and measurable outcome for the next sprint. [Source](https://predictable.delivery/blog/sprint-retrospective-that-works) Retros should explicitly aim to “plan ways to increase quality and effectiveness,” aligning metrics and experiments with that goal. [Source](https://www.scrum.org/resources/what-is-a-sprint-retrospective) [Source](https://www.atlassian.com/blog/agile/retrospectives-atlassian)

**Implication for benchmarks**

* A strong retro feature should pre‑populate data: committed vs completed, blocked items and duration, and flow metrics. [Source](https://predictable.delivery/blog/sprint-retrospective-that-works) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
* It should track **experiments** and **action items** across sprints with completion rates and impact on core metrics. [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://predictable.delivery/blog/sprint-retrospective-that-works)  
* It should capture **team satisfaction** and friction in a lightweight way (ratings, one‑word summaries). [Source](https://count.co/metric/sprint-retrospective-analysis) [Source](https://workshopweaver.com/retrospectives/sprint-retrospective) [Source](https://dl.acm.org/doi/pdf/10.1145/3639474.3640074)  

## 3. Deep competitive analysis sources

For competitive research against tools like Linear and Plane (and broader PM/issue‑tracking products), combine structured monitoring of competitor surfaces with third‑party data. [Source](https://www.infodesk.com/blog/how-to-get-competitive-data-10-free-sources-you-can-use) [Source](https://visualping.io/blog/competitive-intelligence-sources) [Source](https://www.cmu.edu/swartz-center-for-entrepreneurship/assets/Olympus%20pdfs/Competitive%20Analysis.pdf) [Source](https://zapier.com/blog/competitor-analysis-tools/)

### High‑value external surfaces

* **Pricing and packaging pages**: crucial for positioning and value differentiation. [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **API, docs, and changelog**: show velocity and direction of product changes (new blocker features, analytics, retrospectives). [Source](https://visualping.io/blog/competitive-intelligence-sources) [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://github.com/makeplane/plane)  
* **Investor relations / filings**: reveal strategic priorities and KPIs for public competitors. [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **Events and webinars**: surface messaging, new feature launches, and target segments. [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **Careers pages**: indicate upcoming initiatives (e.g., hiring around analytics, AI, or retrospectives). [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **Partners and integrations**: show ecosystem strategy and areas of expansion. [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **App stores and review sites**: provide product reviews, ratings, and common pain points. [Source](https://visualping.io/blog/competitive-intelligence-sources) [Source](https://www.infodesk.com/blog/how-to-get-competitive-data-10-free-sources-you-can-use)

### Tools and methods

* **Competitive monitoring tools**: track changes across pricing, docs, changelog, and other surfaces in near‑real time. [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* **Search‑based tools**: use web search, trends, analytics, merchant reports, and news alerts to track what competitors publish and how they perform. [Source](https://zapier.com/blog/competitor-analysis-tools/)  
* **Customer discovery interviews**: talk to users who have evaluated multiple tools (including Linear and Plane) to understand decision drivers and shortcomings. [Source](https://www.cmu.edu/swartz-center-for-entrepreneurship/assets/Olympus%20pdfs/Competitive%20Analysis.pdf)  
* **Competitors’ advertising and collateral**: analyze ads, sales brochures, and comparison pages for claimed differentiators. [Source](https://www.cmu.edu/swartz-center-for-entrepreneurship/assets/Olympus%20pdfs/Competitive%20Analysis.pdf) [Source](https://www.infodesk.com/blog/how-to-get-competitive-data-10-free-sources-you-can-use)  
* **Professional networks and communities**: gather anecdotal but valuable comparisons from practitioners. [Source](https://www.cmu.edu/swartz-center-for-entrepreneurship/assets/Olympus%20pdfs/Competitive%20Analysis.pdf)

**Implication for benchmarks**

* Monitor **docs/changelog**, **analytics/retrospective features**, and **blocker‑related content** for Linear and Plane to understand how they evolve cross‑project blocker detection and retro analytics. [Source](https://linear.app/docs/project-dependencies) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://linear.app/docs) [Source](https://github.com/makeplane/plane) [Source](https://visualping.io/blog/competitive-intelligence-sources)  
* Combine **quantitative signals** (pricing, release cadence, feature density) with **qualitative signals** (reviews, interviews, community sentiment) for a deep competitive view. [Source](https://www.infodesk.com/blog/how-to-get-competitive-data-10-free-sources-you-can-use) [Source](https://visualping.io/blog/competitive-intelligence-sources) [Source](https://www.cmu.edu/swartz-center-for-entrepreneurship/assets/Olympus%20pdfs/Competitive%20Analysis.pdf) [Source](https://zapier.com/blog/competitor-analysis-tools/)  

If you share your goals (e.g., “design a better blocker‑detection feature than Linear/Plane” or “build retro analytics that outperform benchmarks”), a more targeted benchmark and source list can be tailored around that.
