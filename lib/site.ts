import { env } from "@/lib/env";

export const site = {
  name: env.serviceName,
  operator: env.operatorName,
  url: env.siteUrl,
  parentDomain: env.parentDomain,
  tagline: "Independent research repository and persistent identifier registry",
  description:
    "P/A Archive is the open research repository of P/A Institute. Researchers deposit scholarly works, receive a persistent P/A Identifier, and — where a formal DOI registrar is connected — a registered DOI.",
};

export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
