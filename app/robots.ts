import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/records", "/search", "/about", "/terms", "/privacy", "/contact", "/policies"],
        disallow: [
          "/admin",
          "/editor",
          "/review",
          "/dashboard",
          "/submit",
          "/login",
          "/register",
          "/403",
          "/api/",
        ],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
