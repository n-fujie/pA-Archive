import type { RecordView } from "@/lib/records/types";

const formats: { format: string; label: string }[] = [
  { format: "json", label: "JSON" },
  { format: "json-ld", label: "JSON-LD" },
  { format: "bibtex", label: "BibTeX" },
  { format: "ris", label: "RIS" },
  { format: "dublin-core", label: "Dublin Core (XML)" },
];

export function MetadataLinks({ view }: { view: RecordView }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {formats.map((f) => (
        <li key={f.format}>
          <a href={`/api/records/${view.slug}/metadata?format=${f.format}`}>
            {f.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
