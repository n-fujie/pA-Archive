import { planAudit } from "@/lib/ziran/orchestrator";
import { ANALYTICAL_VOCABULARY, configurationCsb } from "@/lib/ziran/vocabulary";
import { AUDIT_STAGES } from "@/lib/ziran/types";
import { segmentText } from "@/lib/documents/segment";
import { THEORY_MINE_PATTERNS } from "@/lib/research-audit/lexicon";
import { HeuristicAnalyzer } from "@/lib/research-audit/stages";
import type { ParsedDocument } from "@/lib/documents/parse";

function doc(text: string): ParsedDocument {
  const segments = segmentText(text, "txt");
  return {
    text,
    segments,
    meta: { parserName: "test", parserVersion: "1", wordCount: text.split(/\s+/).filter(Boolean).length, contentType: "text/plain" },
  };
}

describe("Ziran orchestrator — not always-on", () => {
  it("fires a stage only where the document gives it something", () => {
    const thin = doc("This is a short procedural note about calibrating a sensor. Turn the dial to 3.");
    const plan = planAudit(thin, { hasDoiOrRecordLink: false });
    const state = (s: string) => plan.stages.find((x) => x.stage === s)?.state;
    // structure + report always fire; the judgement stages should not on this text
    expect(state("STRUCTURE")).toBe("FIRED");
    expect(state("REPORT")).toBe("FIRED");
    expect(state("SIMULATION")).toBe("NOT_APPLICABLE");
    expect(state("ADDRESS_DOMAIN")).toBe("NOT_APPLICABLE");
    expect(state("DOI_REVIEW")).toBe("NOT_APPLICABLE");
    // every non-applicable stage carries a reason
    for (const s of plan.stages) expect(s.reason.length).toBeGreaterThan(0);
  });

  it("fires the category / theory-mine / address stages on a claim-heavy paper", () => {
    const rich = doc(
      "We show that intelligence is nothing but information flow across a network of agents. " +
        "This research was funded by the NSF and computed on a GPU cluster at our university. " +
        "The system transitions from a disordered state to an ordered state as connectivity grows. " +
        "We define an agent as a node with an internal state variable and a fixed set of parameters, " +
        "updated at each discrete time step under periodic boundary conditions. " +
        "Our simulations predict that by 2035 artificial systems will universally surpass human intelligence in every domain. " +
        "Previous attempts failed because they ignored the historical data reported in earlier work. " +
        "These findings were peer reviewed and therefore the mechanism we propose must be correct.",
    );
    const plan = planAudit(rich, { hasDoiOrRecordLink: false });
    const state = (s: string) => plan.stages.find((x) => x.stage === s)?.state;
    expect(state("CATEGORIES")).toBe("FIRED");
    expect(state("THEORY_MINE")).toBe("FIRED");
    expect(state("ADDRESS_DOMAIN")).toBe("FIRED");
    expect(state("TRANSITION")).toBe("FIRED");
  });

  it("DOI_REVIEW fires only with a DOI or a record link", () => {
    const withDoi = doc("As shown in our paper, doi 10.12345/pa.2026.000001, the effect is robust.");
    expect(planAudit(withDoi, { hasDoiOrRecordLink: false }).stages.find((s) => s.stage === "DOI_REVIEW")?.state).toBe("FIRED");
    expect(planAudit(doc("no identifier here at all, just prose about cells"), { hasDoiOrRecordLink: false }).stages.find((s) => s.stage === "DOI_REVIEW")?.state).toBe("NOT_APPLICABLE");
  });
});

describe("analytical vocabulary is marked revisable, never final", () => {
  it("every term carries revisable: true and a reason for adoption", () => {
    for (const t of ANALYTICAL_VOCABULARY) {
      expect(t.revisable).toBe(true);
      expect(t.adoptedBecause.length).toBeGreaterThan(10);
    }
  });
  it("configurationCsb only marks specified when a dimension was given", () => {
    expect(configurationCsb({}).specified).toBe(false);
    expect(configurationCsb({ scale: "micro" }).specified).toBe(true);
  });
});

