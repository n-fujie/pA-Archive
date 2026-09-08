import type { NextAuthConfig } from "next-auth";

const useSecureCookies =
  process.env.NODE_ENV === "production" &&
  (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const cookiePrefix = useSecureCookies ? "__Secure-" : "";

/**
 * Edge-safe auth configuration (no database / bcrypt imports here).
 * Consumed by middleware.ts and extended in auth.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
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
    /** Only ever redirect to a same-origin URL. */
    redirect({ url, baseUrl }) {
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
    authorized({ auth, request }) {
      const { pathname, origin } = request.nextUrl;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const isLoggedIn = Boolean(auth?.user);

      const needs = (allowed: string[]) => {
        if (!isLoggedIn) return false; // -> redirected to /login by NextAuth
        if (allowed.includes(role ?? "")) return true;
        return Response.redirect(new URL("/403", origin)); // logged in, wrong role
      };

      if (pathname.startsWith("/admin")) return needs(["ADMIN"]);
      if (pathname.startsWith("/editor")) return needs(["EDITOR", "ADMIN"]);
      if (pathname.startsWith("/review")) return needs(["REVIEWER", "EDITOR", "ADMIN"]);
      if (pathname.startsWith("/submit") || pathname.startsWith("/dashboard")) {
        return isLoggedIn;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
