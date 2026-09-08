"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  CATEGORIES,
  LANGUAGES,
  PUBLICATION_TYPES,
} from "@/lib/constants";
import { RELATION_TYPE_VALUES } from "@/lib/validation/schemas";
import type { FormState } from "@/app/submit/actions";

export interface AuthorRow {
  fullName: string;
  givenName?: string;
  familyName?: string;
  orcid?: string;
  affiliation?: string;
  isCorresponding?: boolean;
}
export interface RelatedRow {
  identifier: string;
  scheme: string;
  relation: string;
}
export interface FundingRow {
  funder: string;
  awardNumber?: string;
  awardTitle?: string;
}

export interface MetadataInitial {
  title: string;
  subtitle: string;
  abstract: string;
  keywords: string;
  language: string;
  publicationType: string;
  category: string;
  licenseCode: string;
  publicationDate: string;
  references: string;
  conflictOfInterest: string;
  ethicsStatement: string;
  versionLabel: string;
  authors: AuthorRow[];
  relatedIdentifiers: RelatedRow[];
  funding: FundingRow[];
}

const empty: MetadataInitial = {
  title: "",
  subtitle: "",
  abstract: "",
  keywords: "",
  language: "en",
  publicationType: "PREPRINT",
  category: "other",
  licenseCode: "",
  publicationDate: "",
  references: "",
  conflictOfInterest: "",
  ethicsStatement: "",
  versionLabel: "v1",
  authors: [{ fullName: "" }],
  relatedIdentifiers: [],
  funding: [],
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Saving…" : label}
    </button>
  );
}

