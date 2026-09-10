import type { AuditStage } from "@prisma/client";
import type { ParsedDocument } from "@/lib/documents/parse";
import type { PlannedStage, StageOutput } from "@/lib/ziran/types";

/** Everything a stage analyzer gets. */
export interface AnalyzerContext {
  sessionId: string;
  doc: ParsedDocument;
  /** Segment id lookup, once segments are persisted (index → cuid). */
  segmentIds: string[];
  /** The planned stage (may carry scope). */
  planned: PlannedStage;
  /** Prior stage outputs, keyed by stage. */
  prior: Partial<Record<AuditStage, StageOutput>>;
  /** Existing archive linkage discovered by the DOI/review stage. */
  linkedRecordSlug?: string | null;
  linkedDoi?: string | null;
  peerReviewStatus?: string | null;
}

export interface AuditAnalyzer {
  readonly name: string;
  /** True if this analyzer can run the given stage. */
  supports(stage: AuditStage): boolean;
  analyze(stage: AuditStage, ctx: AnalyzerContext): Promise<StageOutput>;
}

/**
 * The LLM analyzer is intentionally not implemented in phase 1. When it is,
 * every call it makes must be recorded as an AiOperation and every finding it
 * produces must carry source = "AI_INFERENCE" with a groundRef into the
 * document (no ungrounded output).
 */
export class LlmAnalyzerNotConfigured implements AuditAnalyzer {
  readonly name = "llm-not-configured";
  supports(): boolean {
    return false;
  }
  async analyze(): Promise<StageOutput> {
    throw new Error(
      "LLM analyzer is not configured. Phase 1 runs deterministic / document-grounded analysis only.",
    );
  }
}
