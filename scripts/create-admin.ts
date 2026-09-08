/**
 * Create (or promote) the first administrator — safe for production.
 *
 * Usage:
 *   INITIAL_ADMIN_EMAIL=you@example.org INITIAL_ADMIN_PASSWORD='<strong>' \
 *     npm run create-admin
 *
 * Or pass on the CLI (still not echoed):
 *   npm run create-admin -- --email you@example.org --password '<strong>'
 *
 * Behaviour:
 *   - Never prints the password.
 *   - If the email already exists: promotes that user to ADMIN and re-enables it
 *     (does not touch the existing password unless --reset-password is given).
 *   - If any ADMIN already exists and --force is not passed, refuses to create a
 *     second bootstrap admin (promotion of the given email is still allowed).
 *   - Rejects weak passwords (< 12 chars).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const email = (arg("email") || process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = arg("password") || process.env.INITIAL_ADMIN_PASSWORD || "";
  const name = arg("name") || process.env.INITIAL_ADMIN_NAME || "Administrator";
  const resetPassword = hasFlag("reset-password");
  const force = hasFlag("force");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Provide a valid email via INITIAL_ADMIN_EMAIL or --email.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const data: Record<string, unknown> = { role: "ADMIN", disabled: false };
    if (resetPassword) {
      if (password.length < 12) {
        console.error("--reset-password requires a password of at least 12 characters.");
        process.exit(1);
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    await prisma.user.update({ where: { email }, data });
    await prisma.auditLog.create({
      data: {
        action: "USER_ROLE_CHANGE",
        targetType: "user",
        targetId: existing.id,
        summary: `Bootstrap: ${email} promoted to ADMIN${resetPassword ? " (password reset)" : ""}`,
      },
    });
    console.log(`✓ ${email} is now ADMIN${resetPassword ? " with a new password" : " (password unchanged)"}.`);
    return;
  }

  if (password.length < 12) {
    console.error("New admin requires a password of at least 12 characters (via INITIAL_ADMIN_PASSWORD or --password).");
    process.exit(1);
  }

  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0 && !force) {
    console.error(
      `An ADMIN already exists (${adminCount}). Refusing to create another bootstrap admin.\n` +
        "Promote an existing account instead, or pass --force if you really intend to add another.",
    );
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  await prisma.auditLog.create({
    data: {
      action: "USER_ROLE_CHANGE",
      actorId: user.id,
      targetType: "user",
      targetId: user.id,
      summary: `Bootstrap: initial ADMIN ${email} created`,
    },
  });
  console.log(`✓ Created ADMIN ${email}.`);
  console.log("  Now unset INITIAL_ADMIN_PASSWORD from the environment.");
}

main()
  .catch((e) => {
    console.error("create-admin failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
