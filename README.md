# P/A Archive

Independent research repository, peer‑review workflow, and **persistent identifier
registry** for **P/A Institute**.

- **Service name:** P/A Archive
- **Operator:** P/A Institute
- **Planned URL:** `https://archive.platodesignlab.com`
- **Parent domain:** `platodesignlab.com`

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
  plain text).
- **Rate limiting** on public endpoints (add at the edge / via `@upstash/ratelimit`).
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
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | `http://localhost:3000` | No trailing slash. Prod: `https://archive.platodesignlab.com` |
| `NEXT_PUBLIC_OPERATOR_NAME` | no | `P/A Institute` | |
| `NEXT_PUBLIC_SERVICE_NAME` | no | `P/A Archive` | |
| `NEXT_PUBLIC_PARENT_DOMAIN` | no | `platodesignlab.com` | |
| `DATABASE_URL` | **yes** | — | Pooled Postgres connection string |
| `DIRECT_DATABASE_URL` | no | = `DATABASE_URL` | Non‑pooled URL for migrations (Neon/Supabase) |
| `AUTH_SECRET` | **yes** | — | `openssl rand -base64 32` |
| `AUTH_URL` | yes (prod) | auto | e.g. `https://archive.platodesignlab.com` |
| `AUTH_TRUST_HOST` | yes (Vercel) | `true` | |
| `STORAGE_PROVIDER` | no | `local` | `local` \| `s3` \| `vercel-blob` |
| `STORAGE_LOCAL_DIR` | no | `./storage-data` | `local` only — **not usable on Vercel** |
| `BLOB_READ_WRITE_TOKEN` | if `vercel-blob` | — | Auto‑injected on Vercel when a Blob store is linked |
| `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | if `s3` | — | |
| `S3_ENDPOINT` | if non‑AWS S3 | — | e.g. R2 endpoint; enables path‑style |
| `S3_PUBLIC_BASE_URL` | no | — | CDN / public base for direct downloads |
| `MAX_UPLOAD_BYTES` | no | `52428800` | 50 MiB |
| `DOI_PROVIDER` | no | `local` | `local` \| `crossref` \| `datacite` |
| `DOI_PREFIX` | no | — | **Only** a prefix assigned by Crossref/DataCite. Never invent one. |
| `DOI_SUFFIX_NAMESPACE` | no | `pa` | → `10.<prefix>/pa.2026.000001` |
| `CROSSREF_USERNAME` / `CROSSREF_PASSWORD` / `CROSSREF_PREFIX` | if `crossref` | — | All three needed to activate |
| `CROSSREF_DEPOSIT_URL` | no | `https://api.crossref.org/deposits` | |
| `CROSSREF_DEPOSITOR_NAME` / `CROSSREF_DEPOSITOR_EMAIL` | if `crossref` | — | |
| `DATACITE_USERNAME` / `DATACITE_PASSWORD` / `DATACITE_PREFIX` | if `datacite` | — | All three needed to activate |
| `DATACITE_API_URL` | no | `https://api.datacite.org` | Test: `https://api.test.datacite.org` |
| `ALLOW_OPEN_SIGNUP` | no | `true` | `false` → admin creates all accounts |
| `SEED_ADMIN_PASSWORD` / `SEED_DEFAULT_PASSWORD` | dev only | `password123` | Never set in production |
| `SEED_SAMPLE_RECORD` | dev only | `true` | Ignored when `NODE_ENV=production` |

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

# 3. create the schema
npm run prisma:migrate      # dev: applies migrations, creates the DB objects
#   or, against an existing remote DB:  npm run prisma:deploy

# 4. seed licenses + demo users + one sample record
npm run db:seed

# 5. run
npm run dev                 # http://localhost:3000  (port 3008 via .claude/launch.json)
```

**Demo accounts** (dev seed; passwords from `SEED_*` env, default `password123`):

| Email | Role |
|---|---|
| `admin@pa.archive` | Administrator |
| `editor@pa.archive` | Editor |
| `reviewer@pa.archive` | Reviewer |
| `submitter@pa.archive` | Submitter |

**Scripts**

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (CI / prod) |
| `npm run db:push` | Push schema without a migration (prototyping) |
| `npm run db:seed` | Run `prisma/seed.ts` |
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

1. **Push this repo** to GitHub/GitLab/Bitbucket.
2. **Vercel → New Project → import the repo.** Framework preset: *Next.js*
   (auto‑detected). Build command `npm run build`, output auto.
3. **Provision a database** — add Vercel Postgres, or Neon/Supabase, and put the
   connection string(s) in the project's environment variables.
4. **Provision storage** — set `STORAGE_PROVIDER=vercel-blob` and create/link a
   Blob store (or configure `s3`). *Do not use `local` on Vercel.*
5. **Set environment variables** (Project → Settings → Environment Variables) for
   *Production* (and *Preview* if used):
   - `DATABASE_URL` (+ `DIRECT_DATABASE_URL` if your provider needs it)
   - `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_URL=https://archive.platodesignlab.com`, `AUTH_TRUST_HOST=true`
   - `NEXT_PUBLIC_SITE_URL=https://archive.platodesignlab.com`
   - `STORAGE_PROVIDER=vercel-blob` (or `s3` + `S3_*`)
   - `DOI_PROVIDER=local` (until a registrar is connected — see §6)
   - `ALLOW_OPEN_SIGNUP` as desired
   - **Do not** set `SEED_*` vars in production.
