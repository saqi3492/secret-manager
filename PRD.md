# PRD: Secret Manager

## Context

Teams working on a shared project keep secrets (API keys, DB credentials, tokens) in
`.env` files. These files are deliberately **not** committed to Git for security, which
creates a distribution problem: the `.env` has to live "somewhere" locally, and every
time a new developer joins, someone has to manually hand them the file (Slack, email,
USB, "just ask a teammate") — insecure, error-prone, and impossible to audit or update.

**Secret Manager** is a web app that gives a team one secure home for their secrets,
organized **per project** and **per environment**, with **per-user view/edit
permissions**. Onboarding a new developer becomes "add them to the project" instead of
"find and re-send the `.env`."

---

## Decisions

| Area | Decision |
|------|----------|
| Form factor | **Web app only** (browser dashboard; secrets copied/exported from the UI) |
| Encryption | **Zero-knowledge / end-to-end** — server never sees plaintext secrets |
| Authentication | **Email + password** |
| MVP scope add-on | **Multiple environments** per project (e.g. dev / staging / prod) |

---

## Goals & Non-Goals

**Goals**
- Replace ad-hoc `.env` sharing with a single, access-controlled source of truth.
- Organize secrets by **project** and **environment**.
- Let a project owner add teammates and grant **view** or **edit** access.
- Guarantee that the server (and anyone who breaches it) cannot read secret values —
  zero-knowledge.
- Make onboarding a new dev a one-step "add to project."

