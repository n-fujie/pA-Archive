import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import {
  allocatePaidNumber,
  formatPaid,
} from "@/lib/identifiers/paid";
import {
  getDoiProvider,
  getLocalProvider,
} from "@/lib/identifiers";
import type { IdentifierMintInput } from "@/lib/identifiers";
import {
  draftMetadataSchema,
  publishMetadataSchema,
  type DraftMetadataInput,
} from "@/lib/validation/schemas";
import { recordSlug } from "@/lib/identifiers/paid";

export class RecordServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

function metadataFieldsFromInput(input: DraftMetadataInput) {
  return {
    title: input.title,
    subtitle: input.subtitle || null,
    abstract: input.abstract ?? "",
    keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean),
    language: input.language || "en",
    publicationType: input.publicationType,
    publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
    references: input.references ?? "",
    relatedIdentifiers: (input.relatedIdentifiers ?? []) as unknown as Prisma.InputJsonValue,
    funding: (input.funding ?? []) as unknown as Prisma.InputJsonValue,
    conflictOfInterest: input.conflictOfInterest ?? "",
    ethicsStatement: input.ethicsStatement ?? "",
    versionLabel: input.versionLabel || "v1",
  };
}

async function resolveLicenseId(
  tx: Prisma.TransactionClient,
  code: string | undefined | null,
): Promise<string | null> {
  if (!code) return null;
  const lic = await tx.license.findUnique({ where: { code } });
  return lic?.id ?? null;
}

