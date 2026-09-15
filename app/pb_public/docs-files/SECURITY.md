# Security Policy

## Supported versions

ProjectBase is alpha software. Security fixes are applied to the current `main` branch and may be included in the next release. Older releases are not currently maintained as separate security-support lines.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include secrets, personal data, exploit details, or live-system data in an issue.

Use GitHub's private vulnerability reporting for this repository:

<https://github.com/AndrianBalanescu/ProjectBase/security/advisories/new>

Include, when safe:

- the affected revision or release;
- the component and configuration involved;
- reproduction steps or a minimal proof of concept;
- likely impact and any known mitigations;
- whether the issue has been disclosed elsewhere.

The project is volunteer-maintained and cannot promise a response or remediation deadline. Maintainers will try to acknowledge actionable reports, validate them, coordinate a fix, and credit the reporter if requested and appropriate. Please allow time for triage before public disclosure.

## Scope and operator responsibility

Reports about ProjectBase code and its default deployment files are in scope. Vulnerabilities in PocketBase or another upstream dependency should also be reported to that upstream project when appropriate.

Operators are responsible for TLS termination, network exposure, host security, access controls, secrets, monitoring, backups, and compliance review. Never deploy with example or reused credentials.
