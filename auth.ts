import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { writeAudit, hashIp } from "@/lib/audit";
import { RATE_LIMITS, clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/log";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const headers = request?.headers ?? new Headers();
        const ip = clientIpFrom(headers as Headers);

        // Brute-force protection: limit attempts per IP and per email.
        const parsed = credentialsSchema.safeParse(raw);
        const emailKey = parsed.success ? parsed.data.email.toLowerCase() : "invalid";
        const byIp = rateLimit(ip, RATE_LIMITS.login);
        const byEmail = rateLimit(emailKey, RATE_LIMITS.login);
        if (!byIp.ok || !byEmail.ok) {
          await writeAudit({
            action: "LOGIN_FAILURE",
            targetType: "auth",
            summary: `Login rate-limited for ${emailKey}`,
            metadata: { reason: "rate_limited", ipHash: hashIp(ip) },
          });
          return null;
        }

        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        const ok =
          !!user && !user.disabled && (await verifyPassword(password, user.passwordHash));

        if (!ok) {
          await writeAudit({
            action: "LOGIN_FAILURE",
            actorId: user?.id ?? null,
            targetType: "auth",
            summary: `Failed login for ${email.toLowerCase()}${user?.disabled ? " (account disabled)" : ""}`,
            metadata: { ipHash: hashIp(ip) },
          });
          return null;
        }

        await writeAudit({
          action: "LOGIN_SUCCESS",
          actorId: user!.id,
          targetType: "auth",
          targetId: user!.id,
          summary: `Login: ${user!.email} (${user!.role})`,
          metadata: { ipHash: hashIp(ip) },
        });
        logger.info("login.success", { userId: user!.id });

        return {
          id: user!.id,
          email: user!.email,
          name: user!.name ?? user!.email,
          role: user!.role,
        };
      },
    }),
  ],
});