describe("theory-mine patterns", () => {
  const hits = (s: string) => THEORY_MINE_PATTERNS.filter((p) => p.re.test(s)).map((p) => p.mineKind);
  it("flags reification / metaphor / over-generalisation / institutional→truth", () => {
    expect(hits("intelligence is nothing but a pattern")).toContain("ONTOLOGICAL_REIFICATION");
    expect(hits("the brain is a computer")).toContain("METAPHOR_REALIZATION");
    expect(hits("this holds universally without exception")).toContain("OVER_GENERALIZATION");
    expect(hits("it was published in Nature therefore it is true")).toContain("INSTITUTIONAL_TO_TRUTH");
  });
  it("does not flag ordinary hedged prose", () => {
    expect(hits("our results suggest a possible link that may warrant further study")).toHaveLength(0);
  });
});

describe("structure segmentation does not invent missing sections", () => {
  it("flat prose with no headings yields paragraphs only (no METHOD/RESULT)", () => {
    const segs = segmentText("This is a paragraph of plain text.\n\nHere is another paragraph without any headings.", "txt");
    expect(segs.some((s) => s.kind === "METHOD" || s.kind === "RESULT" || s.kind === "ABSTRACT")).toBe(false);
    expect(segs.some((s) => s.kind === "PARAGRAPH")).toBe(true);
  });
  it("recognises an Abstract heading when present", () => {
    const segs = segmentText("Title Line\n\nAbstract\n\nWe study things here.\n\nIntroduction\n\nMore text.", "md");
    expect(segs.some((s) => s.kind === "ABSTRACT")).toBe(true);
  });
});

describe("no single aggregate score anywhere in the stage outputs", () => {
  it("evaluation axis readings are strings, never numbers, and never summed", async () => {
    const a = new HeuristicAnalyzer();
    const d = doc("We define scale-relative behaviour within the system boundary. At the micro scale it differs.");
    const out = await a.analyze("BOUNDARY_SCALE", {
      sessionId: "t", doc: d, segmentIds: d.segments.map((_, i) => `seg${i}`),
      planned: { stage: "BOUNDARY_SCALE", state: "FIRED", reason: "", order: 0 }, prior: {},
    });
    for (const ax of out.evaluationAxes ?? []) {
      expect(typeof ax.reading).toBe("string");
      expect((ax as Record<string, unknown>).score).toBeUndefined();
      expect((ax as Record<string, unknown>).value).toBeUndefined();
    }
  });
});

describe("every heuristic finding anchors to the document", () => {
  it("non-DOCUMENT findings from the theory-mine stage carry a ground ref", async () => {
    const a = new HeuristicAnalyzer();
    const d = doc("Intelligence is nothing but flow. The brain is a computer. This proves everything universally.");
    const out = await a.analyze("THEORY_MINE", {
      sessionId: "t", doc: d, segmentIds: d.segments.map((_, i) => `seg${i}`),
      planned: { stage: "THEORY_MINE", state: "FIRED", reason: "", order: 0 }, prior: {},
    });
    for (const t of (out.theoryMines ?? []) as { groundRefs: unknown[] }[]) {
      expect(t.groundRefs.length).toBeGreaterThan(0);
    }
  });
});

describe("the 15 stages are declared in order", () => {
  it("STRUCTURE is 1 and REPORT is 15", () => {
    expect(AUDIT_STAGES[0].id).toBe("STRUCTURE");
    expect(AUDIT_STAGES[0].n).toBe(1);
    expect(AUDIT_STAGES[AUDIT_STAGES.length - 1].id).toBe("REPORT");
    expect(AUDIT_STAGES[AUDIT_STAGES.length - 1].n).toBe(15);
  });
});