6. **Run migrations against the production DB.** Locally, with the production
   `DATABASE_URL` exported:
   ```bash
   npm run prisma:deploy
   ```
   (or add it as a Vercel *Deploy Hook* / one‑off job). The build itself runs
   `prisma generate` but **not** `migrate deploy`.
7. **Seed licenses + the first admin** against production:
   ```bash
   DATABASE_URL=<prod> SEED_SAMPLE_RECORD=false \
   SEED_ADMIN_PASSWORD='<pick-a-strong-one>' npm run db:seed
   ```
   In production the seed creates only the `admin@pa.archive` account (if no
   users exist) and the licenses — no demo users, no sample record. Change the
   admin email/password immediately, or create your own admin and disable the
   seed one.
8. **Deploy.** Verify `/`, `/records`, `/api/records`, `/sitemap.xml`,
   `/robots.txt`.

### 5a. Connecting `archive.platodesignlab.com`

1. Vercel → the P/A Archive project → **Settings → Domains → Add**
   `archive.platodesignlab.com`.
2. **If `platodesignlab.com`'s DNS is managed by Vercel** (same Vercel account):
   Vercel adds the `CNAME`/`A` records automatically — just confirm. Nothing else
   to do.
3. **If DNS is elsewhere:** create a `CNAME` record
   `archive` → `cname.vercel-dns.com` (Vercel shows the exact target). Wait for
   propagation; Vercel issues the TLS certificate automatically.
4. Set `NEXT_PUBLIC_SITE_URL` and `AUTH_URL` to
   `https://archive.platodesignlab.com` and redeploy so canonical URLs,
   citation metadata, the sitemap and auth callbacks use the production origin.
5. (Optional) keep the Vercel `*.vercel.app` URL as a secondary domain or set the
   custom domain as primary so Vercel 308‑redirects the rest.

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

## Safeguards against the prohibited behaviours

| Requirement | Enforcement |
|---|---|
| Never invent a DOI prefix | Prefix comes only from `CROSSREF_PREFIX` / `DATACITE_PREFIX` / `DOI_PREFIX`; no default, no generation. |
| Never show a fake DOI as real | UI/metadata/citations read `view.registeredDoi`, populated only from an `Identifier` row with `type=DOI, status=REGISTERED`. |
| No "DOI registered" without a contract | `getDoiProvider()` returns `null` unless prefix + username + password are all set; `LocalIdentifierProvider` cannot produce `type=DOI`. |
| Don't claim DOI‑foundation membership | Footer + `/about` + `/policies/*` state P/A Identifiers are not DOIs and P/A Institute asserts no registration authority. |
| No "peer reviewed" badge without review | Badge shown only when `peerReviewStatus ∈ {ACCEPTED, PUBLISHED}`, set by an editor. |
| Don't erase the scholarly record | Corrections/retractions/withdrawals add permanent `RecordNotice` rows; retracted records stay online; superseded files are retained. |
| Server‑side authorization | `checkApiRole` / `requireRole` / `canManageRecord` on every mutation; middleware gates areas; client never decides admin. |
| Upload safety | extension allow‑list + executable block‑list + MIME check + size limit + filename/path‑traversal checks. |
| No hard‑coded secrets | All secrets via env; `env.example` provided; `.env*` git‑ignored. |

---

## Tests

```bash
npm test
```

32 unit assertions across: PAID formatting & parsing, citation formatters (incl.
the "no DOI ⇒ cite landing page" rule), machine‑metadata serializers (JSON‑LD /
Dublin Core DOI‑omission), upload validation & path‑traversal safety, Zod draft
vs publish schemas & ORCID normalization, identifier‑provider configuration
gating, and the role hierarchy.

The service layer (draft → upload → publish → PAID → search → versioning →
corrections/retraction → audit) and the DOI‑failure isolation path have also been
exercised end‑to‑end against a real PostgreSQL instance during development.

---

## License

Application code: choose a license before publishing this repository (none is
asserted here). Deposited research content is governed by the license each author
selects at deposit time.
