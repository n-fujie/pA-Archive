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

async function main() {
  const adminPw = process.env.SEED_ADMIN_PASSWORD || "password123";
  const defaultPw = process.env.SEED_DEFAULT_PASSWORD || "password123";
  const isProd = process.env.NODE_ENV === "production";

  // --- Licenses (idempotent) ---------------------------------------------
  for (const l of LICENSES) {
    await prisma.license.upsert({ where: { code: l.code }, create: l, update: l });
  }
  console.log(`Seeded ${LICENSES.length} licenses.`);

  // --- Organization -----------------------------------------------------
  const org = await prisma.organization.upsert({
    where: { rorId: "pa-institute-placeholder" },
    create: {
      name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute",
      shortName: "P/A",
      rorId: "pa-institute-placeholder",
      type: "institution",
    },
    update: {},
  });

  // --- Demo users ------------------------------------------------------
  // In production, only create the admin if there are no users at all.
  const userCount = await prisma.user.count();
  if (isProd && userCount > 0) {
    console.log("Production with existing users — skipping demo user creation.");
  } else {
    const users: { email: string; name: string; role: "ADMIN" | "EDITOR" | "REVIEWER" | "SUBMITTER"; pw: string }[] = [
      { email: "admin@pa.archive", name: "Archive Administrator", role: "ADMIN", pw: adminPw },
    ];
    if (!isProd) {
      users.push(
        { email: "editor@pa.archive", name: "Editorial Office", role: "EDITOR", pw: defaultPw },
        { email: "reviewer@pa.archive", name: "Reviewer One", role: "REVIEWER", pw: defaultPw },
        { email: "submitter@pa.archive", name: "Researcher One", role: "SUBMITTER", pw: defaultPw },
      );
    }
    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          organizationId: org.id,
          passwordHash: await bcrypt.hash(u.pw, 12),
        },
        update: { role: u.role },
      });
    }
    console.log(`Seeded ${users.length} user(s). admin=admin@pa.archive`);
  }

  // --- Sample record (NEVER in production) -----------------------------
  const wantSample = (process.env.SEED_SAMPLE_RECORD || "true") === "true";
  if (isProd) {
    console.log("Production — sample record is never auto-generated.");
  } else if (!wantSample) {
    console.log("SEED_SAMPLE_RECORD=false — skipping sample record.");
  } else {
    const existing = await prisma.record.findFirst({ where: { paidNumber: 1 } });
    if (existing) {
      console.log("Sample record already present.");
    } else {
      const submitter = await prisma.user.findUnique({ where: { email: "submitter@pa.archive" } });
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
            submitterId: submitter!.id,
            organizationId: org.id,
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
          data: {
            fullName: "Researcher One",
            givenName: "Researcher",
            familyName: "One",
            affiliation: process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute",
          },
        });
        await tx.recordAuthor.create({
          data: { recordVersionId: version.id, authorId: author.id, position: 0, isCorresponding: true },
        });

        const paid = `PAID:${year}:${String(alloc.number).padStart(6, "0")}`;
        await tx.identifier.create({
          data: {
            type: "PAID",
            value: paid,
            status: "LOCAL",
            provider: "local",
            recordId: record.id,
            recordVersionId: version.id,
            isPrimary: true,
            registeredAt: new Date(),
          },
        });

        // A small text file so the record has a downloadable artefact.
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
          data: {
            action: "PUBLISH",
            targetType: "record",
            targetId: record.id,
            summary: `Seed: sample record ${paid} published`,
          },
        });
        console.log(`Seeded sample record ${paid}.`);
        console.log("NOTE: its placeholder file has 0 bytes — replace via the dashboard to test downloads.");
      });
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
