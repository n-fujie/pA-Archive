import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

const tabs = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Records", "/admin/records"],
  ["Reviews", "/admin/reviews"],
  ["Identifiers & DOI", "/admin/identifiers"],
  ["Downloads", "/admin/downloads"],
  ["Audit log", "/admin/audit"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN", "/admin");
  return (
    <div>
      <h1 className="text-xl font-semibold">Administration</h1>
      <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-rule pb-2 text-sm">
        {tabs.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
