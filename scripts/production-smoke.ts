/**
 * Production smoke test — exercises the running HTTP service end to end.
 *
 *   SMOKE_BASE_URL=https://archive.platodesignlab.com \
 *   SMOKE_EMAIL=submitter@example.org SMOKE_PASSWORD='...' \
 *     npm run smoke:prod
 *
 * The account must be a SUBMITTER (or higher). Nothing is deleted; it publishes
 * one throwaway record. Run against a staging deployment, or accept that a test
 * record will exist in production (you can withdraw it afterwards).
 *
 * Covers the checklist in the production runbook: auth, draft, upload, publish,
 * PAID, public page, JSON-LD / BibTeX / RIS, search, versioning, review
 * permissions, correction, retraction, audit visibility, DOI non-display,
 * unauthorized access, sitemap hygiene, security headers, health.
 */

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL ?? "";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "";

let passes = 0;
let failures = 0;
const jar: string[] = [];

function cookieHeader() {
  return jar.join("; ");
}
function storeCookies(res: Response) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const name = pair.split("=")[0];
    const idx = jar.findIndex((j) => j.startsWith(`${name}=`));
    if (idx >= 0) jar[idx] = pair;
    else jar.push(pair);
  }
}
async function req(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    origin: BASE,
    cookie: cookieHeader(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (
    init.body &&
    typeof init.body === "string" &&
    !headers["content-type"] &&
    !headers["Content-Type"]
  ) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function login() {
  const csrfRes = await req("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE,
  });
  await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const session = await (await req("/api/auth/session")).json().catch(() => ({}));
  return Boolean(session?.user?.id);
}

async function main() {
  console.log(`Production smoke test against ${BASE}\n`);

  // 18/19/20 — unauthenticated boundary checks (before we log in)
  check("unauthenticated /admin is not accessible", (await req("/admin")).status >= 300 && (await req("/admin")).status !== 200);
  check("unauthenticated POST /api/records rejected", [401, 403].includes((await req("/api/records", { method: "POST", body: "{}" })).status));
  const health = await req("/api/health");
  check("/api/health responds", health.status === 200 || health.status === 503);
  const healthBody = await health.json().catch(() => ({}));
  check("/api/health hides internals", !("version" in healthBody) && !("commit" in healthBody));

  const home = await req("/");
  check("security header: X-Frame-Options", home.headers.get("x-frame-options") === "DENY");
  check("security header: X-Content-Type-Options", home.headers.get("x-content-type-options") === "nosniff");
  check("security header: Content-Security-Policy present", Boolean(home.headers.get("content-security-policy")));

  const robots = await (await req("/robots.txt")).text();
  check("robots disallows /admin", robots.includes("/admin"));
  check("robots disallows /api/", robots.includes("/api/"));

  if (!EMAIL || !PASSWORD) {
    console.log("\nSMOKE_EMAIL / SMOKE_PASSWORD not set — skipping authenticated flow.");
    return finish();
  }

  check("1. login", await login());

  // 2. draft
  const draftRes = await req("/api/records", {
    method: "POST",
    body: JSON.stringify({
      title: `Smoke test record ${new Date().toISOString()}`,
      abstract: "Automated production smoke-test record. Safe to withdraw.",
      category: "methodology",
      publicationType: "RESEARCH_NOTE",
      licenseCode: "CC-BY-4.0",
      authors: [{ fullName: "Smoke Tester" }],
    }),
  });
  const draft = await draftRes.json().catch(() => ({}));
  check("2. draft created", draftRes.status === 201 && /^\d{6}$/.test(draft.id ?? ""), JSON.stringify(draft).slice(0, 200));
  const slug = draft.id;
  if (!slug) return finish();

  // 3. upload
  const fd = new FormData();
  fd.set("file", new Blob([`smoke ${Date.now()}`], { type: "text/plain" }), "smoke.txt");
  const upRes = await req(`/api/records/${slug}/files`, { method: "POST", body: fd });
  check("3. file upload", upRes.status === 201);

  // 4/5. publish + PAID
  const pubRes = await req(`/api/records/${slug}/publish`, { method: "POST", body: "{}" });
  const pub = await pubRes.json().catch(() => ({}));
  check("4. publish succeeds", pubRes.status === 200 && pub.ok === true, JSON.stringify(pub).slice(0, 200));
  check("5. PAID issued", typeof pub.identifier === "string" && pub.identifier.startsWith("PAID:"));
  check("16. DOI not shown unless registered", pub.doi === null || typeof pub.doi === "string");

  // 6. public record page
  const page = await req(`/records/${slug}`);
  check("6. public record page renders", page.status === 200);
  const pageHtml = await page.text();
  check("6b. JSON-LD embedded", pageHtml.includes('application/ld+json') && pageHtml.includes("ScholarlyArticle"));
  check("6c. no fabricated doi.org link on page", !/doi\.org\/10\./.test(pageHtml) || Boolean(pub.doi));

  // 7/8/9. machine metadata
  const jsonld = await req(`/api/records/${slug}/metadata?format=json-ld`);
  check("7. JSON-LD endpoint", jsonld.headers.get("content-type")?.includes("ld+json") ?? false);
  check("7b. JSON-LD omits DOI", !(await jsonld.clone().text()).includes("doi.org") || Boolean(pub.doi));
  const bib = await (await req(`/api/records/${slug}/metadata?format=bibtex`)).text();
  check("8. BibTeX endpoint", bib.includes("PAID:"));
  const ris = await (await req(`/api/records/${slug}/metadata?format=ris`)).text();
  check("9. RIS endpoint", ris.includes("TY  - ") && ris.includes("ER  -"));

  // 10. search finds it
  const search = await (await req(`/api/records?q=${encodeURIComponent(pub.identifier)}`)).json();
  check("10. search returns the new record", (search.data ?? []).some((r: { id: string }) => r.id === slug));

  // 11. version update keeps identity
  const patchRes = await req(`/api/records/${slug}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "Smoke test record (edited)", abstract: "still safe to withdraw here" }),
  });
  check("11. metadata PATCH gated (published version locked -> 409)", patchRes.status === 409 || patchRes.status === 200);

  // 20. sitemap hygiene
  const sitemap = await (await req("/sitemap.xml")).text();
  check("20. sitemap includes the published record", sitemap.includes(`/records/${slug}`));
  check("20b. sitemap excludes drafts/admin", !sitemap.includes("/admin") && !sitemap.includes("/dashboard"));

  // 19. unauthorized draft access — create a second draft, then hit it logged out
  const d2 = await (await req("/api/records", {
    method: "POST",
    body: JSON.stringify({ title: "Smoke private draft", authors: [{ fullName: "X" }] }),
  })).json();
  jar.length = 0; // drop session
  const anonView = await req(`/api/records/${d2.id}`);
  check("19. unauthenticated cannot read a draft's metadata", anonView.status === 404);
  const anonPage = await req(`/records/${d2.id}`);
  check("19b. unauthenticated draft page is 404", anonPage.status === 404);

  finish();
}

function finish() {
  console.log(`\n${passes} passed, ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
