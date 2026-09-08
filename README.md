# P/A Archive

Independent research repository, peer‑review workflow, and **persistent identifier
registry** for **P/A Institute**.

- **Service name:** P/A Archive
- **Operator:** P/A Institute
- **Planned URL:** `https://archive.platodesignlab.com`
- **Parent domain:** `platodesignlab.com`

### Production status

> **Not yet deployed.** The codebase is production‑ready and fully verified
> locally (tests, build, lint, HTTP smoke test — see [Tests](#tests)), but the
> live Vercel project, production database, object store, custom domain and
> first admin have **not** been created — those steps require the operator's
> Vercel/DNS access. Follow [§7 Production Deployment (runbook)](#7-production-deployment-runbook)
> and [§8 launch checklist](#8-production-launch-checklist).
>
> Once live, this line becomes:
> `Production: https://archive.platodesignlab.com` — and not before.

P/A Archive lets researchers deposit scholarly works, generates a public landing
page for each, and assigns a **permanent identifier**. It is a standalone
application (its own Vercel project / database / storage), not a page bolted onto
an existing site.

> ### Identifier policy — read this first
>
> When **no Crossref/DataCite DOI prefix + API credentials are configured**, the
> system issues **P/A Identifiers only**:
>
> ```
> PAID:2026:000001   →   https://archive.platodesignlab.com/records/000001
> ```
>
> In that state the application **never** displays a value as a registered DOI,
> never emits `citation_doi`, never puts a DOI in JSON‑LD / BibTeX / RIS, and
> never claims DOI‑registration authority. When a real registrar is later
> connected, records additionally receive a formal DOI such as
> `10.<prefix>/pa.2026.000001` — see *[Connecting a real DOI registrar](#6-connecting-a-real-doi-registrar)*.

---

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router, RSC, Route Handlers, Server Actions) | No separate backend service |
| Language | **TypeScript** (strict) | |
| Database | **PostgreSQL** via **Prisma ORM** | Works on Neon, Supabase, Vercel Postgres, RDS, self‑hosted — not locked to one |
| Auth | **NextAuth v5** (Credentials + JWT sessions) | Adapter tables kept for future ORCID / OAuth |
| Object storage | Pluggable: `local` \| `s3` \| `vercel-blob` | Selected by `STORAGE_PROVIDER`; S3 driver covers AWS S3 / R2 / MinIO / B2 |
| Identifiers | Pluggable `IdentifierProvider`: `LocalIdentifierProvider` (always on) \| `CrossrefProvider` \| `DataCiteProvider` | Selected by `DOI_PROVIDER`; DOI providers activate only when fully credentialed |
| Validation | **Zod** | Draft schema (permissive) + publish schema (strict) |
| Styling | **Tailwind CSS** | White / black / deep‑navy academic palette, restrained radii, no gradients |
| Tests | **Jest** + **ts-jest** | Pure‑function unit tests |

---

## 1. Implemented features

**Accounts & authorization**
- Roles with a strict hierarchy: `READER` < `SUBMITTER` < `REVIEWER` < `EDITOR` < `ADMIN`.
- Open self‑registration as `SUBMITTER` (toggle with `ALLOW_OPEN_SIGNUP`); elevated
  roles are assigned only by an admin.
- Every protected route **and** every mutating action re‑checks the role
  **server‑side** (`requireRole`, `checkApiRole`, `canManageRecord`). Middleware
  gates whole areas (`/admin`, `/editor`, `/review`, `/submit`, `/dashboard`).
- Passwords hashed with bcrypt (cost 12). Admins can create/disable users and
  change roles (cannot change their own).

**Homepage** (`/`) — dense academic layout: description, search box, latest public
records, category list with counts, submit call‑to‑action, peer‑reviewed badges,
P/A Identifier (or DOI) shown per record, live identifier‑policy notice. No hero
image, no marketing copy, no animation.

**Submission system** (`/submit` → `/dashboard/records/<id>/edit`)
- Full metadata: title, subtitle, authors (repeatable, with ORCID / given /
  family / affiliation / corresponding flag), abstract, keywords, publication
  type, language, license, publication date, references, related identifiers
  (repeatable, typed relation), funding (repeatable), conflict of interest,
  ethics statement, version label.
- All 13 publication types: journal article, preprint, book, book chapter,
  working paper, research note, dataset, software, peer review, report, thesis,
  presentation, other.
- File uploads: PDF, DOCX/DOC/ODT/RTF, TXT/MD, CSV/TSV, JSON/JSON‑LD/XML,
  BibTeX/RIS, ZIP/TAR/GZ/7Z, images (PNG/JPG/GIF/WEBP/SVG/TIFF), spreadsheets,
  presentations, scientific formats (Parquet, HDF5, NetCDF, FITS), audio/video.
  Executable / script types (`exe`, `sh`, `js`, `jar`, `msi`, …) are rejected by
  an explicit block‑list **plus** an allow‑list **plus** a MIME‑prefix check
  **plus** a size limit (`MAX_UPLOAD_BYTES`, default 50 MiB).

**Draft / Publish**
- New submissions are saved as `DRAFT` (private).
- Publishing runs, in order: metadata validation (strict Zod schema) → file
  existence check → license confirmation → identifier confirmation → publication
  timestamp → public landing page generation.
- The concept **record id / PAID is fixed at draft creation** and never changes
  across publish, versions, corrections, or retraction.

**Persistent identifiers**
- `PAID:YYYY:NNNNNN`, 6‑digit zero‑padded.
- The number is allocated by **inserting a row** into `paid_allocations` inside a
  transaction; the auto‑increment primary key *is* the number. Rows are never
  deleted → **numbers are never reused**, even after a record is deleted.
- `identifierStatus` on each identifier row: `LOCAL` (P/A Identifier, usable now),
  `RESERVED`, `PENDING`, `REGISTERED`, `FAILED` (DOI lifecycle).

**DOI adapter**
- `IdentifierProvider` interface; `LocalIdentifierProvider` always active;
  `CrossrefProvider` (async XML deposit → `PENDING`) and `DataCiteProvider` (REST
  `/dois` → `REGISTERED`/`FAILED`) activate **only** when their prefix +
  username + password are all set.
- A DOI failure **never breaks publication** — the record is published with its
  PAID, the DOI row is stored as `FAILED`/`PENDING`, a warning is surfaced, and an
  admin can retry from **Admin → Identifiers & DOI**.

**Record page** (`/records/000001`, `?version=N` for older versions)
- Title, subtitle, authors + ORCID links + affiliations, abstract, keywords
  (link to filtered search), publication date, version, license, files (with
  size + SHA‑256), identifier panel, DOI panel (or an explicit "no registered
  DOI" note), citation widget, peer‑review status, references, related works,
  version history, funding / COI / ethics, download count.
- Correction / retraction / withdrawal banners.
- Machine‑readable metadata: **JSON**, **JSON‑LD** (schema.org), **BibTeX**,
  **RIS**, **Dublin Core (XML)** — all linked from the page and served at
  `/api/records/<id>/metadata?format=…`.
- `<script type="application/ld+json">` schema.org block embedded in the page.
- Highwire `citation_*` meta tags for Google Scholar (`citation_doi` only when a
  DOI is genuinely registered).

**Citation** — APA, Chicago, MLA, BibTeX, RIS, generated client‑side and also via
`/api/records/<id>/citation?style=…`. When there is no registered DOI the
citation points at the P/A landing‑page URL.

**Search** (`/search`, and `/records` for browse) — case‑insensitive metadata
search over title, subtitle, abstract, keywords, author name, ORCID, P/A
Identifier and DOI. Filters: year, type, language, category, peer‑reviewed,
author, keyword. Sort by newest/oldest. Faceted counts. Portable across any
Postgres provider (no extension required).

**Peer review**
- Editors assign reviewers (`/editor/records/<id>`); status flows
  `NOT_REVIEWED → UNDER_REVIEW → REVISION_REQUESTED → ACCEPTED / REJECTED → PUBLISHED`.
- Reviewers submit a recommendation + public review body + confidential
  editor‑only comments (`/review`, `/review/<id>`).
- A "Peer reviewed" badge is shown **only** when status is `ACCEPTED` or
  `PUBLISHED`.
- With reviewer consent, an editor can **publish a review as its own record**
  (type `PEER_REVIEW`, its own PAID), linked to the article with `reviews` /
  `isReviewedBy` relationships.

**Versioning** — concept `Record` vs `RecordVersion` are separate. "Create new
version" copies metadata + file rows into a new `DRAFT` version **without
overwriting** the previous version's files or metadata. All published versions
remain viewable; version history is shown on the record page.

**Corrections / retraction / withdrawal** — `RecordNotice` rows are permanent.
`CORRECTION` keeps the record `PUBLISHED` with a notice; `RETRACTION` marks it
`RETRACTED` but keeps files and page online with a banner; `WITHDRAWAL` marks it
`WITHDRAWN` (removed from listings + `noindex`, tombstone kept). **History is
never deleted.**

**Admin** (`/admin`) — overview stats; users (list / create / role change /
disable); records; reviews (assignments + submissions); identifiers & DOI
(provider config readout, failed/pending DOI list with retry); downloads (top 30
days); audit log (filterable, paginated); storage usage.

**Relationships** — `reviews`, `isReviewedBy`, `isNewVersionOf`,
`isPreviousVersionOf`, `cites`, `isSupplementTo`, `isSupplementedBy`, `corrects`,
`isCorrectedBy` — to other records or to external identifiers.

**Audit log** — `publish`, `unpublish`, `metadata_update`, `file_upload`,
`file_replace`, `file_delete`, `version_create`, `review_assignment`,
`review_submission`, `review_status_change`, `identifier_generation`,
`doi_registration`, `doi_registration_failed`, `correction`, `retraction`,
`withdrawal`, `user_register`, `user_role_change`, `download`. IP addresses are
stored as a salted one‑way hash, never in the clear.

**REST API**
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/records` | public | Search / list published records (same query params as `/search`) |
| `GET /api/records/:id` | public | Full metadata JSON for a published record |
| `POST /api/records` | submitter+ | Create a draft |
| `PATCH /api/records/:id` | owner / editor | Update draft metadata |
| `POST /api/records/:id/publish` | owner / editor | Validate + publish |
| `POST /api/records/:id/files` | owner / editor | Upload / replace a file (multipart) |
| `DELETE /api/records/:id/files?fileId=` | owner / editor | Remove a draft file |
| `GET /api/records/:id/metadata?format=json\|json-ld\|bibtex\|ris\|dublin-core` | public | Machine metadata |
| `GET /api/records/:id/citation?style=apa\|chicago\|mla\|bibtex\|ris` | public | Citation string(s) |
| `GET /api/files/:id/download` | public (published) / owner (draft) | File download + counted |

Public read endpoints send `Access-Control-Allow-Origin: *`; mutating endpoints
require an authenticated session and re‑check role server‑side. (Machine‑to‑machine
API keys are a documented future extension — see §24 below.)

**SEO / academic metadata** — per‑record `citation_*` tags, canonical URLs,
schema.org `ScholarlyArticle`/`Dataset`/… JSON‑LD, `noindex` on drafts / admin /
withdrawn records.

**robots.txt / sitemap.xml** — auto‑generated. Sitemap lists only `PUBLISHED` /
`RETRACTED` records; `/admin`, `/editor`, `/review`, `/dashboard`, `/submit`,
`/api/` and drafts are disallowed / not indexed.

**Legal / policy pages** (all clearly marked *placeholder*): `/about`, `/terms`,
`/privacy`, `/contact`, `/policies/publication`, `/policies/peer-review`,
`/policies/research-integrity`, `/policies/retraction`, `/policies/copyright`.

**Data model** — `users`, `organizations`, `records`, `record_versions`, `files`,
`authors`, `record_authors`, `identifiers`, `paid_allocations`, `relationships`,
`peer_reviews`, `review_assignments`, `licenses`, `record_notices`, `audit_logs`,
`download_events`, plus NextAuth adapter tables and a generic `counters` table.

**Seed** — 7 licenses (idempotent), demo users, and (dev only) exactly one sample
record. The sample record is **never** created when `NODE_ENV=production`.

---

## 2. Not implemented (future work)

These are intentionally out of scope for the MVP but the architecture leaves room
for each:

- **Crossref submission‑log reconciliation.** A successful Crossref deposit is
  asynchronous; the DOI row is left `PENDING` and an admin retry re‑submits. A
  background job that polls Crossref's submission log and flips
  `PENDING → REGISTERED/FAILED` is not included.
- **ORCID / OAuth login.** Adapter tables (`accounts`, `sessions`,
  `verification_tokens`) exist; only Credentials login is wired up.
- **Machine‑to‑machine API keys / webhooks.** The API currently authenticates via
  session cookie. An `api_keys` table + bearer‑token middleware is the intended
  extension for external journals/publishers.
- **OAI‑PMH endpoint, JATS XML ingest/export, Crossref metadata ingestion,
  OpenAlex / ROR enrichment, citation graph, LOCKSS/CLOCKSS.**
- **Full‑text search of file *contents*** (only metadata is searched). A
  `pg_trgm` / `tsvector` upgrade for ranked metadata search is a drop‑in
  improvement on Postgres providers that allow extensions.
- **Email notifications** (reviewer invitations, decisions).
- **Rich‑text abstract / Markdown rendering** (abstracts are stored & shown as
  plain text — deliberately, to avoid a Markdown‑injection surface).
- **Shared‑store rate limiting.** A fixed‑window limiter is implemented and
  active (`lib/rate-limit.ts`), but its state is per‑instance. Swap in Upstash
  Redis / Vercel KV for a strict global limit.
- **WAF / bot management / DDoS protection** beyond the app limiter (add at the
  Vercel/Cloudflare edge).
- **Antivirus / content scanning** of uploads (type, extension, size, and
  path‑traversal checks only).
- **2FA, SSO, email verification** for accounts.
- **PDF thumbnail / preview generation.**
- **Institutional / external‑journal hosting, multi‑tenant organizations** (the
  `organizations` table exists but there is no org admin UI yet).
- **`prisma.config.ts` migration** (currently uses the `package.json#prisma`
  key, deprecated in Prisma 7; fine on the pinned Prisma 6).

---

## 3. Environment variables

Copy `env.example` to `.env.local` for local development
(`cp env.example .env.local`), or set the same keys in the Vercel dashboard.
*This repo's tooling blocks writing dotfiles, hence the `env.example` name.*

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **yes** | `http://localhost:3000` | Canonical public origin, no trailing slash. Prod: `https://archive.platodesignlab.com` |
| `APP_URL` | no | = `NEXT_PUBLIC_SITE_URL` | Server-only canonical-origin override; wins over the public var. Never uses `VERCEL_URL`, so previews keep the prod host. |
| `NEXT_PUBLIC_OPERATOR_NAME` | no | `P/A Institute` | |
| `NEXT_PUBLIC_SERVICE_NAME` | no | `P/A Archive` | |
| `NEXT_PUBLIC_PARENT_DOMAIN` | no | `platodesignlab.com` | |
| `DATABASE_URL` | **yes** | — | Pooled Postgres connection string (app runtime) |
| `DIRECT_DATABASE_URL` | no | = `DATABASE_URL` | Non‑pooled URL used **only** by `prisma migrate` (Neon/Supabase). Prisma reads this exact name. |
| `AUTH_SECRET` | **yes** | — | `openssl rand -base64 32` |
| `AUTH_URL` | **yes (prod)** | auto | e.g. `https://archive.platodesignlab.com` |
| `AUTH_TRUST_HOST` | **yes (Vercel)** | `true` | |
| `STORAGE_PROVIDER` | **yes (prod)** | `local` | `local` \| `s3` \| `vercel-blob`. `local` is **refused in production** unless the escape hatch below is set. |
| `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` | no | `false` | Self-hosting escape hatch for a persistent volume. Keep `false` on Vercel. |
| `STORAGE_LOCAL_DIR` | no | `./storage-data` | `local` only — **not usable on Vercel** |
| `BLOB_READ_WRITE_TOKEN` | if `vercel-blob` | — | Auto‑injected on Vercel when a Blob store is linked |
| `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | if `s3` | — | Also `npm i @aws-sdk/client-s3` |
| `S3_ENDPOINT` | if non‑AWS S3 | — | e.g. R2 endpoint; enables path‑style |
| `S3_PUBLIC_BASE_URL` | no | — | CDN / public base for direct downloads |
| `MAX_UPLOAD_BYTES` | no | `52428800` | 50 MiB |
| `RATE_LIMIT_ENABLED` | no | `true` | In-process fixed-window limiter on auth / upload / API / DOI retry |
| `TRUST_PROXY_HEADERS` | no | `true` | Trust `x-forwarded-for` for the client IP (true on Vercel) |
| `DEBUG_ERRORS` / `DEBUG_LOG` | no | `false` | Verbose server logs. Stack traces are never sent to clients regardless. |
| `DOI_PROVIDER` | no | `local` | `local` \| `crossref` \| `datacite` |
| `DOI_PREFIX` | no | — | **Only** a prefix assigned by Crossref/DataCite. Never invent one. |
| `DOI_SUFFIX_NAMESPACE` | no | `pa` | → `10.<prefix>/pa.2026.000001` |
| `CROSSREF_USERNAME` / `CROSSREF_PASSWORD` / `CROSSREF_PREFIX` | if `crossref` | — | All three needed to activate |
| `CROSSREF_DEPOSIT_URL` | no | `https://api.crossref.org/deposits` | |
| `CROSSREF_DEPOSITOR_NAME` / `CROSSREF_DEPOSITOR_EMAIL` | if `crossref` | — | |
| `DATACITE_USERNAME` / `DATACITE_PASSWORD` / `DATACITE_PREFIX` | if `datacite` | — | All three needed to activate |
| `DATACITE_API_URL` | no | `https://api.datacite.org` | Test: `https://api.test.datacite.org` |
| `ALLOW_OPEN_SIGNUP` | no | `true` | `false` → admin creates all accounts |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` / `INITIAL_ADMIN_NAME` | prod bootstrap | — | Used once by `npm run create-admin`, then unset. Password ≥ 12 chars. |
| `SEED_DEMO_USERS` | **dev only** | `false` | Must be `"true"` **and** `SEED_DEFAULT_PASSWORD` set to create demo users. Ignored in production. |
| `SEED_DEFAULT_PASSWORD` | **dev only** | — | No built-in default. Demo users are skipped without it. |
| `SEED_SAMPLE_RECORD` | **dev only** | `false` | Ignored when `NODE_ENV=production`; also needs `SEED_DEMO_USERS=true`. |
| `SMOKE_BASE_URL` / `SMOKE_EMAIL` / `SMOKE_PASSWORD` | no | — | Target + creds for `npm run smoke:prod` |

---

## 4. Local development

**Prerequisites:** Node ≥ 20, a PostgreSQL database.

```bash
# 1. install
npm install

# 2. configure
cp env.example .env.local
#   → set DATABASE_URL and AUTH_SECRET at minimum
#   → AUTH_SECRET:  openssl rand -base64 32
#   → for demo data, also set:  SEED_DEMO_USERS=true  SEED_DEFAULT_PASSWORD=<12+ chars>

# 3. create the schema
npm run prisma:migrate      # dev: applies migrations, creates the DB objects

# 4. seed licenses (+ demo users & one sample record if SEED_DEMO_USERS=true)
npm run db:seed

# 5. run
npm run dev                 # http://localhost:3000  (port 3008 via .claude/launch.json)
```

**Demo accounts** — created **only** when `SEED_DEMO_USERS=true` **and**
`SEED_DEFAULT_PASSWORD` is set (there is no built-in default password, and the
seed creates nothing user-related in `NODE_ENV=production`):

| Email | Role |
|---|---|
| `admin@pa.archive` | Administrator |
| `editor@pa.archive` | Editor |
| `reviewer@pa.archive` | Reviewer |
| `submitter@pa.archive` | Submitter |

All four share `SEED_DEFAULT_PASSWORD`. These accounts must never exist in
production — use `npm run create-admin` there instead.

**Scripts**

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run prisma:migrate` | `prisma migrate dev` (local) |
| `npm run prisma:deploy` | `prisma migrate deploy` (CI / prod — **use this in production**) |
| `npm run db:push` | Push schema without a migration (**prototyping only, never prod**) |
| `npm run db:seed` | Run `prisma/seed.ts` (licenses always; demo data gated) |
| `npm run create-admin` | Create/promote the first ADMIN safely (see Production runbook) |
| `npm run check-env` | Preflight: validate a production env for consistency & safety (connects to nothing) |
| `npm run backfill-checksums` | Compute + store SHA-256 for file rows missing one (`-- --dry` to preview) |
| `npm run smoke:prod` | HTTP end-to-end smoke test against `SMOKE_BASE_URL` |
| `npm run prisma:studio` | Prisma Studio |

**Database creation** — any Postgres works. Examples:

- **Neon:** create a project → copy the *pooled* connection string to
  `DATABASE_URL` and the *direct* one to `DIRECT_DATABASE_URL`.
- **Supabase:** Project → Database → Connection string (URI). Use the
  `...pooler...:6543` URL for `DATABASE_URL`, the `:5432` URL for
  `DIRECT_DATABASE_URL`.
- **Vercel Postgres:** add the integration; `DATABASE_URL` is injected.
- **Local:** `createdb pa_archive` then
  `DATABASE_URL=postgresql://localhost:5432/pa_archive`.

**Storage setup**

- **local** (default): files land in `./storage-data`, streamed through
  `/api/files/:id/download`. Fine for dev / self‑hosting; **not** for Vercel
  (ephemeral FS).
- **vercel-blob:** `STORAGE_PROVIDER=vercel-blob`; create a Blob store in the
  Vercel dashboard and link it (token auto‑injected). For local testing paste
  `BLOB_READ_WRITE_TOKEN`.
- **s3:** `STORAGE_PROVIDER=s3`, install the optional dep
  (`npm i @aws-sdk/client-s3`), set the `S3_*` vars. Works with AWS S3,
  Cloudflare R2 (`S3_ENDPOINT`), MinIO, Backblaze B2.

---

## 5. Deploying to Vercel

Short version — **the full, ordered procedure with the launch checklist is
[§7 Production Deployment (runbook)](#7-production-deployment-runbook) and
[§8 Production launch checklist](#8-production-launch-checklist)**.

1. Push the repo; import it in Vercel as a **new project** (framework auto‑detects
   as Next.js; build command `npm run build`).
2. Provision Postgres (Neon / Supabase / Vercel Postgres / RDS) **with backups**,
   and an object store (Vercel Blob or S3‑compatible). Never `STORAGE_PROVIDER=local`
   on Vercel.
3. Set the environment variables (runbook §7.4).
4. Apply the schema with `npx prisma migrate deploy` (never `db push`); seed
   licenses with `NODE_ENV=production npm run db:seed`.
5. Create the first admin with `npm run create-admin` (runbook §7.6) — **not** a
   seeded account.
6. Add the custom domain and verify TLS (runbook §7.7).
7. Run `npm run smoke:prod` against the deployment (runbook §7.8).

The parent site at `platodesignlab.com` is untouched — this is a separate Vercel
project on its own subdomain.

---

## 6. Connecting a real DOI registrar

Everything below is **configuration only** — no code changes.

**Once you have a signed agreement and a prefix from Crossref or DataCite:**

1. Set the provider env vars in Vercel (Production):

   *DataCite:*
   ```
   DOI_PROVIDER=datacite
   DATACITE_USERNAME=<repository account>
   DATACITE_PASSWORD=<password>
   DATACITE_PREFIX=10.XXXXX
   DATACITE_API_URL=https://api.datacite.org        # or api.test.datacite.org first
   DOI_SUFFIX_NAMESPACE=pa
   ```

   *Crossref:*
   ```
   DOI_PROVIDER=crossref
   CROSSREF_USERNAME=<role>/<user>
   CROSSREF_PASSWORD=<password>
   CROSSREF_PREFIX=10.XXXXX
   CROSSREF_DEPOSITOR_NAME=P/A Institute
   CROSSREF_DEPOSITOR_EMAIL=<contact email registered with Crossref>
   ```

2. Redeploy. On the next publish:
   - `getDoiProvider()` now returns the configured provider (it checks that
     prefix + credentials are all present).
   - `publishRecord()` mints a DOI `10.<prefix>/pa.<year>.<NNNNNN>`, stores an
     `Identifier` row (`REGISTERED` for DataCite, `PENDING` for Crossref), and the
     record page / metadata / citations start showing the DOI.
   - Records published *before* the switch keep their PAID; an admin can mint
     DOIs for them from **Admin → Identifiers & DOI** (the retry action calls the
     provider for any `FAILED`/`PENDING` row — extend `retryDoiAction` if you want
     a "mint DOI for this PAID‑only record" button).

3. **Where the DOI actually appears** once registered (all driven by a persisted
   `Identifier` row with `type=DOI, status=REGISTERED`, never by `DOI_PROVIDER`
   alone):
   - Record page identifier panel + citation "cite as" line
   - `citation_doi` meta tag and schema.org JSON‑LD (`doi`, `sameAs`)
   - `GET /api/records/:id` (`identifier.doi`), `?format=bibtex|ris|dublin-core`
   - Search results and `GET /api/records`

**Files to know (if you do want to change behaviour):**

| File | Responsibility |
|---|---|
| `lib/identifiers/types.ts` | `IdentifierProvider` interface |
| `lib/identifiers/local-provider.ts` | P/A Identifier issuance |
| `lib/identifiers/crossref-provider.ts` | Crossref XML deposit (`buildDepositXml`) |
| `lib/identifiers/datacite-provider.ts` | DataCite REST `/dois` payload |
| `lib/identifiers/index.ts` | `getDoiProvider()`, `formalDoiEnabled()`, `identifierProviderStatus()` |
| `lib/identifiers/paid.ts` | PAID format + transactional allocation |
| `lib/records/service.ts` → `publishRecord()` | Orchestrates publish + DOI mint, DOI failure isolation |
| `lib/env.ts` → `isDoiProviderConfigured()` | The single "is a real registrar wired up?" check |
| `lib/records/types.ts` / `lib/records/load.ts` | `registeredDoi` is set **only** from a `REGISTERED` DOI row |
| `lib/metadata/index.ts`, `lib/citation/index.ts` | Emit DOI **only** when `view.registeredDoi` is non‑null |
| `app/records/[slug]/page.tsx` → `generateMetadata` | `citation_doi` guarded by `view.registeredDoi` |

---

## 7. Production Deployment (runbook)

End-to-end procedure to take P/A Archive live at
`https://archive.platodesignlab.com` as its own Vercel project.

### 7.1 Prerequisites

- A Vercel account/team that will own the **P/A Archive** project (separate from
  the `platodesignlab.com` marketing site).
- A PostgreSQL 14+ database with **automated backups** (Neon, Supabase, Vercel
  Postgres, or RDS). Note the pooled and direct connection strings.
- An object store: a Vercel **Blob** store, or an S3-compatible bucket
  (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO).
- Access to DNS for `platodesignlab.com` (or confirmation that Vercel manages it).
- A password manager entry for `AUTH_SECRET` and the first admin password.

### 7.2 Database

**Provider choice** — any PostgreSQL 14+ works (no code change). Recommended,
in order:

| Rank | Provider | Why | Watch for |
|---|---|---|---|
| 1 | **Neon** | Serverless, scales to zero, generous free tier, first‑class Prisma support, PITR on paid plans. Add via the Vercel **Marketplace** so billing + env vars are managed by Vercel. | Use the **pooled** URL (`...-pooler...`) for `DATABASE_URL` and the **direct** URL for `DIRECT_DATABASE_URL`. |
| 2 | **Supabase** | Managed Postgres + daily backups + PITR (Pro), also on the Vercel Marketplace. | `DATABASE_URL` = the `:6543` transaction‑pooler URI; `DIRECT_DATABASE_URL` = the `:5432` URI. |
| 3 | **Vercel Postgres** (Neon under the hood) | Zero‑config from the Vercel dashboard. | Same pooled/direct split as Neon. |
| 4 | Any other Postgres (RDS, Railway, self‑hosted) | Full control. | You own backups/PITR; set both URLs; ensure connection limits suit serverless. |

**Serverless connection management:** the app uses a single cached
`PrismaClient` (`lib/db.ts`). Always point `DATABASE_URL` at the provider's
**pooled/pgbouncer** endpoint so concurrent lambda invocations don't exhaust
connections. `DIRECT_DATABASE_URL` (non‑pooled) is used **only** by
`prisma migrate` and is required whenever the pooled URL runs through pgbouncer.

**Steps**

1. Create the database (empty). Enable **daily automated backups** and
   **point‑in‑time recovery (PITR)** if the plan offers it.
2. Collect the **pooled** URL → `DATABASE_URL`, and the **direct** URL →
   `DIRECT_DATABASE_URL`.
3. Apply the schema **with migrations, never `db push`**:
   ```bash
   DATABASE_URL='<direct>' DIRECT_DATABASE_URL='<direct>' \
     npx prisma migrate deploy
   ```
   Two migrations should apply: `..._init` and
   `..._production_hardening_audit_actions`. Re‑run this on every deploy that
   adds a migration (`git log --stat prisma/migrations`). The Vercel build runs
   `prisma generate` **only** — it never touches data.
4. Seed reference data (licenses). Creates **no** users or sample record in
   production:
   ```bash
   DATABASE_URL='<pooled>' NODE_ENV=production npm run db:seed
   ```
   Verify:
   ```bash
   DATABASE_URL='<pooled>' npx prisma studio   # users: 0, records: 0, licenses: 7
   ```

### 7.3 Object storage

**Recommended for launch: Vercel Blob** (fastest path; `@vercel/blob` is already
a dependency).

1. Vercel dashboard → **Storage → Create → Blob** → connect it to the
   `pa-archive` project.
2. `BLOB_READ_WRITE_TOKEN` is then injected automatically into every environment.
3. Set `STORAGE_PROVIDER=vercel-blob`.

If the token is absent, **there is no local fallback** — `getStorage()` throws
`"STORAGE_PROVIDER=vercel-blob but no Blob store is linked…"` and uploads fail
with a clear configuration error (verified by `scripts/check-env.ts` and the
`storage-config` unit test).

**Alternative: S3 / Cloudflare R2 / Backblaze B2**

1. Create a **private** bucket.
2. `npm i @aws-sdk/client-s3` (optional dependency).
3. Set `STORAGE_PROVIDER=s3` + `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT` for non‑AWS, `S3_PUBLIC_BASE_URL` for a
   CDN). Missing values → clear error listing exactly which `S3_*` vars are unset.

**Never** `STORAGE_PROVIDER=local` on Vercel — `getStorage()` throws in
production unless `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` (self‑hosted box with a
persistent volume only).

### 7.4 Environment variables (Vercel → Settings → Environment Variables)

Set for the **Production** environment (Preview handling: see §7.12):

```
NEXT_PUBLIC_SITE_URL   = https://archive.platodesignlab.com
APP_URL                = https://archive.platodesignlab.com
AUTH_URL               = https://archive.platodesignlab.com
AUTH_TRUST_HOST        = true
AUTH_SECRET            = <openssl rand -base64 48>          # unique to production
DATABASE_URL           = <pooled Postgres URL>
DIRECT_DATABASE_URL    = <direct Postgres URL>              # Neon/Supabase: required
STORAGE_PROVIDER       = vercel-blob                        # or s3
BLOB_READ_WRITE_TOKEN  = <auto-injected once a Blob store is linked>
# (s3 only) S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT
DOI_PROVIDER           = local                             # until a registrar is signed (see §6)
ALLOW_OPEN_SIGNUP      = false                             # RECOMMENDED for launch — see below
RATE_LIMIT_ENABLED     = true
TRUST_PROXY_HEADERS    = true
```

- **`ALLOW_OPEN_SIGNUP=false` is the recommended launch value.** It disables
  public self‑registration (`/register` returns 404, the register action
  refuses) so only an admin creates accounts during the closed beta. Flip it to
  `true` after you've reviewed the rate‑limit scaling note in §7.13.
- **Do not** set in production: `SEED_DEMO_USERS`, `SEED_DEFAULT_PASSWORD`,
  `SEED_SAMPLE_RECORD`, `ALLOW_LOCAL_STORAGE_IN_PRODUCTION`.
- `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` only temporarily for §7.6,
  then delete them.

Generate the auth secret (do **not** commit the value):
```bash
openssl rand -base64 48
```

**Preflight** — with the exact production env sourced locally
(`vercel env pull .env.production.local` then export it):
```bash
NODE_ENV=production npm run check-env
```
This validates URL/origin consistency, storage config, the DOI prefix format,
and that no dev‑only var is set. It connects to nothing. Exit 0 = ready.

### 7.5 Deploy

1. Push the repo; **Vercel → Add New → Project → import the repo**.
   - Project name: `pa-archive`
   - Root directory: repo root
   - Framework: **Next.js** (auto‑detected; also pinned in `vercel.json`)
   - Build command: `npm run build` (default; `vercel.json` pins it — it runs
     `prisma generate` + `next build`, **never a migration**)
   - Production branch: `main`
2. Add the environment variables (§7.4) to **Production**, then trigger the
   first deployment.
3. After it succeeds, run `prisma migrate deploy` against the production DB if
   you have not already (§7.2 step 3). Migrations are **never** run by the build.

### 7.6 Create the first administrator

Never rely on a seeded admin in production. From your machine, with the
production `DATABASE_URL` exported:

```bash
DATABASE_URL='<prod pooled>' \
INITIAL_ADMIN_EMAIL='you@platodesignlab.com' \
INITIAL_ADMIN_PASSWORD='<a long random password from your password manager>' \
  npm run create-admin
```

- The password is **never printed or logged**.
- If the email already exists it is promoted to `ADMIN` (password untouched
  unless you add `-- --reset-password`).
- If an admin already exists it refuses to create a second one (use `-- --force`
  only if you really mean to).

Then **remove `INITIAL_ADMIN_PASSWORD`** from your shell history / environment.

### 7.7 Connect `archive.platodesignlab.com`

1. Vercel → P/A Archive project → **Settings → Domains → Add** →
   `archive.platodesignlab.com`.
2. **If `platodesignlab.com` DNS is on Vercel** (same account): Vercel adds the
   record automatically — click to confirm.
3. **If DNS is elsewhere:** add the record Vercel shows you. It is normally a
   `CNAME` on host `archive` pointing to the value Vercel displays (commonly
   `cname.vercel-dns.com`, but **use the exact value in the dashboard** — do not
   hard-code it from this README). Some providers need an `ALIAS`/`ANAME` at
   apex-style hosts; `archive` is a subdomain so a `CNAME` is fine.
4. Wait for propagation (minutes to a few hours). Vercel issues the TLS
   certificate automatically once it can verify the record.
5. Verify SSL:
   ```bash
   curl -sI https://archive.platodesignlab.com | grep -i "HTTP/\|strict-transport-security"
   # expect: HTTP/2 200  and  strict-transport-security: max-age=63072000; ...
   ```
   Also open the URL in a browser and confirm the padlock and that the
   certificate covers `archive.platodesignlab.com`.
6. Confirm `NEXT_PUBLIC_SITE_URL` / `APP_URL` / `AUTH_URL` all equal
   `https://archive.platodesignlab.com`, then redeploy so canonical URLs,
   citation metadata, the sitemap, and auth callbacks use the production origin.

### 7.8 Post-deploy smoke test

```bash
SMOKE_BASE_URL=https://archive.platodesignlab.com \
SMOKE_EMAIL='<a submitter account>' SMOKE_PASSWORD='<its password>' \
  npm run smoke:prod
```

This runs ~28 checks: unauthenticated boundaries, security headers, `/api/health`,
robots hygiene, login, draft → upload → publish, PAID issuance, public record
page, JSON-LD / BibTeX / RIS, search, version lock, sitemap contents, DOI
non-display, and that an anonymous client cannot read a draft. It publishes one
throwaway record — withdraw it afterwards from **Dashboard → the record →
Withdraw**, or run against a staging deployment.

Manual spot checks:
- `GET /api/health` → `{"status":"ok"}` with no version/commit fields.
- `GET /robots.txt` disallows `/admin`, `/dashboard`, `/api/`.
- `GET /sitemap.xml` contains only published record URLs.
- A published record page shows the P/A Identifier and **"No registered DOI"**
  (until a registrar is connected).

### 7.9 Backups & recovery

**Database** — the app does not and cannot guarantee backups by itself. On your
Postgres provider:
- Enable **daily automated backups** and the longest practical retention.
- Enable **point-in-time recovery (PITR)** if available.
- **Test a restore** into a scratch database at least once, and document the
  steps/timing.
- To restore: provision the restored DB, point `DATABASE_URL` at it, run
  `prisma migrate deploy` (in case the restore predates a migration), redeploy.

**Object storage** — research files live only in the object store, not the DB:
- Enable **bucket versioning** (S3/R2) or rely on Blob store durability.
- Configure a **second copy**: S3 cross-region replication, a scheduled
  `aws s3 sync` / `rclone` job to another bucket, or periodic export.
- Periodically run `npm run backfill-checksums -- --dry` — it reads every file
  and will report any that are unreadable (missing objects).
- Keep DB and storage backups **time-aligned** so a paired restore is consistent.

LOCKSS / CLOCKSS / Portico integration is **not implemented** (see §2).

### 7.10 Incident response

| Symptom | First actions |
|---|---|
| Site 500s | Check Vercel deployment logs; `GET /api/health`; look for the `requestId` from the error page in logs (`api.error …`). |
| DB unreachable | `/api/health` shows `database:"error"`. Check provider status, connection limits, and that `DATABASE_URL` is the **pooled** URL. |
| Uploads failing | `/api/health` `storage:"error"`, or 413/422 on upload. Check storage credentials, bucket permissions, `MAX_UPLOAD_BYTES`. |
| Suspected abuse / brute force | `RATE_LIMIT_ENABLED=true` (default) already throttles login/upload/API per IP. Review `LOGIN_FAILURE` rows in **Admin → Audit log**. Disable a user in **Admin → Users**. |
| Bad data published | Do **not** delete. Issue a **Correction** (stays published) or **Retraction** (kept online, marked) from the record's dashboard; **Withdraw** removes it from listings but keeps a tombstone. |
| DOI registration failing | Only relevant once a registrar is connected. **Admin → Identifiers & DOI** lists `FAILED`/`PENDING` DOIs with a **Retry** button. Publication is never blocked by this. |
| Compromised `AUTH_SECRET` | Rotate it in Vercel and redeploy — this invalidates all sessions (everyone must re-login). Then force-reset admin passwords via `create-admin -- --reset-password`. |

### 7.11 Rollback

- **Code:** Vercel → Deployments → pick the previous good deployment →
  **Promote to Production** (instant).
- **Migrations:** Prisma migrations are forward-only. If a deploy shipped a
  destructive migration, roll back the code first, then restore the database from
  the backup taken **before** that migration (7.9). For this reason, **take a
  manual DB backup immediately before deploying any migration that drops or
  renames a column/table.**
- After any rollback, re-run `npm run smoke:prod`.

### 7.12 Preview vs Production isolation

Vercel builds a **Preview** deployment for every non‑`main` branch/PR. Preview
must **never** touch production data:

- **Separate database for Preview.** Set `DATABASE_URL` / `DIRECT_DATABASE_URL`
  for the **Preview** environment to a *different* database (Neon and Supabase
  both offer free branch/dev databases; Neon can auto‑create a branch DB per
  Vercel preview). Never leave Preview pointing at the production URL.
- **Separate Blob store (or accept shared read‑only risk).** Ideally create a
  second Blob store for Preview. At minimum, know that a Preview deploy with the
  production token can write to the production store.
- **Separate `AUTH_SECRET`** for Preview so preview sessions never validate
  against production.
- `NEXT_PUBLIC_SITE_URL` / `APP_URL` / `AUTH_URL` for Preview can be left unset
  (they fall back to `http://localhost:3000` locally) or set to the Vercel
  preview URL — they are only used for canonical links, which don't matter on a
  throwaway preview.
- If you cannot provision a preview database, **disable Preview deployments**
  for this project (Vercel → Settings → Git → *Preview Deployments: off*, or the
  `git.deploymentEnabled` block in `vercel.json` already limits auto‑deploys to
  `main`).

The migration workflow is manual (`prisma migrate deploy`), so a preview build
**cannot** alter any schema on its own — the only risk is row‑level writes if
Preview shares the production `DATABASE_URL`, which the above prevents.

### 7.13 Rate limiting — production beta limitation

`lib/rate-limit.ts` is an **in‑process fixed‑window limiter**. On Vercel each
serverless instance keeps its own counters, so the effective global limit is
`limit × concurrent instances`. This is acceptable for a **closed / low‑traffic
beta** (and login is additionally limited *per email*, which is instance‑local
but still meaningfully slows credential stuffing against one account).

**Before enabling open public signup (`ALLOW_OPEN_SIGNUP=true`)**, move the
limiter to a shared store — Upstash Redis or Vercel KV — by replacing the `store`
Map in `lib/rate-limit.ts` with a Redis‑backed implementation of the same
`rateLimit()` signature. This does not block the initial beta deployment.

---

## 8. Production launch checklist

Copy this into your launch ticket. Every box must be checked.

```
Preflight
[ ] NODE_ENV=production npm run check-env — exit 0 with the real prod env
[ ] vercel.json present (framework nextjs, build = npm run build, no migration in build)

Security & secrets
[ ] AUTH_SECRET is a fresh `openssl rand -base64 48` value, unique to production, stored only in Vercel + a password manager
[ ] No secret appears in the repo, README, seed, tests, or client bundle
[ ] APP_URL / NEXT_PUBLIC_SITE_URL / AUTH_URL all = https://archive.platodesignlab.com (no *.vercel.app)
[ ] Security headers verified on prod (CSP, HSTS, X-Frame-Options: DENY, Referrer-Policy)
[ ] Session cookie is __Secure- prefixed, HttpOnly, SameSite=Lax on prod
[ ] RATE_LIMIT_ENABLED=true ; TRUST_PROXY_HEADERS=true
[ ] Cross-origin POST to /api/records returns 403 (CSRF check)

Accounts
[ ] No demo accounts exist in production (admin@pa.archive etc. absent — verify via prisma studio / SQL)
[ ] SEED_DEMO_USERS / SEED_SAMPLE_RECORD / SEED_DEFAULT_PASSWORD are NOT set in prod
[ ] First ADMIN created via `npm run create-admin`; INITIAL_ADMIN_EMAIL/PASSWORD then removed from the env
[ ] Admin can log in and open /admin; a non-admin gets /403
[ ] ALLOW_OPEN_SIGNUP=false for launch (flip to true only after the §7.13 rate-limit move)

Database
[ ] Schema applied with `prisma migrate deploy` (never `db push`) — both migrations applied
[ ] Licenses seeded (NODE_ENV=production npm run db:seed) → users 0, records 0, licenses 7
[ ] DATABASE_URL is the POOLED string; DIRECT_DATABASE_URL is the DIRECT string
[ ] Daily automated backups enabled; PITR enabled if the plan offers it
[ ] A restore has been tested into a scratch DB
[ ] PAID concurrency verified (npm run smoke:prod publishes cleanly)
[ ] Preview environment uses a SEPARATE database (or Preview deploys are disabled)

Storage
[ ] STORAGE_PROVIDER = vercel-blob (Blob store linked → BLOB_READ_WRITE_TOKEN injected) or s3
[ ] STORAGE_PROVIDER is NOT local ; ALLOW_LOCAL_STORAGE_IN_PRODUCTION unset
[ ] Bucket/store is private; credentials scoped to it
[ ] Secondary backup/replication of the object store configured (or accepted as a known gap)
[ ] Upload limits confirmed (MAX_UPLOAD_BYTES); executable types rejected

Public / private boundary
[ ] Draft records + their files are 404 for anonymous users (smoke test)
[ ] /admin, /editor, /review, /dashboard, /submit require the right role server-side
[ ] robots.txt disallows admin/dashboard/api; sitemap.xml lists only published records
[ ] Withdrawn records are noindex and absent from the sitemap

DOI
[ ] DOI_PROVIDER=local (or a real registrar with valid credentials — see §6)
[ ] No record page, metadata, or citation shows a DOI (until a registrar is live)
[ ] DOI registration failure does not block publication (mock-tested)

Domain / TLS
[ ] archive.platodesignlab.com added as a Custom Domain on the P/A Archive project
[ ] DNS record added (value copied from the Vercel dashboard, not hard-coded)
[ ] HTTPS valid: curl -sI shows HTTP/2 200 + strict-transport-security
[ ] Redeployed after setting the production URLs

DOI (until a registrar is signed)
[ ] DOI_PROVIDER=local ; DOI_PREFIX unset
[ ] Publish one real record → PAID issued, and NO doi appears on the record page,
    citation_doi, JSON-LD, BibTeX, RIS, or Schema.org
[ ] Record page shows "No registered DOI. Cite the P/A Identifier…"

Verification
[ ] npm test — all pass
[ ] npx tsc --noEmit — clean
[ ] npm run build — succeeds
[ ] npm run lint — clean
[ ] npm run smoke:prod against the deployment — all 28 pass
[ ] /api/health returns ok with no version/internal details
[ ] README "Production status" updated to `Production: https://archive.platodesignlab.com`
```

---

## Safeguards against the prohibited behaviours

| Requirement | Enforcement |
|---|---|
| Never invent a DOI prefix | Prefix comes only from `CROSSREF_PREFIX` / `DATACITE_PREFIX` / `DOI_PREFIX`; no default, no generation. |
| Never show a fake DOI as real | UI/metadata/citations read `view.registeredDoi`, populated only from an `Identifier` row with `type=DOI, status=REGISTERED`. |
| No "DOI registered" without a contract | `getDoiProvider()` returns `null` unless prefix + username + password are all set; `LocalIdentifierProvider` cannot produce `type=DOI`. |
| Don't claim DOI‑foundation membership | Footer + `/about` + `/policies/*` state P/A Identifiers are not DOIs and P/A Institute asserts no registration authority. |
| No "peer reviewed" badge without review | Badge shown only when `peerReviewStatus ∈ {ACCEPTED, PUBLISHED}`, set by an editor. |
| Don't erase the scholarly record | Corrections/retractions/withdrawals add permanent `RecordNotice` rows; retracted records stay online; superseded files are retained. |
| Server‑side authorization | `checkApiRole` / `requireRole` / `canManageRecord` on every mutation; middleware gates areas (and 403s a logged‑in user with the wrong role); client never decides admin. |
| Upload safety | extension allow‑list + executable block‑list + MIME check + size limit + filename/path‑traversal checks + UUID storage keys + orphan cleanup on failure. |
| No hard‑coded secrets | All secrets via env; `env.example` provided; `.env*` git‑ignored; logger redacts secret‑bearing keys. |
| CSRF | `SameSite=Lax` session cookie **plus** an explicit same‑origin check on every state‑changing API route. Server Actions carry Next's built‑in origin check. |
| XSS | React auto‑escaping everywhere; the one inline `<script>` (JSON‑LD) is serialised with `jsonForScript()` which escapes `<`, `>`, `&`, U+2028/9. |
| Open redirect | `?callbackUrl` and post‑login redirects pass through `safeInternalPath()` (rooted same‑origin paths only, never `/login`). |
| Rate limiting | Fixed‑window limiter on login (per IP + per email), registration, upload, record creation, search, public API and DOI retry. |
| Error disclosure | API 500s return only a `requestId`; pages show a digest. Stack traces are logged server‑side, never sent to clients (`DEBUG_ERRORS` gated). |
| Security headers | CSP, HSTS (prod), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, COOP — set globally in `next.config.mjs`. |
| Seed accident prevention | No default passwords anywhere; demo users need `SEED_DEMO_USERS=true` **and** `SEED_DEFAULT_PASSWORD`; production seed creates licenses only. |
| Production storage safety | `getStorage()` throws in production if `STORAGE_PROVIDER=local` (unless the self‑host escape hatch is set). |
| DB safety | Build runs `prisma generate` only; migrations are applied explicitly with `migrate deploy`; runbook forbids `db push` in prod. |

---

## Security posture — what is covered, what is not

**Covered:** server‑side authz on every route/action, IDOR checks
(`canManageRecord` scopes records to owner/editor/admin; drafts and their files
404 for everyone else), CSRF (SameSite + origin check), reflected/stored XSS
(React + JSON‑LD escaping), open‑redirect, path traversal, MIME/extension
spoofing on upload, SQL injection (Prisma parameterises everything), brute‑force
(rate‑limited + audited login), secret redaction in logs, security headers,
salted‑hash IPs in analytics, robots/sitemap/`noindex` for private surfaces.

**Remaining constraints (accepted for this release):**

- **Rate limiting is in‑process.** On multiple serverless instances the global
  limit is `limit × instances`. For a hard global limit, back `lib/rate-limit.ts`
  with Upstash Redis / Vercel KV.
- **CSP keeps `script-src 'unsafe-inline'`** because the App Router injects an
  inline bootstrap script and there is no nonce middleware. Everything else is
  locked down (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`).
- **No 2FA / SSO / email verification.** Credentials login only; adapter tables
  exist for a future ORCID/OAuth provider.
- **No WAF / bot management** beyond the app‑level rate limiter — add at the
  Vercel/edge layer if needed.
- **No antivirus scan** of uploaded files (type/size/extension checks only).
- **Backups are the database/storage provider's responsibility** — the app
  cannot guarantee them (see runbook §7.9).
- **API auth is session‑cookie only.** Machine‑to‑machine API keys are a
  documented future addition (see §2).

---

## Tests

```bash
npm test          # jest unit suite
npm run typecheck # tsc --noEmit
npm run build     # production build
npm run lint      # eslint
```

**52 unit assertions** across: PAID formatting & parsing; citation formatters
(incl. the "no DOI ⇒ cite landing page" rule); machine‑metadata serializers
(JSON‑LD / Dublin Core DOI‑omission); upload validation & path‑traversal safety;
Zod draft vs publish schemas, ORCID normalization and the 12‑char password
policy; identifier‑provider configuration gating; the role hierarchy;
**open‑redirect protection** (`safeInternalPath`); **inline‑script XSS escaping**
(`jsonForScript`); the **rate limiter**; and the **same‑origin CSRF guard**.

**HTTP end‑to‑end:** `npm run smoke:prod` runs ~28 checks against a live server
(auth, CSRF boundary, security headers, `/api/health`, robots/sitemap hygiene,
draft → upload → publish → PAID, public page, JSON‑LD/BibTeX/RIS, search, version
lock, DOI non‑display, anonymous‑cannot‑read‑draft). This was run green against a
local deployment during hardening.

**Service layer:** draft → upload → publish → PAID (incl. non‑reuse after delete)
→ search → versioning → corrections/retraction → audit, plus the DOI‑failure
isolation path, verified end‑to‑end against a real PostgreSQL instance.

---

## License

Application code: choose a license before publishing this repository (none is
asserted here). Deposited research content is governed by the license each author
selects at deposit time.