**Non-Goals (for MVP)**
- CLI / SDK to auto-inject secrets into a running app or write a local `.env` (strong
  candidate for v2 — see [Future](#future-out-of-scope-for-mvp)).
- Secret rotation, expiry, or auto-generation.
- Integrations with cloud providers (AWS Secrets Manager, Vault) or CI/CD.
- SSO / GitHub / Google login (v2).
- Secret versioning / rollback and full audit log (v2 — noted as valuable).
- Mobile / desktop apps.

---

## Target Users & Personas

- **Project Owner / Team Lead** — creates projects and environments, invites members,
  sets permissions, manages secrets.
- **Developer (Editor)** — views and edits secrets for projects they belong to.
- **Developer / Contractor (Viewer)** — reads secrets but cannot modify them.

---

## Core Concepts & Data Model

- **User** — account with email + password; holds a personal keypair (see Security).
- **Project** — a workspace for one codebase/team (e.g. "billing-service").
- **Environment** — a named secret set inside a project (e.g. `development`,
  `staging`, `production`). Every project starts with at least one.
- **Secret** — a `KEY = value` pair inside an environment. Value is stored encrypted.
- **Membership** — links a User to a Project with a **role**: `owner`, `editor`,
  or `viewer`.

```
User ──< Membership >── Project ──< Environment ──< Secret
```

**Permissions matrix**

| Action | Owner | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| View secret values | ✅ | ✅ | ✅ |
| Add / edit / delete secrets | ✅ | ✅ | ❌ |
| Add / remove environments | ✅ | ✅ | ❌ |
| Invite / remove members, set roles | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ |

---

## Functional Requirements

### FR1 — Authentication & Account
- Sign up with email + password; email verification.
- Log in / log out; session management.
- Password reset flow. **Note:** because encryption is derived from the password
  (zero-knowledge), a password reset without a recovery mechanism means losing access to
  secrets. This PRD specifies an **account recovery key** issued at signup (see Security).

### FR2 — Projects
- Create a project (name, optional description).
- List projects the user is a member of.
- Rename / delete a project (owner only).

### FR3 — Environments
- Each project has one or more named environments; a default `development` is created
  with the project.
- Add / rename / delete environments (owner/editor).
- Environment switcher in the project view.

### FR4 — Secrets
- Within a selected environment, view secrets as a `KEY = value` list.
- Add, edit, delete secrets (owner/editor).
- Values masked by default with a reveal toggle and copy-to-clipboard.
- **Bulk import** by pasting raw `.env` text → parsed into key/value rows.
- **Bulk export** → download / copy the environment as a `.env`-formatted file.
  (This is what a new developer does to get set up.)

### FR5 — Members & Permissions
- Owner invites a user by email.
- Assign role on invite: `editor` or `viewer`; change role later.
- Remove a member (revokes their access; their key wrap is deleted — see Security).
- Members list per project showing name, email, role.

### FR6 — Onboarding flow
- Owner adds new dev by email → dev accepts invite (or signs up) → dev immediately sees
  the project's environments and can view/export the `.env`. No manual file handoff.

---

## Security Architecture

This is the heart of the product and the main source of implementation risk. Because we
chose **zero-knowledge + web + email/password + team sharing**, the design follows the
established "envelope + per-user keypair" pattern (as used by Bitwarden, 1Password):

1. **Password → key.** On login, the client derives a **Master Key** from the user's
   password using a slow KDF (e.g. Argon2id / PBKDF2 with high iterations). The password
   itself is never sent for decryption; a separate derived hash is used for auth.
2. **User keypair.** Each user has an asymmetric keypair. The **private key** is
   encrypted with the Master Key before being stored on the server.
3. **Per-environment data key.** Each environment has a symmetric **Data Key** that
   actually encrypts the secret values. The Data Key is **wrapped** (encrypted) with the
   public key of every member who has access.
4. **Sharing = re-wrapping.** Adding a member wraps the environment's Data Key with
   their public key; removing a member deletes that wrap. The server only ever stores
   ciphertext + wrapped keys — never plaintext values or the Master Key.
5. **Recovery key.** At signup the user is shown a one-time **recovery key** that can
   decrypt their private key, so a forgotten password doesn't mean permanent data loss.

**Non-functional / security requirements**
- Server stores only ciphertext, wrapped keys, and salted auth hashes — zero plaintext
  secrets, ever.
- All traffic over TLS.
- Rate limiting + lockout on auth endpoints.
- "Reveal"/"copy" actions are client-side only.
- (v2) audit log of view/edit/export events.

> **Trade-off:** true zero-knowledge means the server cannot help with a password reset
> (only the recovery key can). If the team prefers a smoother reset UX, the alternative is
> **server-side encryption** (encrypted at rest with a server-held key), which is simpler
> but lets the server decrypt. This tension is documented explicitly so stakeholders
> choose with eyes open.

---

## Key User Flows

1. **Create & seed a project:** Owner creates project → `development` env auto-created →
   paste existing `.env` → secrets encrypted client-side and saved.
2. **Onboard a developer:** Owner invites dev by email + role → dev signs up / accepts →
   dev opens project, selects environment, clicks **Export .env**.
3. **Rotate a secret:** Editor edits a value → re-encrypted client-side → all members
   automatically see the new value (same wrapped Data Key).
4. **Offboard a developer:** Owner removes member → their key wrap deleted → they lose
   access. (Values should be rotated afterward — noted as guidance.)

---

## MVP Scope Summary

**In:** email/password auth + recovery key, projects, multiple environments, secrets
CRUD, `.env` import/export, member invites with owner/editor/viewer roles, zero-knowledge
client-side encryption.

### Future (out of scope for MVP)
- **CLI / SDK** to pull secrets directly into a local `.env` or inject at runtime
  (highest-value v2 item — closes the loop on the original problem).
- Secret **versioning / history** and rollback.
- **Audit log**.
- SSO / GitHub / Google auth.
- Secret rotation reminders, expiry, generators.
- Cloud/CI integrations.

---

## Success Metrics
- Time to onboard a new developer to a project's secrets (target: < 2 minutes, no manual
  file transfer).
- % of team projects whose secrets live in Secret Manager vs. loose `.env` files.
- Zero plaintext-secret exposure incidents.

---

## Risks & Open Questions
- **Crypto complexity:** the zero-knowledge + sharing model is the hardest part; needs a
  vetted crypto library, not hand-rolled primitives.
- **Recovery UX vs. zero-knowledge:** confirm the recovery-key approach is acceptable, or
  reconsider server-side encryption.
- **Should projects be grouped under an Organization/Team** for billing & bulk member
  management, or is a flat list of projects enough for MVP? (Recommend flat for MVP.)
