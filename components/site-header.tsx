import Link from "next/link";
import { getSessionUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/guards";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-ink">
      <div className="container-page flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="flex items-center gap-2.5 text-ink no-underline hover:no-underline"
          >
            <Logo className="h-9 w-9 shrink-0 text-ink" />
            <span className="text-lg font-semibold leading-none">{site.name}</span>
          </Link>
          <span className="hidden text-xs text-ink-faint sm:inline">
            {site.operator}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href="/records">Browse</Link>
          <Link href="/search">Search</Link>
          <Link href="/about">About</Link>
          {user ? (
            <>
              <Link href="/submit">Submit</Link>
              <Link href="/dashboard">Dashboard</Link>
              {hasRole(user.role, "REVIEWER") && <Link href="/review">Review</Link>}
              {hasRole(user.role, "EDITOR") && <Link href="/editor">Editor</Link>}
              {hasRole(user.role, "ADMIN") && <Link href="/admin">Admin</Link>}
              <span className="text-ink-faint">·</span>
              <span className="text-xs text-ink-muted">{user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/submit" className="btn btn-primary !py-1 !text-xs no-underline hover:no-underline">
                Submit research
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
