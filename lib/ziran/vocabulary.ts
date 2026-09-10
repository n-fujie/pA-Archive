/**
 * The current analytical vocabulary of the audit layer.
 *
 * IMPORTANT (from the upper-design brief): these terms are a *revisable
 * operational commitment*, adopted only where they add discrimination — they
 * are NOT a settled metaphysics or a new universal foundational ontology.
 * `difference`, `state`, `transition`, `configuration`, `ZS`, `graph`, etc.
 * must never be treated as the final vocabulary. Anything here can be
 * suspended, reclassified, or replaced.
 *
 * This file exists so that vocabulary drift is visible and auditable, not so
 * that the vocabulary is fixed.
 */

export interface AnalyticalTerm {
  term: string;
  /** Why this term is currently used at all. */
  adoptedBecause: string;
  /** Always true here — every term is provisional. */
  revisable: true;
  /** Terms that, if they turned out to discriminate better, would replace this. */
  couldBeReplacedBy?: string[];
}

export const ANALYTICAL_VOCABULARY: AnalyticalTerm[] = [
  { term: "difference", adoptedBecause: "distinguishes 'something changed / is distinguishable' from claims about what kind of thing changed", revisable: true },
  { term: "state", adoptedBecause: "lets transition descriptions be written without asserting a substance that bears the state", revisable: true },
  { term: "transition", adoptedBecause: "names a change between described states without committing to a mechanism", revisable: true },
  { term: "dependency", adoptedBecause: "records that one described element is conditioned on another, weaker than 'cause'", revisable: true, couldBeReplacedBy: ["constraint", "coupling"] },
  { term: "relation", adoptedBecause: "the most non-committal link between two described elements", revisable: true },
  { term: "time", adoptedBecause: "makes it explicit which interval a description holds over", revisable: true },
  { term: "scale", adoptedBecause: "makes it explicit at which resolution a description holds", revisable: true },
  { term: "boundary", adoptedBecause: "makes it explicit what was included in / excluded from the described system", revisable: true },
  { term: "history", adoptedBecause: "names that prior operations feed back into later ones without treating a log as an explanation", revisable: true },
  { term: "access", adoptedBecause: "distinguishes 'a new capacity to observe/record/discriminate/intervene' from 'a new thing exists'", revisable: true },
  { term: "configuration", adoptedBecause: "names a described arrangement at a time/scale/boundary without asserting it is fundamental", revisable: true, couldBeReplacedBy: ["arrangement", "setting"] },
  { term: "address", adoptedBecause: "a stable reference to a described element across layers — reference, never identity with a reality", revisable: true },
];

/** Configuration C(t,s,b) — used only when making time/scale/boundary explicit
 *  increases discrimination. Not required for every object. */
export interface ConfigurationCsb {
  timeInterval?: string;
  scale?: string;
  boundary?: string;
  /** Present only when at least one of the three was actually specified. */
  specified: boolean;
}

export function configurationCsb(input: {
  timeInterval?: string;
  scale?: string;
  boundary?: string;
}): ConfigurationCsb {
  return {
    ...input,
    specified: Boolean(input.timeInterval || input.scale || input.boundary),
  };
}