export function MetadataForm({
  action,
  initial,
  licenses,
  submitLabel = "Save draft",
  mode = "edit",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Partial<MetadataInitial>;
  licenses: { code: string; name: string }[];
  submitLabel?: string;
  mode?: "create" | "edit";
}) {
  const init = { ...empty, ...initial };
  const [state, formAction] = useFormState(action, {} as FormState);
  const [authors, setAuthors] = useState<AuthorRow[]>(
    init.authors.length ? init.authors : [{ fullName: "" }],
  );
  const [related, setRelated] = useState<RelatedRow[]>(init.relatedIdentifiers);
  const [funding, setFunding] = useState<FundingRow[]>(init.funding);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && !state.warnings && (
        <p className="rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Saved.</p>
      )}

      <input type="hidden" name="authorsJson" value={JSON.stringify(authors)} />
      <input type="hidden" name="relatedJson" value={JSON.stringify(related)} />
      <input type="hidden" name="fundingJson" value={JSON.stringify(funding)} />

      <section className="space-y-3">
        <Text name="title" label="Title" required defaultValue={init.title} errors={fe.title} />
        <Text name="subtitle" label="Subtitle" defaultValue={init.subtitle} errors={fe.subtitle} />
        <div>
          <label className="field-label" htmlFor="abstract">
            Abstract {mode === "edit" && <span className="text-ink-faint">(required to publish)</span>}
          </label>
          <textarea
            id="abstract"
            name="abstract"
            rows={6}
            defaultValue={init.abstract}
            className="input"
          />
          {fe.abstract?.map((e) => <p key={e} className="field-hint text-danger">{e}</p>)}
        </div>
        <Text
          name="keywords"
          label="Keywords (comma separated)"
          defaultValue={init.keywords}
          errors={fe.keywords}
        />
      </section>

      <fieldset className="space-y-2">
        <legend className="field-label">Authors</legend>
        {authors.map((a, i) => (
          <div key={i} className="card grid gap-2 p-2 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Full name (required)"
              value={a.fullName}
              onChange={(e) => updateRow(setAuthors, authors, i, { fullName: e.target.value })}
            />
            <input
              className="input"
              placeholder="ORCID 0000-0000-0000-0000"
              value={a.orcid ?? ""}
              onChange={(e) => updateRow(setAuthors, authors, i, { orcid: e.target.value })}
            />
            <input
              className="input"
              placeholder="Given name"
              value={a.givenName ?? ""}
              onChange={(e) => updateRow(setAuthors, authors, i, { givenName: e.target.value })}
            />
            <input
              className="input"
              placeholder="Family name"
              value={a.familyName ?? ""}
              onChange={(e) => updateRow(setAuthors, authors, i, { familyName: e.target.value })}
            />
            <input
              className="input sm:col-span-2"
              placeholder="Affiliation"
              value={a.affiliation ?? ""}
              onChange={(e) => updateRow(setAuthors, authors, i, { affiliation: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={Boolean(a.isCorresponding)}
                onChange={(e) => updateRow(setAuthors, authors, i, { isCorresponding: e.target.checked })}
              />
              Corresponding author
            </label>
            <div className="text-right">
              <button
                type="button"
                className="text-xs text-danger hover:underline"
                onClick={() => setAuthors(authors.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary !py-1 !text-xs"
          onClick={() => setAuthors([...authors, { fullName: "" }])}
        >
          Add author
        </button>
        {fe.authors?.map((e) => <p key={e} className="field-hint text-danger">{e}</p>)}
      </fieldset>

      <section className="grid gap-3 sm:grid-cols-2">
        <Select name="publicationType" label="Publication type" defaultValue={init.publicationType}>
          {PUBLICATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select name="category" label="Category" defaultValue={init.category}>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select name="language" label="Language" defaultValue={init.language}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </Select>
        <Select name="licenseCode" label="License" defaultValue={init.licenseCode}>
          <option value="">— select —</option>
          {licenses.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </Select>
        <Text
          name="publicationDate"
          label="Publication date"
          type="date"
          defaultValue={init.publicationDate}
          errors={fe.publicationDate}
        />
        <Text name="versionLabel" label="Version label" defaultValue={init.versionLabel} />
      </section>

      <div>
        <label className="field-label" htmlFor="references">
          References (one per line or free text)
        </label>
        <textarea id="references" name="references" rows={4} defaultValue={init.references} className="input" />
      </div>

      <fieldset className="space-y-2">
        <legend className="field-label">Related identifiers</legend>
        {related.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
            <input
              className="input"
              placeholder="DOI / URL / arXiv / PAID"
              value={r.identifier}
              onChange={(e) => updateRow(setRelated, related, i, { identifier: e.target.value })}
            />
            <select
              className="input"
              value={r.scheme}
              onChange={(e) => updateRow(setRelated, related, i, { scheme: e.target.value })}
            >
              {["doi", "url", "handle", "arxiv", "isbn", "pmid", "paid", "other"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="input"
              value={r.relation}
              onChange={(e) => updateRow(setRelated, related, i, { relation: e.target.value })}
            >
              {RELATION_TYPE_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs text-danger hover:underline"
              onClick={() => setRelated(related.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary !py-1 !text-xs"
          onClick={() => setRelated([...related, { identifier: "", scheme: "other", relation: "CITES" }])}
        >
          Add related identifier
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="field-label">Funding</legend>
        {funding.map((f, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              className="input"
              placeholder="Funder"
              value={f.funder}
              onChange={(e) => updateRow(setFunding, funding, i, { funder: e.target.value })}
            />
            <input
              className="input"
              placeholder="Award number"
              value={f.awardNumber ?? ""}
              onChange={(e) => updateRow(setFunding, funding, i, { awardNumber: e.target.value })}
            />
            <input
              className="input"
              placeholder="Award title"
              value={f.awardTitle ?? ""}
              onChange={(e) => updateRow(setFunding, funding, i, { awardTitle: e.target.value })}
            />
            <button
              type="button"
              className="text-xs text-danger hover:underline"
              onClick={() => setFunding(funding.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary !py-1 !text-xs"
          onClick={() => setFunding([...funding, { funder: "" }])}
        >
          Add funding source
        </button>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="conflictOfInterest">
            Conflict of interest statement
          </label>
          <textarea
            id="conflictOfInterest"
            name="conflictOfInterest"
            rows={3}
            defaultValue={init.conflictOfInterest}
            className="input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ethicsStatement">
            Ethics statement
          </label>
          <textarea
            id="ethicsStatement"
            name="ethicsStatement"
            rows={3}
            defaultValue={init.ethicsStatement}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <SubmitButton label={submitLabel} />
        {mode === "create" && (
          <p className="text-xs text-ink-muted">
            A P/A Identifier is allocated as soon as the draft is created. The
            record stays private until you publish.
          </p>
        )}
      </div>
    </form>
  );
}

function updateRow<T>(
  setter: (rows: T[]) => void,
  rows: T[],
  index: number,
  patch: Partial<T>,
) {
  setter(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

function Text({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="input"
      />
      {errors?.map((e) => (
        <p key={e} className="field-hint text-danger">
          {e}
        </p>
      ))}
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="input">
        {children}
      </select>
    </div>
  );
}
