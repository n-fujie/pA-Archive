import type { ReactNode } from "react";
import { site } from "@/lib/site";

export function PolicyPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-prose">
      <p className="mb-2 inline-block border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs text-warn">
        Placeholder text — to be replaced with the formal {site.operator} document.
      </p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="prose-academic mt-3 space-y-3">{children}</div>
    </article>
  );
}
