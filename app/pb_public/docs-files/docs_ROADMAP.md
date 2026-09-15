# ProjectBase roadmap

ProjectBase is deliberately narrow. The roadmap protects a fast, lightweight
issue-tracking core instead of competing feature-for-feature with enterprise
project-management suites.

## Product boundary

ProjectBase includes:

- Projects and issues
- Kanban Board and sortable List views
- Cycles for short delivery windows
- Milestones as the roadmap
- A resizable issue drawer with Markdown, relations, labels, assignees, and custom fields
- Passive ingestion of real local coding-agent sessions as execution runs
- Search, bulk actions, import/export, notifications, backup/restore, and a documented API

ProjectBase does not aim to become a billing platform, AI copilot, agent
orchestrator, marketplace, incident-management suite, analytics warehouse, or
multi-tenant enterprise control plane.

## Before the first public alpha

- Keep the complete automated suite green.
- Pass desktop, tablet, and mobile browser audits with no console errors or
  horizontal overflow.
- Verify Docker first boot, upgrades, backup, and restore from a clean checkout.
- Remove author-specific seed data and internal research artifacts.
- Publish checksummed artifacts, release notes, and security reporting guidance.

## After alpha

Work is limited to evidence from real users:

1. Installation and upgrade reliability
2. Accessibility and responsive usability
3. Performance and data integrity
4. Clearer interaction patterns across existing views
5. Stable API and agent-session ingestion contracts

New feature proposals must show that they strengthen the core workflow and
cannot be solved by simplifying or composing existing behavior.
