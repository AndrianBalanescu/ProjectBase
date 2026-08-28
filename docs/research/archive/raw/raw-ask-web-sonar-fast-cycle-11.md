You can detect **cross-project blockers** in tools like **Linear** and **Plane** by combining explicit dependency/blocker fields with views that highlight stalled work and shared risks across projects. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://linear.app/docs/projects) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://github.com/makeplane/plane) Below is a web‑search‑grounded outline of how to implement such a feature and what benchmarks to use in sprint retrospectives. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  

---

### 1. Working definition: “blocker” and “cross‑project blocker”

* A **project blocker** is any situation where work *cannot move forward at all* until a specific input, decision, approval, fix, or access is provided. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  
* Blockers differ from simple delays: they **stop execution completely** and have no meaningful workaround. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
* A **cross‑project blocker** is a blocker that:
  * impacts more than one project or team, or  
  * sits on a dependency that multiple projects rely on (e.g., shared infra, design system, central API). [Source](https://nimblehq.co/compass/project/blockers/)  

Web sources emphasize that blocked work must be **named early**, made **visible**, and clearly documented with what is missing and which dependency is involved. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  

---

### 2. What Linear already supports (for blocker detection)

Linear provides native structures for **dependencies and blockers** at both issue and project level. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://linear.app/docs/projects)  

* **Projects as units of work**  
  * Projects are defined as units of work with a clear outcome or completion date, comprised of issues and optional docs. [Source](https://linear.app/docs/projects)  

* **Issue relations (micro‑level blockers)**  
  * Linear supports **issue relations** including *blocked*, *blocking*, *related*, and *duplicate*. [Source](https://linear.app/docs)  
  * These relations let you explicitly mark one issue as blocked by another, or blocking another. [Source](https://linear.app/docs)  

* **Project dependencies (macro‑level blockers)**  
  * Linear supports **project dependencies** that visually depict **blocked and blocking relationships amongst projects**. [Source](https://linear.app/docs/project-dependencies)  
  * Only **end → start** dependencies are supported: one project must finish before another starts. [Source](https://linear.app/docs/project-dependencies)  
  * When a dependency is established, the Project Overview and Properties panel show **“Blocked by”** and **“Blocking”** fields. [Source](https://linear.app/docs/project-dependencies)  
  * In the timeline view, lines connect blocked and blocking projects.  
    * A **blue line** shows a dependency that is not violated. [Source](https://linear.app/docs/project-dependencies)  
    * A **red line** shows a dependency that *has been violated* (e.g., downstream project started or is scheduled before upstream finishes). [Source](https://linear.app/docs/project-dependencies)  

* **How this enables cross‑project blocker detection**  
  * By linking projects with **Blocked by / Blocking** fields and visual timelines, you can see which projects are stuck because another project (or its issues) is unfinished. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs/projects)  
  * Combined with issue‑level “blocked” relations, Linear already provides the data needed for a cross‑project blocker detection feature:  
    * which issues are blocked,  
    * which projects they belong to,  
    * and which upstream projects/issues cause the blockage. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://linear.app/docs/projects)  

---

### 3. What Plane already supports (for blocker‑centric workflows)

Plane is an open‑source project management platform (Jira/Linear‑like) with sprints, tasks, docs, triage, and analytics. [Source](https://github.com/makeplane/plane)  

* **Blocker concept and detection**  
  * Plane’s blocker guidance defines a **project blocker** as a situation where work cannot move forward because it is waiting on approval, dependency, access, or decision. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
  * It emphasizes that if work cannot move forward without a specific input/decision/fix *and there is no meaningful workaround*, the task is *blocked*. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
  * A practical detection rule: watch for tasks **stalled “in progress” without visible change** within an expected time window and treat them as potential blockers. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  

* **Visibility and documentation**  
  * Teams are advised to **mark tasks as blocked**, document what is missing, and name the dependency or decision required. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
  * Blocked work should **stand out clearly** to avoid “silent waiting” and enable faster alignment on next actions. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
  * Blockers should be logged with background, effects on projects (including whether it affects other projects), actions needed, and resolution notes. [Source](https://nimblehq.co/compass/project/blockers/)  

* **Analytics and trends**  
  * Plane’s analytics features highlight trends and help **visualize blockers** across all data to “remove blockers and keep projects moving forward.” [Source](https://github.com/makeplane/plane)  

* **Cross‑project angle**  
  * By explicitly listing “Does it affect other projects?” when documenting blockers, Plane’s recommended process captures **cross‑project impact**. [Source](https://nimblehq.co/compass/project/blockers/)  
  * Combined with analytics, this supports dashboards that show **which blockers are affecting multiple projects or teams at once**. [Source](https://github.com/makeplane/plane) [Source](https://nimblehq.co/compass/project/blockers/)  

---

### 4. Designing a “cross‑project blocker detection” feature

Using patterns from Linear and Plane plus general project‑management guidance, a feature for **cross‑project blocker detection** would typically include:  

* **1. Unified blocker model**

  * Represent blockers at **issue** and **project** level:  
    * Issue‑level: relation types like *blocked* / *blocking*. [Source](https://linear.app/docs)  
    * Project‑level: *Blocked by* / *Blocking* dependencies between projects. [Source](https://linear.app/docs/project-dependencies)  
  * Every blocked item stores:  
    * blocker type (e.g., dependency, approval, access, decision, defect), [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  
    * origin project/team,  
    * impacted projects/teams (for cross‑project classification), [Source](https://nimblehq.co/compass/project/blockers/)  
    * date raised, expected resolution date, current status. [Source](https://nimblehq.co/compass/project/blockers/)  

* **2. Automatic blocker detection from “stalled work”**

  * Use a heuristic similar to Plane: tasks that stay “in progress” with **no stage change, updates, or progress** within an expected window are flagged as *potential blockers*. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them)  
  * Rules can be configured per team or workflow (e.g., flag issue as potential blocker if no movement for 3 working days).  

* **3. Cross‑project dependency graph**

  * Build a graph where:
    * nodes = projects and/or key epics,  
    * edges = dependencies (issue relations or project dependencies). [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://linear.app/docs/projects)  
  * Any node with blockers that:  
    * have edges to multiple downstream projects, or  
    * sit on shared components used by multiple projects  
    is tagged as a **cross‑project blocker**.  

* **4. Dashboards and timeline overlays**

  * For Linear‑style timelines, overlay dependency lines (blue vs red) with counts of blocked downstream projects. [Source](https://linear.app/docs/project-dependencies)  
  * For Plane‑style analytics, provide views grouping blockers by:  
    * number of impacted projects,  
    * teams affected,  
    * area (product, platform, infra). [Source](https://github.com/makeplane/plane) [Source](https://nimblehq.co/compass/project/blockers/)  

* **5. Notifications and escalation paths**

  * When a blocker is detected as “cross‑project” (affects >1 project), automatically:  
    * notify relevant Product Managers/stakeholders, [Source](https://nimblehq.co/compass/project/blockers/)  
    * add it to a central “cross‑project blockers” list,  
    * apply stricter SLA for resolution (e.g., prioritized escalation). [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/)  

---

### 5. Sprint retrospective integration

To use this feature effectively in **sprint retrospectives**, teams focus on blockers as key signals of delivery risk. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  

* **Questions to structure retrospective discussion**

  * Which blockers most severely impacted sprint goals?  
  * How many were **cross‑project** vs local?  
  * Could we have detected them earlier (from stalled work or dependency mapping)? [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/)  
  * Did we have clear ownership and escalation paths for each blocker? [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  
  * Which systemic patterns (e.g., access issues, approvals, environment instability) recurred? [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  

* **Suggested blocker‑centric metrics (benchmarks)**

  Use simple quantitative metrics to benchmark process health across sprints:  

  | Metric | Definition | Example / Computation |
  |---|---|---|
  | **Number of blockers per sprint** | Total count of tasks/projects marked blocked during the sprint. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) | Simple tally from blocker records. |
  | **Cross‑project blockers per sprint** | Count of blockers affecting more than one project or team. [Source](https://nimblehq.co/compass/project/blockers/) | Filter blockers where “affected projects” list size ≥ 2. |
  | **Mean time to unblock (MTTU)** | Average duration from blocker raised to blocker resolved. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) | \(\text{MTTU} = \frac{\sum \text{blocked durations}}{\text{number of resolved blockers}}\) |
  | **Blocked work ratio** | Share of sprint work that spent time in blocked state. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) | \(\text{Ratio} = \frac{\text{blocked story points}}{\text{total completed story points}}\) or per issue count. |
  | **Dependency‑related blockers %** | Percentage of blockers caused by upstream dependency (project or issue). [Source](https://linear.app/docs/project-dependencies) [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) | \(\text{Percent} = \frac{\text{dependency blockers}}{\text{all blockers}} \times 100\%\) |
  | **Approval/decision latency** | Average time from request for approval/decision to response. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers) | Track timestamps on decision requests vs responses. |
  | **Environment/tooling blockers count** | Number of blockers caused by tools, infra, or access. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) | Categorize blockers by type to see technical vs process issues. |

  These metrics align with guidance to make blockers visible, name them explicitly, and evaluate fixability, cost, and impact across projects. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) [Source](https://www.atlassian.com/blog/teamwork/most-common-project-blockers)  

---

### 6. “Feature benchmarks” using software‑engineering research metrics

If you want to *benchmark the detection feature itself* (not just team performance), you can borrow metrics from **cross‑project defect prediction and bug localization** research:  

* **Cross‑project defect prediction**  
  * Research on cross‑project software defect prediction evaluates models using **AUC (Area Under ROC Curve)** and **F1 score** to compare predictive performance across multiple projects. [Source](https://www.techscience.com/cmc/v78n2/55541/html)  
  * For 27 projects from public datasets, one method reported outperforming baselines by at least **1.2% in AUC** and **5.5% in F1** on average. [Source](https://www.techscience.com/cmc/v78n2/55541/html)  

* **Cross‑project bug localization**  
  * Bug‑localization work compares approaches using information‑retrieval metrics like **MRR (Mean Reciprocal Rank)** and **MAP (Mean Average Precision)**. [Source](https://uwspace.uwaterloo.ca/bitstreams/b4a39993-9729-4968-8802-ef2248fc17d0/download)  

* **Applying these ideas to blocker detection**

  If your cross‑project blocker detection feature uses heuristics or ML models (e.g., to predict likely blockers from stalled work and dependency structures), you can measure:  

  * **AUC** — ability of the model to distinguish true blockers from non‑blockers across projects (especially useful on imbalanced data). [Source](https://www.techscience.com/cmc/v78n2/55541/html)  
  * **F1 score** — balance between precision (correct blocker flags) and recall (finding most real blockers). [Source](https://www.techscience.com/cmc/v78n2/55541/html)  
  * **MRR/MAP** — quality of ranking: if the feature ranks “top suspected blockers,” these metrics quantify how high true blockers appear in the list. [Source](https://uwspace.uwaterloo.ca/bitstreams/b4a39993-9729-4968-8802-ef2248fc17d0/download)  

  These metrics give **objective, cross‑project benchmarks** for the quality of detection and prioritization, complementing operational metrics like MTTU and blocked work ratio.  

---

### 7. Practical setup summary (Linear vs Plane)

| Tool | Native blocker/dependency representation | Cross‑project blocker visibility | How to use for sprint retrospectives |
|---|---|---|---|
| **Linear** | Issue relations (*blocked*, *blocking*, etc.) and project‑level *Blocked by* / *Blocking* dependencies with visual timeline lines. [Source](https://linear.app/docs/project-dependencies) [Source](https://linear.app/docs) [Source](https://linear.app/docs/projects) | Timeline with blue/red dependency lines signals violated dependencies; project fields show which projects are blocking others. [Source](https://linear.app/docs/project-dependencies) | Filter issues/projects marked blocked/blocked by; export counts, durations, and dependency types to discuss systemic blockers each sprint. |
| **Plane** | Explicit conceptual model of project blockers (waiting on approval, dependency, access, decision); tasks marked blocked with detailed documentation. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) | Blocker logs include “Does it affect other projects?” and analytics visualize trends and blockers across Plane data. [Source](https://github.com/makeplane/plane) [Source](https://nimblehq.co/compass/project/blockers/) | Use blockers tracker to review cross‑project impact, resolution times, and recurring causes; treat stalled work as signals and refine processes accordingly. [Source](https://plane.so/blog/project-blockers-definition-examples-and-how-to-overcome-them) [Source](https://nimblehq.co/compass/project/blockers/) |

---

If you share your current workflow (e.g., “we use Linear for engineering and Plane for PM,” or specific sprint cadence), I can adapt this into a concrete implementation plan for a cross‑project blocker detection and retrospective dashboard.
