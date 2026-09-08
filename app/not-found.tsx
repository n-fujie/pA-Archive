import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-prose">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="prose-academic mt-2">
        The record or page you requested does not exist, or is not publicly
        available.
      </p>
      <p className="mt-4 flex gap-4">
        <Link href="/">Home</Link>
        <Link href="/records">Browse records</Link>
        <Link href="/search">Search</Link>
      </p>
    </div>
  );
}