async function syncAuthors(
  tx: Prisma.TransactionClient,
  versionId: string,
  authors: DraftMetadataInput["authors"],
) {
  await tx.recordAuthor.deleteMany({ where: { recordVersionId: versionId } });
  let position = 0;
  for (const a of authors ?? []) {
    const orcid = a.orcid && a.orcid !== "" ? a.orcid : null;
    let author = orcid
      ? await tx.author.findFirst({ where: { orcid } })
      : await tx.author.findFirst({
          where: { fullName: a.fullName, orcid: null, affiliation: a.affiliation || null },
        });
    if (!author) {
      author = await tx.author.create({
        data: {
          fullName: a.fullName,
          givenName: a.givenName || null,
          familyName: a.familyName || null,
          orcid,
          affiliation: a.affiliation || null,
        },
      });
    }
    await tx.recordAuthor.create({
      data: {
        recordVersionId: versionId,
        authorId: author.id,
        position: position++,
        isCorresponding: Boolean(a.isCorresponding),
        affiliationOverride: a.affiliation || null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Create draft
// ---------------------------------------------------------------------------

export async function createDraft(
  userId: string,
  raw: unknown,
  ip?: string | null,
): Promise<{ recordId: string; slug: string; versionId: string }> {
  const parsed = draftMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RecordServiceError("Invalid metadata", 422, parsed.error.flatten());
  }
  const input = parsed.data;
  const year = new Date().getUTCFullYear();

  const result = await prisma.$transaction(async (tx) => {
    // Create the concept record first (without paidNumber), then allocate.
    const number = await allocatePaidNumber(tx, "pending", year);

    const record = await tx.record.create({
      data: {
        paidNumber: number,
        paidYear: year,
        status: "DRAFT",
        category: input.category || "other",
        publicationType: input.publicationType,
        submitterId: userId,
      },
    });
    await tx.paidAllocation.update({
      where: { number },
      data: { recordId: record.id },
    });

    const fields = metadataFieldsFromInput(input);
    const version = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: 1,
        state: "DRAFT",
        createdById: userId,
        licenseId: await resolveLicenseId(tx, input.licenseCode),
        ...fields,
      },
    });
    await tx.record.update({
      where: { id: record.id },
      data: { currentVersionId: version.id },
    });
    await syncAuthors(tx, version.id, input.authors);

    // Reserve the PAID identifier row immediately (status LOCAL — usable now).
    await tx.identifier.create({
      data: {
        type: "PAID",
        value: formatPaid(year, number),
        status: "LOCAL",
        provider: "local",
        recordId: record.id,
        recordVersionId: version.id,
        isPrimary: true,
        registeredAt: new Date(),
      },
    });

    await writeAudit(
      {
        action: "RECORD_CREATE",
        actorId: userId,
        targetType: "record",
        targetId: record.id,
        summary: `Draft created: ${input.title}`,
        metadata: { paid: formatPaid(year, number) },
        ip,
      },
      tx,
    );
    await writeAudit(
      {
        action: "IDENTIFIER_GENERATION",
        actorId: userId,
        targetType: "identifier",
        targetId: record.id,
        summary: `P/A Identifier allocated: ${formatPaid(year, number)}`,
        ip,
      },
      tx,
    );

    return { recordId: record.id, slug: recordSlug(number), versionId: version.id };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Update draft metadata (only DRAFT versions are mutable)
// ---------------------------------------------------------------------------

export async function updateDraftMetadata(
  recordId: string,
  raw: unknown,
  userId: string,
  ip?: string | null,
): Promise<void> {
  const parsed = draftMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RecordServiceError("Invalid metadata", 422, parsed.error.flatten());
  }
  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      include: { currentVersion: true },
    });
    if (!record) throw new RecordServiceError("Record not found", 404);
    const version = record.currentVersion;
    if (!version || version.state !== "DRAFT") {
      throw new RecordServiceError(
        "This version is published and can no longer be edited. Create a new version instead.",
        409,
      );
    }

    const fields = metadataFieldsFromInput(input);
    await tx.recordVersion.update({
      where: { id: version.id },
      data: { ...fields, licenseId: await resolveLicenseId(tx, input.licenseCode) },
    });
    await tx.record.update({
      where: { id: recordId },
      data: { category: input.category || record.category, publicationType: input.publicationType },
    });
    await syncAuthors(tx, version.id, input.authors);

    await writeAudit(
      {
        action: "METADATA_UPDATE",
        actorId: userId,
        targetType: "record_version",
        targetId: version.id,
        summary: `Metadata updated for ${record.paidYear}:${recordSlug(record.paidNumber)} v${version.versionNumber}`,
        ip,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export interface PublishResult {
  slug: string;
  paid: string;
  doi: string | null;
  doiStatus: string | null;
  warnings: string[];
}

export async function publishRecord(
  recordId: string,
  userId: string,
  ip?: string | null,
): Promise<PublishResult> {
  const warnings: string[] = [];

  // 1. Load + validate (outside the write transaction).
  const record = await prisma.record.findUnique({
    where: { id: recordId },
    include: {
      currentVersion: {
        include: {
          files: true,
          recordAuthors: { include: { author: true }, orderBy: { position: "asc" } },
          license: true,
        },
      },
      identifiers: true,
    },
  });
  if (!record) throw new RecordServiceError("Record not found", 404);
  const version = record.currentVersion;
  if (!version) throw new RecordServiceError("Record has no version", 409);
  if (version.state === "PUBLISHED") {
    throw new RecordServiceError("This version is already published", 409);
  }

  // Metadata validation
  const check = publishMetadataSchema.safeParse({
    title: version.title,
    subtitle: version.subtitle ?? "",
    abstract: version.abstract,
    keywords: version.keywords,
    language: version.language,
    publicationType: version.publicationType,
    category: record.category,
    licenseCode: version.license?.code ?? "",
    publicationDate: version.publicationDate?.toISOString() ?? "",
    references: version.references,
    relatedIdentifiers: version.relatedIdentifiers,
    funding: version.funding,
    conflictOfInterest: version.conflictOfInterest,
    ethicsStatement: version.ethicsStatement,
    versionLabel: version.versionLabel,
    authors: version.recordAuthors.map((ra) => ({
      fullName: ra.author.fullName,
      givenName: ra.author.givenName ?? "",
      familyName: ra.author.familyName ?? "",
      orcid: ra.author.orcid ?? "",
      affiliation: ra.affiliationOverride ?? ra.author.affiliation ?? "",
      isCorresponding: ra.isCorresponding,
    })),
  });
  if (!check.success) {
    throw new RecordServiceError(
      "Metadata validation failed. Complete all required fields before publishing.",
      422,
      check.error.flatten(),
    );
  }

  // File existence check
  const activeFiles = version.files.filter((f) => !f.supersededById);
  if (activeFiles.length === 0) {
    throw new RecordServiceError("At least one file must be uploaded before publishing", 422);
  }

  // License confirmation
  if (!version.license) {
    throw new RecordServiceError("A license must be selected before publishing", 422);
  }

  const now = new Date();
  const publicationDate = version.publicationDate ?? now;
  const paidValue =
    record.identifiers.find((i) => i.type === "PAID")?.value ??
    formatPaid(record.paidYear, record.paidNumber);
  const slug = recordSlug(record.paidNumber);
  const resourceUrl = `${env.siteUrl}/records/${slug}`;

  // 2. Flip to published + record timestamps (transaction).
  await prisma.$transaction(async (tx) => {
    await tx.recordVersion.update({
      where: { id: version.id },
      data: { state: "PUBLISHED", publishedAt: now, publicationDate },
    });
    await tx.record.update({
      where: { id: record.id },
      data: {
        status: "PUBLISHED",
        currentVersionId: version.id,
        firstPublishedAt: record.firstPublishedAt ?? now,
        lastPublishedAt: now,
      },
    });
    // Ensure the PAID identifier row exists + is LOCAL.
    await tx.identifier.upsert({
      where: { value: paidValue },
      create: {
        type: "PAID",
        value: paidValue,
        status: "LOCAL",
        provider: "local",
        recordId: record.id,
        recordVersionId: version.id,
        isPrimary: true,
        registeredAt: now,
      },
      update: { recordVersionId: version.id, status: "LOCAL" },
    });
    await writeAudit(
      {
        action: "PUBLISH",
        actorId: userId,
        targetType: "record_version",
        targetId: version.id,
        summary: `Published ${paidValue} v${version.versionNumber}: ${version.title}`,
        metadata: { fileCount: activeFiles.length },
        ip,
      },
      tx,
    );
  });

  // 3. DOI registration — OUTSIDE the publish transaction so a registry outage
  //    never rolls back a successful publish. State is tracked on the
  //    Identifier row (reserved/pending/registered/failed).
  let doiValue: string | null = null;
  let doiStatus: string | null = null;

  const doiProvider = getDoiProvider();
  const localProvider = getLocalProvider();

  const mintInput: IdentifierMintInput = {
    recordId: record.id,
    recordVersionId: version.id,
    paidValue,
    paidNumber: record.paidNumber,
    paidYear: record.paidYear,
    title: version.title,
    authors: version.recordAuthors.map((ra) => ({
      fullName: ra.author.fullName,
      givenName: ra.author.givenName,
      familyName: ra.author.familyName,
      orcid: ra.author.orcid,
    })),
    publicationDate,
    resourceUrl,
    publicationType: version.publicationType,
    language: version.language,
    license: version.license ? { code: version.license.code, url: version.license.url } : null,
    abstract: version.abstract,
  };

  // Always confirm the local identifier.
  await localProvider.mint(mintInput);

  if (doiProvider) {
    try {
      const res = await doiProvider.mint(mintInput);
      doiValue = res.value;
      doiStatus = res.status;
      await prisma.identifier.upsert({
        where: { value: res.value },
        create: {
          type: "DOI",
          value: res.value,
          status: res.status,
          provider: res.provider,
          recordId: record.id,
          recordVersionId: version.id,
          isPrimary: false,
          registeredAt: res.status === "REGISTERED" ? new Date() : null,
          lastAttemptAt: new Date(),
          attemptCount: 1,
          providerResponse: (res.providerResponse ?? undefined) as Prisma.InputJsonValue | undefined,
          lastError: res.status === "FAILED" ? "Registration failed — see providerResponse" : null,
        },
        update: {
          status: res.status,
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
          registeredAt: res.status === "REGISTERED" ? new Date() : undefined,
          providerResponse: (res.providerResponse ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await writeAudit({
        action: res.status === "FAILED" ? "DOI_REGISTRATION_FAILED" : "DOI_REGISTRATION",
        actorId: userId,
        targetType: "identifier",
        targetId: record.id,
        summary: `DOI ${res.value} -> ${res.status} via ${res.provider}`,
        ip,
      });
      if (res.status === "FAILED") {
        warnings.push(
          "The record is published with its P/A Identifier. Formal DOI registration failed and will be retried by an editor.",
        );
      } else if (res.status === "PENDING") {
        warnings.push("The record is published. The DOI has been submitted and is pending registrar confirmation.");
      }
    } catch (err) {
      await writeAudit({
        action: "DOI_REGISTRATION_FAILED",
        actorId: userId,
        targetType: "identifier",
        targetId: record.id,
        summary: `DOI registration threw: ${(err as Error).message}`,
        ip,
      });
      warnings.push("The record is published with its P/A Identifier. A DOI could not be requested (registrar error).");
    }
  }

  return { slug, paid: paidValue, doi: doiValue, doiStatus, warnings };
}

// ---------------------------------------------------------------------------
// New version
// ---------------------------------------------------------------------------

export async function createNewVersion(
  recordId: string,
  userId: string,
  ip?: string | null,
): Promise<{ versionId: string; versionNumber: number }> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { recordAuthors: true, files: true },
        },
      },
    });
    if (!record) throw new RecordServiceError("Record not found", 404);
    const latest = record.versions[0];
    if (!latest) throw new RecordServiceError("Record has no version to base on", 409);
    if (latest.state === "DRAFT") {
      throw new RecordServiceError("There is already an unpublished draft version", 409);
    }

    const nextNumber = latest.versionNumber + 1;
    const newVersion = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: nextNumber,
        versionLabel: `v${nextNumber}`,
        state: "DRAFT",
        createdById: userId,
        title: latest.title,
        subtitle: latest.subtitle,
        abstract: latest.abstract,
        keywords: latest.keywords,
        language: latest.language,
        publicationType: latest.publicationType,
        licenseId: latest.licenseId,
        references: latest.references,
        relatedIdentifiers: latest.relatedIdentifiers as Prisma.InputJsonValue,
        funding: latest.funding as Prisma.InputJsonValue,
        conflictOfInterest: latest.conflictOfInterest,
        ethicsStatement: latest.ethicsStatement,
      },
    });

    // Copy author links + file rows (files reference the same storage objects;
    // the old version's rows are untouched — nothing is overwritten).
    for (const ra of latest.recordAuthors) {
      await tx.recordAuthor.create({
        data: {
          recordVersionId: newVersion.id,
          authorId: ra.authorId,
          position: ra.position,
          isCorresponding: ra.isCorresponding,
          affiliationOverride: ra.affiliationOverride,
        },
      });
    }
    for (const f of latest.files.filter((x) => !x.supersededById)) {
      await tx.fileObject.create({
        data: {
          recordVersionId: newVersion.id,
          storageProvider: f.storageProvider,
          storageKey: f.storageKey,
          downloadUrl: f.downloadUrl,
          originalName: f.originalName,
          contentType: f.contentType,
          byteSize: f.byteSize,
          checksumSha256: f.checksumSha256,
          label: f.label,
          isPrimary: f.isPrimary,
          uploadedById: userId,
        },
      });
    }

    await tx.record.update({ where: { id: record.id }, data: { currentVersionId: newVersion.id } });

    // Link versions with relationships.
    await tx.relationship.create({
      data: {
        sourceRecordId: record.id,
        targetRecordId: record.id,
        relationType: "IS_NEW_VERSION_OF",
        note: `v${nextNumber} supersedes v${latest.versionNumber}`,
        createdById: userId,
      },
    });

    await writeAudit(
      {
        action: "VERSION_CREATE",
        actorId: userId,
        targetType: "record_version",
        targetId: newVersion.id,
        summary: `New draft version v${nextNumber} for ${formatPaid(record.paidYear, record.paidNumber)}`,
        ip,
      },
      tx,
    );

    return { versionId: newVersion.id, versionNumber: nextNumber };
  });
}

