"use client";

import { useMemo, useState } from "react";
import {
  CITATION_STYLE_LABELS,
  formatCitation,
  type CitationStyle,
} from "@/lib/citation";
import type { RecordView } from "@/lib/records/types";

export function CiteWidget({ view }: { view: RecordView }) {
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => formatCitation(view, style), [view, style]);

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-1">
        {CITATION_STYLE_LABELS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStyle(s.value)}
            className={`btn !px-2 !py-1 !text-xs ${
              style === s.value ? "btn-primary" : "btn-secondary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-sm bg-panel p-2 font-mono text-xs text-ink-soft">
        {text}
      </pre>
      <button
        type="button"
        className="btn btn-secondary mt-2 !py-1 !text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? "Copied" : "Copy citation"}
      </button>
    </div>
  );
}
