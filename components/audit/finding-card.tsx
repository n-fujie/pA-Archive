import type { AuditSessionView } from "@/lib/research-audit/load";

type Finding = AuditSessionView["allFindings"][number];

const SOURCE_LABEL: Record<string, string> = {
  DOCUMENT: "from the document",
  HEURISTIC: "deterministic rule",
  AI_INFERENCE: "AI inference",
  MIXED: "mixed",
};

const SOURCE_CLASS: Record<string, string> = {
  DOCUMENT: "border-ok/40 bg-ok/10 text-ok",
  HEURISTIC: "border-navy/30 bg-navy/5 text-navy",
  AI_INFERENCE: "border-warn/40 bg-warn/10 text-warn",
  MIXED: "border-rule bg-panel text-ink-muted",
};

export function FindingCard({
  finding,
  onJump,
}: {
  finding: Finding;
  /** client pages pass a handler; server pages omit it */
  onJump?: (charStart: number, charEnd: number) => void;
}) {
  return (
    <article className="card p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono uppercase tracking-wide text-ink-muted">{finding.kind.replace(/_/g, " ").toLowerCase()}</span>
        <span className={`badge ${SOURCE_CLASS[finding.source] ?? "badge-paid"}`}>{SOURCE_LABEL[finding.source] ?? finding.source}</span>
        {finding.severity && <span className="badge badge-warn">{finding.severity.toLowerCase()}</span>}
        {finding.undecidable && <span className="badge badge-danger">undecidable</span>}
        {finding.needsVerification && <span className="badge badge-warn">needs verification</span>}
        <span className="text-ink-faint">· stage: {finding.stageLabel}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{finding.summary}</p>
      {finding.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{finding.detail}</p>}
      {finding.inferencePath && (
        <p className="mt-1 text-xs text-ink-muted">
          <span className="font-semibold">Inference path:</span> {finding.inferencePath}
        </p>
      )}
      {finding.uncertaintyText && (
        <p className="mt-1 text-xs text-ink-faint">
          <span className="font-semibold">Uncertainty:</span> {finding.uncertaintyText}
        </p>
      )}
      {finding.groundRefs.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Grounds in the document</p>
          {finding.groundRefs.map((g, i) => (
            <blockquote key={i} className="border-l-2 border-rule pl-2 text-xs text-ink-muted">
              <span className="whitespace-pre-wrap">“{g.quote}”</span>{" "}
              {onJump ? (
                <button type="button" className="text-navy hover:underline" onClick={() => onJump(g.charStart, g.charEnd)}>
                  [jump to text]
                </button>
              ) : (
                <span className="font-mono text-ink-faint">[{g.charStart}–{g.charEnd}]</span>
              )}
            </blockquote>
          ))}
        </div>
      )}
      {finding.groundRefs.length === 0 && finding.source !== "DOCUMENT" && (
        <p className="mt-2 text-[11px] text-ink-faint">No document anchor recorded for this finding.</p>
      )}
    </article>
  );
}
