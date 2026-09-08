import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <PolicyPage title="Contact">
      <p>
        {site.name} is operated by {site.operator}. For editorial, technical, or
        integrity matters, contact details will be published here.
      </p>
      <ul className="list-disc pl-5">
        <li>Editorial office: editorial@{site.parentDomain} (placeholder)</li>
        <li>Technical / metadata: archive@{site.parentDomain} (placeholder)</li>
        <li>Research integrity: integrity@{site.parentDomain} (placeholder)</li>
      </ul>
    </PolicyPage>
  );
}
