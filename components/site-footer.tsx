import Link from "next/link";
import { site } from "@/lib/site";
import { identifierProviderStatus } from "@/lib/identifiers";

const legal = [
  ["About", "/about"],
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["Publication Policy", "/policies/publication"],
  ["Peer Review Policy", "/policies/peer-review"],
  ["Research Integrity", "/policies/research-integrity"],
  ["Retraction Policy", "/policies/retraction"],
  ["Copyright & Licensing", "/policies/copyright"],
  ["Contact", "/contact"],
];

export function SiteFooter() {
  const idStatus = identifierProviderStatus();
  return (
    <footer className="mt-16 border-t border-ink">
      <div className="container-page grid gap-6 py-8 text-sm sm:grid-cols-3">
        <div>
          <div className="font-semibold text-ink">{site.name}</div>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            {site.description}
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Operated by {site.operator}. Parent domain:{" "}
            <span className="font-mono">{site.parentDomain}</span>
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Policies
          </div>
          <ul className="mt-2 space-y-1">
            {legal.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="text-xs">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Identifier status
          </div>
          <p className="mt-2 text-xs text-ink-muted">{idStatus.message}</p>
          {!idStatus.formalDoiEnabled && (
            <p className="mt-2 text-xs text-ink-faint">
              P/A Identifiers are permanent local identifiers. They are not DOIs
              and {site.operator} does not claim DOI registration authority.
            </p>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Machine metadata: <span className="font-mono">/api/records</span> ·
            JSON-LD · BibTeX on every record.
          </p>
        </div>
      </div>
      <div className="container-page border-t border-rule py-4 text-xs text-ink-faint">
        © {new Date().getFullYear()} {site.operator}. Placeholder legal text — see
        each policy page.
      </div>
    </footer>
  );
}
