import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Notice">
      <p>
        Account data (name, email, ORCID, affiliation) is stored to operate
        submission and review workflows. Author metadata on published records is
        public by design.
      </p>
      <p>
        Download and usage events store a salted one-way hash of the requesting
        IP address and a truncated user-agent string for aggregate statistics.
        The raw IP address is not retained.
      </p>
      <p>
        Cookies are limited to what is required for authentication. No
        third-party analytics or advertising trackers are used.
      </p>
      <p>The formal privacy policy, including data-subject rights, will be published here.</p>
    </PolicyPage>
  );
}
