# Secret Manager

A web app for teams to securely store and share project secrets (the contents of
`.env` files) instead of passing them around over Slack, email, or USB sticks.
Secrets are organized **per project** and **per environment**, with **per-user
view/edit permissions**. Onboarding a new developer becomes "add them to the project."

See [PRD.md](./PRD.md) for the full product spec.

## Features (v1)

- Email + password authentication.
- Projects, each with one or more **environments** (e.g. `development`, `staging`, `production`).
- Secrets CRUD with masked values, reveal, and copy-to-clipboard.
- **Import** by pasting a `.env` file; **export** an environment back to a `.env` file.
- Members with **owner / editor / viewer** roles, enforced on both the API and the UI.
- **Per-environment access:** each editor/viewer is granted access to specific
  environments only — they can't even see the environments they weren't given.
- Secret values are **encrypted at rest** (AES-256-GCM) — the database never stores plaintext.

## Tech stack

Next.js (App Router, TypeScript) · Prisma · PostgreSQL · Tailwind CSS ·
bcrypt + JWT session cookies.

## Getting started (local)

You need a PostgreSQL database. The easiest zero-install option is a free
[Neon](https://neon.tech) database — create one and use its connection string both
locally and in production. (You can also run a local Postgres if you prefer.)

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file
cp .env.example .env
# Set DATABASE_URL to your Postgres/Neon connection string, then generate keys:
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MASTER_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 3. Create the tables in your database
npm run db:push

# 4. Run the app
npm run dev
```

Open http://localhost:3000, sign up, and create your first project.

Inspect the database with `npm run db:studio` — note that secret rows store
`ciphertext`, not plaintext.

## Deploy to Vercel + Neon (free)

This app runs great on [Vercel](https://vercel.com)'s free tier with a free
[Neon](https://neon.tech) Postgres database. You'll get a public URL like
`your-app.vercel.app`.

**1. Create a free Postgres database (Neon)**
- Sign up at [neon.tech](https://neon.tech), create a project.
- Copy the **connection string** (looks like
  `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).

**2. Create the tables in Neon (one time, from your machine)**
```bash
# Point DATABASE_URL at your Neon string, then:
npm run db:push
```

**3. Push this code to GitHub**
```bash
git add -A && git commit -m "Secret Manager"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

**4. Import the repo on Vercel**
- At [vercel.com/new](https://vercel.com/new), import your GitHub repo. Vercel
  auto-detects Next.js — leave the build settings as-is.
- Under **Environment Variables**, add all three:
  | Name | Value |
  |------|-------|
  | `DATABASE_URL` | your Neon connection string |
  | `SESSION_SECRET` | a long random string (`openssl rand -hex 32`) |
  | `MASTER_ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`) |
- Click **Deploy**. When it finishes, open the `*.vercel.app` URL.

> ⚠️ **Keep `MASTER_ENCRYPTION_KEY` and `SESSION_SECRET` stable.** If
> `MASTER_ENCRYPTION_KEY` ever changes, previously stored secrets can no longer be
> decrypted. Save these values somewhere safe.

**Custom domain (optional):** a `*.vercel.app` subdomain is free. To use your own
domain (e.g. `secrets.yourcompany.com`) you must buy the domain from a registrar, then
add it under the project's **Domains** tab in Vercel.

**Note on invite links:** once deployed, invite links use your real domain
automatically, so teammates on any machine can open them.

## Roles & access

Editors and viewers only act within the **environments they've been granted**.
Owners have access to every environment automatically.

| Action | Owner | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| View / export secrets (in granted environments) | ✅ (all) | ✅ | ✅ |
| Add / edit / delete secrets (in granted environments) | ✅ (all) | ✅ | ❌ |
| See an environment | all | only granted | only granted |
| Add / remove / rename environments | ✅ | ❌ | ❌ |
| Invite / remove members, set roles & environment access | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ |

When inviting someone (or later, per member), the owner picks exactly which
environments that person can access.

## Known limitations (v1)

- **Server-side encryption**, not yet zero-knowledge/E2E. The `lib/crypto.ts` module is
  isolated so the PRD's client-side encryption + per-user key wrapping can be dropped in
  later without reshaping the data model.
- Invitations **don't send email**. Instead, creating an invite generates a unique,
  copyable link that the owner shares directly (Slack, chat, etc.); the invitee opens it,
  signs up or logs in, and is added to the project. Pending links can be revoked.
- No password reset / recovery key yet.

## Project layout

```
app/            Pages + API route handlers
  api/          Backend endpoints (auth, projects, environments, secrets, members)
components/     Client React components
lib/            db, auth, crypto, authz, env-format, api helpers
prisma/         schema + migrations
```
