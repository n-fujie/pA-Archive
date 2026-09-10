/**
 * Simulation adapter — same shape as lib/identifiers (a pluggable provider).
 *
 * Phase 1 has only a local stub that produces a *handoff descriptor* and runs
 * nothing. A real provider (e.g. an API in front of pa-simulation-environment)
 * would implement `run()` and return results explicitly marked as local to a
 * model / input / boundary / compute environment / execution time.
 */

export interface SimulationHandoff {
  provider: string;
  sessionId: string;
  detected: Record<string, string[]>;
  varyableInputs: string[];
  note: string;
}

export interface SimulationRunRequest {
  handoff: SimulationHandoff;
  variation?: {
    kind: "initialCondition" | "boundary" | "scale" | "parameter" | "dependencyRemoval" | "categorySubstitution" | "counterfactual";
    description: string;
  };
}

export interface SimulationResult {
  provider: string;
  producedAt: string;
  /** Always present — a simulation result is never presented as reality. */
  locality: string;
  summary: string;
  raw?: unknown;
}

export interface SimulationProvider {
  readonly name: string;
  isConfigured(): boolean;
  describeHandoff(input: Omit<SimulationHandoff, "provider" | "note">): SimulationHandoff;
  run(req: SimulationRunRequest): Promise<SimulationResult>;
}

class LocalStubProvider implements SimulationProvider {
  readonly name = "local-stub";
  isConfigured() {
    return true;
  }
  describeHandoff(input: Omit<SimulationHandoff, "provider" | "note">): SimulationHandoff {
    return {
      ...input,
      provider: this.name,
      note:
        "Descriptor only. No simulation is executed in this phase. To wire a real backend, implement a SimulationProvider whose run() returns results explicitly local to a model, input, boundary, compute environment and execution time.",
    };
  }
  async run(): Promise<SimulationResult> {
    throw new Error(
      "No simulation backend is configured. The local stub produces handoff descriptors only.",
    );
  }
}

let provider: SimulationProvider | null = null;

export function getSimulationProvider(): SimulationProvider {
  if (!provider) provider = new LocalStubProvider();
  return provider;
}
