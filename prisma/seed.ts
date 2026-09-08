/**
 * Database seed.
 *
 * PRODUCTION (NODE_ENV=production):
 *   - Only reference/master data (licenses) is inserted.
 *   - NO users are created. NO sample record. NO default passwords.
 *   - Create the first admin with `npm run create-admin` (scripts/create-admin.ts).
 *
 * DEVELOPMENT:
 *   - Licenses are always seeded (idempotent).
 *   - Demo users are created ONLY when SEED_DEMO_USERS=true. Their password
 *     comes from SEED_DEFAULT_PASSWORD (no built-in default — the seed refuses
 *     to create demo users without it).
 *   - One sample record is created ONLY when SEED_SAMPLE_RECORD=true.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const LICENSES = [
  { code: "CC-BY-4.0", name: "Creative Commons Attribution 4.0", url: "https://creativecommons.org/licenses/by/4.0/", isOpen: true, sortOrder: 1 },
  { code: "CC-BY-SA-4.0", name: "Creative Commons Attribution-ShareAlike 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/", isOpen: true, sortOrder: 2 },
  { code: "CC-BY-NC-4.0", name: "Creative Commons Attribution-NonCommercial 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", isOpen: true, sortOrder: 3 },
  { code: "CC0-1.0", name: "Creative Commons Zero 1.0 (Public Domain)", url: "https://creativecommons.org/publicdomain/zero/1.0/", isOpen: true, sortOrder: 4 },
  { code: "MIT", name: "MIT License", url: "https://opensource.org/license/mit/", isOpen: true, sortOrder: 5 },
  { code: "Apache-2.0", name: "Apache License 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0", isOpen: true, sortOrder: 6 },
  { code: "arr", name: "All rights reserved", url: null, isOpen: false, sortOrder: 99 },
];

const isProd = process.env.NODE_ENV === "production";
const seedDemoUsers = process.env.SEED_DEMO_USERS === "true";
const seedSample = process.env.SEED_SAMPLE_RECORD === "true";

async function seedLicenses() {
  for (const l of LICENSES) {
    await prisma.license.upsert({ where: { code: l.code }, create: l, update: l });
  }
  console.log(`✓ ${LICENSES.length} licenses (idempotent).`);
}

async function seedOrganization() {
  return prisma.organization.upsert({
    where: { rorId: "pa-institute-placeholder" },
    create: {
      name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute",
      shortName: "P/A",
      rorId: "pa-institute-placeholder",
      type: "institution",
    },
    update: {},
  });
}

async function seedDemoUsersFn(orgId: string) {
  const pw = process.env.SEED_DEFAULT_PASSWORD;
  if (!pw || pw.length < 8) {
    console.log("✗ SEED_DEMO_USERS=true but SEED_DEFAULT_PASSWORD is unset or too short — skipping demo users.");
    return;
  }
  const users: { email: string; name: string; role: "ADMIN" | "EDITOR" | "REVIEWER" | "SUBMITTER" }[] = [
    { email: "admin@pa.archive", name: "Demo Administrator", role: "ADMIN" },
    { email: "editor@pa.archive", name: "Demo Editorial Office", role: "EDITOR" },
    { email: "reviewer@pa.archive", name: "Demo Reviewer", role: "REVIEWER" },
    { email: "submitter@pa.archive", name: "Demo Researcher", role: "SUBMITTER" },
  ];
  const hash = await bcrypt.hash(pw, 12);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, organizationId: orgId, passwordHash: hash },
      update: { role: u.role },
    });
  }
  console.log(`✓ ${users.length} demo users (dev only). Password from SEED_DEFAULT_PASSWORD.`);
}

async function seedSampleRecord(orgId: string) {
  if (await prisma.record.findFirst({ where: { paidNumber: 1 } })) {
    console.log("• Sample record already present.");
    return;
  }
  const submitter = await prisma.user.findUnique({ where: { email: "submitter@pa.archive" } });
  if (!submitter) {
    console.log("✗ SEED_SAMPLE_RECORD=true but no demo submitter exists (need SEED_DEMO_USERS=true) — skipping.");
    return;
  }
  const licence = await prisma.license.findUnique({ where: { code: "CC-BY-4.0" } });
  const year = new Date().getFullYear();

  await prisma.$transaction(async (tx) => {
    const alloc = await tx.paidAllocation.create({ data: { recordId: "pending", year } });
    const record = await tx.record.create({
      data: {
        paidNumber: alloc.number,
        paidYear: year,
        status: "PUBLISHED",
        category: "methodology",
        publicationType: "RESEARCH_NOTE",
        peerReviewStatus: "NOT_REVIEWED",
        submitterId: submitter.id,
        organizationId: orgId,
        firstPublishedAt: new Date(),
        lastPublishedAt: new Date(),
      },
    });
    await tx.paidAllocation.update({ where: { number: alloc.number }, data: { recordId: record.id } });

    const version = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: 1,
        versionLabel: "v1",
        state: "PUBLISHED",
        publishedAt: new Date(),
        publicationDate: new Date(),
        title: "P/A Archive: a reference deposit",
        subtitle: "Demonstration record for the persistent identifier workflow",
        abstract:
          "This is a demonstration record seeded for local development of P/A Archive. It exercises the full deposit workflow: metadata capture, a persistent P/A Identifier allocated transactionally, a public landing page, machine-readable metadata (JSON-LD, BibTeX, RIS, Dublin Core), and citation generation. No formal DOI is registered because no DOI registrar is connected in this environment.",
        keywords: ["research infrastructure", "persistent identifiers", "open repository"],
        language: "en",
        publicationType: "RESEARCH_NOTE",
        licenseId: licence?.id ?? null,
        references: "P/A Institute (2026). P/A Archive design brief. Internal document.",
        conflictOfInterest: "The authors declare no competing interests.",
        ethicsStatement: "Not applicable — no human or animal subjects.",
      },
    });
    await tx.record.update({ where: { id: record.id }, data: { currentVersionId: version.id } });

    const author = await tx.author.create({
      data: { fullName: "Demo Researcher", givenName: "Demo", familyName: "Researcher", affiliation: process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute" },
    });
    await tx.recordAuthor.create({ data: { recordVersionId: version.id, authorId: author.id, position: 0, isCorresponding: true } });

    const paid = `PAID:${year}:${String(alloc.number).padStart(6, "0")}`;
    await tx.identifier.create({
      data: { type: "PAID", value: paid, status: "LOCAL", provider: "local", recordId: record.id, recordVersionId: version.id, isPrimary: true, registeredAt: new Date() },
    });
    await tx.fileObject.create({
      data: {
        recordVersionId: version.id,
        storageProvider: "local",
        storageKey: `records/${record.id}/v1/sample-readme.txt`,
        originalName: "sample-readme.txt",
        contentType: "text/plain",
        byteSize: 0,
        label: "Placeholder artefact",
        isPrimary: true,
      },
    });
    await tx.auditLog.create({
      data: { action: "PUBLISH", targetType: "record", targetId: record.id, summary: `Seed: sample record ${paid} published` },
    });
    console.log(`✓ Sample record ${paid} (dev only). Its placeholder file is 0 bytes.`);
  });
}

async function main() {
  console.log(`Seeding (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
  await seedLicenses();

  if (isProd) {
    console.log("• Production: no users, no sample record. Use `npm run create-admin` for the first admin.");
    console.log("Seed complete.");
    return;
  }

  const org = await seedOrganization();

  if (seedDemoUsers) {
    await seedDemoUsersFn(org.id);
  } else {
    console.log("• SEED_DEMO_USERS is not 'true' — no demo users created.");
  }

  if (seedSample) {
    if (!seedDemoUsers) {
      console.log("• SEED_SAMPLE_RECORD=true is ignored without SEED_DEMO_USERS=true.");
    } else {
      await seedSampleRecord(org.id);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
