import { env } from "@/lib/env";
import { LocalIdentifierProvider } from "./local-provider";
import { CrossrefProvider } from "./crossref-provider";
import { DataCiteProvider } from "./datacite-provider";
import type { IdentifierProvider } from "./types";

export * from "./types";
export * from "./paid";

const local = new LocalIdentifierProvider();
const crossref = new CrossrefProvider();
const datacite = new DataCiteProvider();

/**
 * The DOI provider selected by DOI_PROVIDER, but ONLY if it is fully
 * configured. Otherwise null — callers must then rely on the local provider
 * for P/A Identifiers and must not display any DOI.
 */
export function getDoiProvider(): IdentifierProvider | null {
  switch (env.doiProvider) {
    case "crossref":
      return crossref.isConfigured() ? crossref : null;
    case "datacite":
      return datacite.isConfigured() ? datacite : null;
    default:
      return null;
  }
}

/** Always available. Issues P/A Identifiers. */
export function getLocalProvider(): IdentifierProvider {
  return local;
}

/**
 * True only when a real DOI registrar is wired up. Every "show a DOI?" decision
 * in the UI / metadata layer must go through this (or a persisted REGISTERED
 * identifier row), never through DOI_PROVIDER alone.
 */
export function formalDoiEnabled(): boolean {
  return getDoiProvider() !== null;
}

export interface IdentifierProviderStatus {
  doiProviderSetting: string;
  formalDoiEnabled: boolean;
  activeProvider: "local" | "crossref" | "datacite";
  message: string;
}

export function identifierProviderStatus(): IdentifierProviderStatus {
  const doi = getDoiProvider();
  if (!doi) {
    return {
      doiProviderSetting: env.doiProvider,
      formalDoiEnabled: false,
      activeProvider: "local",
      message:
        env.doiProvider === "local"
          ? "DOI_PROVIDER=local. Issuing P/A Identifiers only. No formal DOI is registered or displayed."
          : `DOI_PROVIDER=${env.doiProvider} but credentials/prefix are missing. Falling back to P/A Identifiers only.`,
    };
  }
  return {
    doiProviderSetting: env.doiProvider,
    formalDoiEnabled: true,
    activeProvider: doi.name as "crossref" | "datacite",
    message: `Formal DOI registration active via ${doi.name}.`,
  };
}
