import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// The NextAuth middleware runs the `authorized` callback in auth.config.ts,
// which gates /admin, /editor, /review, /submit and /dashboard.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on everything except Next internals, the auth API, and static SEO files.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