// ---------------------------------------------------------------------------
// Notices: correction / retraction / withdrawal (history is never destroyed)
// ---------------------------------------------------------------------------

export async function addNotice(
  recordId: string,
  type: "CORRECTION" | "RETRACTION" | "WITHDRAWAL",
  reason: string,
  detailsUrl: string | null,
  userId: string,
  ip?: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({ where: { id: recordId } });
    if (!record) throw new RecordServiceError("Record not found", 404);
    if (record.status === "DRAFT") {
      throw new RecordServiceError("Only published records can carry a notice", 409);
    }

    await tx.recordNotice.create({
      data: { recordId, type, reason, detailsUrl, createdById: userId },
    });

    let newStatus = record.status;
    if (type === "RETRACTION") newStatus = "RETRACTED";
    else if (type === "WITHDRAWAL") newStatus = "WITHDRAWN";
    // CORRECTION keeps status PUBLISHED — the record stays live.

    if (newStatus !== record.status) {
      await tx.record.update({ where: { id: recordId }, data: { status: newStatus } });
    }

    const action =
      type === "RETRACTION" ? "RETRACTION" : type === "WITHDRAWAL" ? "WITHDRAWAL" : "CORRECTION";
    await writeAudit(
      {
        action,
        actorId: userId,
        targetType: "record",
        targetId: recordId,
        summary: `${type} notice added to ${formatPaid(record.paidYear, record.paidNumber)}`,
        metadata: { reason },
        ip,
      },
      tx,
    );
  });
}

export async function unpublishRecord(
  recordId: string,
  userId: string,
  ip?: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({ where: { id: recordId } });
    if (!record) throw new RecordServiceError("Record not found", 404);
    await tx.record.update({ where: { id: recordId }, data: { status: "WITHDRAWN" } });
    await writeAudit(
      {
        action: "UNPUBLISH",
        actorId: userId,
        targetType: "record",
        targetId: recordId,
        summary: `Record ${formatPaid(record.paidYear, record.paidNumber)} withdrawn from public view`,
        ip,
      },
      tx,
    );
  });
}
