import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Use">
      <p>
        By depositing content you confirm that you have the right to share it and
        to license it under the terms you select, and that the deposit does not
        infringe any third-party rights or applicable law.
      </p>
      <p>
        Published records are intended to be permanent. Withdrawal is possible
        only in limited circumstances and always leaves a public tombstone.
      </p>
      <p>
        The service is provided on an &ldquo;as is&rdquo; basis. Formal terms,
        including liability, acceptable use, and dispute resolution, will be
        published here.
      </p>
    </PolicyPage>
  );
}
