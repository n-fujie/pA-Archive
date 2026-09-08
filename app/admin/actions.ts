"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { checkApiRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { roleChangeSchema } from "@/lib/validation/schemas";
import { getDoiProvider } from "@/lib/identifiers";
import type { IdentifierMintInput } from "@/lib/identifiers";
import { env } from "@/lib/env";
import type { FormState } from "@/app/submit/actions";

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function changeRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await checkApiRole("ADMIN");
  if (!gate.ok) return { error: gate.error };

  const parsed = roleChangeSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid role change" };

  if (parsed.data.userId === gate.user.id) {
    return { error: "You cannot change your own role." };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { error: "User not found" };

  await prisma.user.update({ where: { id: parsed.data.userId }, data: { role: parsed.data.role } });
  await writeAudit({
    action: "USER_ROLE_CHANGE",
    actorId: gate.user.id,
    targetType: "user",
    targetId: parsed.data.userId,
    summary: `Role of ${target.email}: ${target.role} -> ${parsed.data.role}`,
    ip: await ip(),
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserDisabledAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await checkApiRole("ADMIN");
  if (!gate.ok) return { error: gate.error };
  const userId = String(formData.get("userId") ?? "");
  if (userId === gate.user.id) return { error: "You cannot disable your own account." };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found" };
  await prisma.user.update({ where: { id: userId }, data: { disabled: !target.disabled } });
  await writeAudit({
    action: "USER_ROLE_CHANGE",
    actorId: gate.user.id,
    targetType: "user",
    targetId: userId,
    summary: `${target.email} ${target.disabled ? "re-enabled" : "disabled"}`,
    ip: await ip(),
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await checkApiRole("ADMIN");
  if (!gate.ok) return { error: gate.error };

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "SUBMITTER");
  const password = String(formData.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Valid email required" };
  if (password.length < 10) return { error: "Password must be at least 10 characters" };
  if (!["READER", "SUBMITTER", "REVIEWER", "EDITOR", "ADMIN"].includes(role)) {
    return { error: "Invalid role" };
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "A user with that email already exists" };
  }
  const created = await prisma.user.create({
    data: { email, name: name || null, role: role as never, passwordHash: await hashPassword(password) },
  });
  await writeAudit({
    action: "USER_ROLE_CHANGE",
    actorId: gate.user.id,
    targetType: "user",
    targetId: created.id,
    summary: `Admin created user ${email} (${role})`,
    ip: await ip(),
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Retry a FAILED / PENDING DOI registration for a record. */
export async function retryDoiAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await checkApiRole("ADMIN");
  if (!gate.ok) return { error: gate.error };

  const provider = getDoiProvider();
  if (!provider) {
    return { error: "No DOI registrar is configured. Set DOI_PROVIDER and credentials first." };
  }
  const identifierId = String(formData.get("identifierId") ?? "");
  const idRow = await prisma.identifier.findUnique({
    where: { id: identifierId },
    include: {
      record: {
        include: {
          currentVersion: {
            include: {
              recordAuthors: { include: { author: true }, orderBy: { position: "asc" } },
              license: true,
            },
          },
        },
      },
    },
  });
  if (!idRow || idRow.type !== "DOI") return { error: "DOI identifier not found" };
  const v = idRow.record.currentVersion;
  if (!v) return { error: "Record has no current version" };

  const input: IdentifierMintInput = {
    recordId: idRow.recordId,
    recordVersionId: v.id,
    paidValue:
      (await prisma.identifier.findFirst({ where: { recordId: idRow.recordId, type: "PAID" } }))?.value ?? "",
    paidNumber: idRow.record.paidNumber,
    paidYear: idRow.record.paidYear,
    title: v.title,
    authors: v.recordAuthors.map((ra) => ({
      fullName: ra.author.fullName,
      givenName: ra.author.givenName,
      familyName: ra.author.familyName,
      orcid: ra.author.orcid,
    })),
    publicationDate: v.publicationDate ?? new Date(),
    resourceUrl: `${env.siteUrl}/records/${String(idRow.record.paidNumber).padStart(6, "0")}`,
    publicationType: v.publicationType,
    language: v.language,
    license: v.license ? { code: v.license.code, url: v.license.url } : null,
    abstract: v.abstract,
  };

  const res = await (provider.retry ?? provider.mint).call(provider, input, idRow.value);
  await prisma.identifier.update({
    where: { id: idRow.id },
    data: {
      status: res.status,
      lastAttemptAt: new Date(),
      attemptCount: { increment: 1 },
      registeredAt: res.status === "REGISTERED" ? new Date() : idRow.registeredAt,
      lastError: res.status === "FAILED" ? "Retry failed — see providerResponse" : null,
      providerResponse: (res.providerResponse ?? undefined) as never,
    },
  });
  await writeAudit({
    action: res.status === "FAILED" ? "DOI_REGISTRATION_FAILED" : "DOI_REGISTRATION",
    actorId: gate.user.id,
    targetType: "identifier",
    targetId: idRow.recordId,
    summary: `DOI retry for ${idRow.value}: ${res.status}`,
    ip: await ip(),
  });
  revalidatePath("/admin/identifiers");
  return { ok: true, warnings: [`DOI now ${res.status}.`] };
}
