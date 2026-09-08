import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration (no database / bcrypt imports here).
 * Consumed by middleware.ts and extended in auth.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "SUBMITTER";
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? (token.sub as string);
        session.user.role = (token.role as string) ?? "SUBMITTER";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const isLoggedIn = Boolean(auth?.user);

      // Fully gated areas
      if (pathname.startsWith("/admin")) {
        return isLoggedIn && role === "ADMIN";
      }
      if (pathname.startsWith("/editor")) {
        return isLoggedIn && (role === "EDITOR" || role === "ADMIN");
      }
      if (pathname.startsWith("/review")) {
        return (
          isLoggedIn &&
          (role === "REVIEWER" || role === "EDITOR" || role === "ADMIN")
        );
      }
      if (
        pathname.startsWith("/submit") ||
        pathname.startsWith("/dashboard")
      ) {
        return isLoggedIn;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
