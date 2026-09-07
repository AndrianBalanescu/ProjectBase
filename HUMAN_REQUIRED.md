# HUMAN_REQUIRED — items needing a human decision

> Written by flow builder cycles. Each item is something the agent cannot do
> itself (costs money, uses a real identity, sends real mail, or is otherwise
> outside delegated authority).

## GitHub Actions billing block (cycle 35, 2026-08-25)

**What:** GitHub Actions on `AndrianBalanescu/ProjectBase` will not start jobs.
Annotation on every check run (PR #15):

> "The job was not started because recent account payments have failed or your
> spending limit needs to be increased. Please check the 'Billing & plans'
> section in your settings"

**Impact:** PRs cannot be CI-verified on GitHub runners. Local validation still
passes (202/202 pytest, Docker build, render QA), and PRs can still be merged
manually, but the CI safety net is down until the account billing is fixed.

**Ask:** Resolve the GitHub account billing/spending-limit issue (pay the
invoice or raise the limit) so Actions runners start again. This requires a
real payment on the human's account — not delegated to an agent.

> **Cycle 80 (2026-09-07): still active.** Every CI run on ProjectBase since
> cycle 35 fails in <10s with the same annotation (jobs never start). Local
> gates (pytest 609 passed, real-browser QA, iBrowse audit) remain the
> effective verification path; PRs are merged manually.
