# Security Policy

## Supported versions

Aeroguard is a local training simulator under active development. Security
fixes are applied to the latest revision of the `main` branch only; there are
no maintained release branches or long-term-support versions yet.

| Version | Supported |
|---|---|
| Latest `main` (current 0.x line) | Yes |
| Older commits, forks and modified deployments | No |

If you are running an older checkout, reproduce the issue on the latest `main`
before reporting it.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub Security Advisories:

1. Open the repository's **Security** tab.
2. Choose **Advisories** → **Report a vulnerability**.
3. Describe the issue, affected revision, reproduction steps and impact.

This creates a private thread visible only to the maintainers and the reporter.
If GitHub Security Advisories are unavailable, contact a maintainer directly
through a private channel rather than a public issue or discussion.

### What to expect

This is a volunteer open-source project, so responses are best-effort:

- acknowledgement of the report, normally within a few business days;
- an initial assessment and severity triage;
- a fix or mitigation on `main`, and credit in the advisory if you would like
  it;
- coordinated disclosure once a fix is available. Please allow up to 90 days
  before publishing details.

## What not to report publicly

Do **not** disclose any of the following in public issues, pull requests,
discussions or social media:

- working exploit details, proof-of-concept payloads or reproduction steps for
  an unfixed vulnerability;
- credentials, tokens, API keys, database contents or other secrets;
- details of a vulnerable deployment that is not your own;
- anything that could be read as operational counter-drone guidance, targeting
  information or real-world sensor/effector weaknesses.

If you accidentally publish sensitive details, say so in the private advisory
so maintainers can rotate credentials and coordinate disclosure.

## Scope

### In scope

- The FastAPI backend in `backend/` (API validation, session/scoring
  integrity, storage, authentication if added).
- The simulator client in `client/` and the instructor dashboard in
  `dashboard/`.
- The optional Unity spike in `unity/Aeroguard-Unity/`.
- Docker Compose configuration and the documented local setup.
- Server-authoritative scoring guarantees: a client must not be able to
  inflate a score, forge another trainee's events, or bypass event validation.
- Path traversal, injection, unsafe deserialisation and secret leakage in the
  code or committed configuration.

### Out of scope

Aeroguard is a **localhost training simulator**. It is explicitly **not** an
operational counter-drone system, a command-and-control platform, a
weapon-targeting system or an interception system. The following are therefore
not security vulnerabilities in this project:

- the absence of real drone detection, tracking, jamming or engagement
  capability;
- attacks that require an already-compromised local machine, browser or Unity
  editor;
- denial of service against a single-user localhost instance;
- vulnerabilities in third-party dependencies that are already publicly known
  and have an upstream fix (report those upstream; a PR bumping the pin is
  welcome);
- missing hardening that only matters for internet-facing production
  deployments, which this project does not support;
- social engineering and physical access attacks;
- documentation typos and non-security bugs.

When in doubt, report privately. We would rather triage a non-issue than miss a
real one.

## Safe harbour

We will not pursue legal action against researchers who make a good-faith
effort to follow this policy, avoid privacy violations and service disruption,
and give us reasonable time to fix the issue before disclosure.
