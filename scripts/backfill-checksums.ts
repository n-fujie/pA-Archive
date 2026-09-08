/**
 * Backfill SHA-256 checksums for FileObject rows that are missing one.
 *
 *   npm run backfill-checksums          # report + write
 *   npm run backfill-checksums -- --dry # report only
 *
 * Reads each file's bytes through the configured storage driver, computes the
 * digest, and stores it. Rows whose bytes cannot be read (e.g. the 0-byte seed
 * placeholder, or a missing object) are reported and skipped. This is an
 * integrity aid, not a cryptographic ledger.
 */
import { prisma } from "@/lib/db";
import { getStorage, sha256 } from "@/lib/storage";

const dryRun = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.fileObject.findMany({
    where: { checksumSha256: null },
    select: { id: true, storageKey: true, originalName: true, byteSize: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${rows.length} file row(s) without a checksum.`);
  const storage = getStorage();

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.byteSize === 0) {
      console.log(`  skip (0 bytes): ${row.originalName} [${row.id}]`);
      skipped++;
      continue;
    }
    try {
      const obj = await storage.get(row.storageKey);
      const digest = sha256(obj.body);
      if (!dryRun) {
        await prisma.fileObject.update({ where: { id: row.id }, data: { checksumSha256: digest } });
      }
      console.log(`  ${dryRun ? "would set" : "set"} ${digest.slice(0, 16)}…  ${row.originalName} [${row.id}]`);
      updated++;
    } catch (err) {
      console.log(`  skip (unreadable): ${row.originalName} [${row.id}] — ${(err as Error).message}`);
      skipped++;
    }
  }
  console.log(`\nDone. ${updated} ${dryRun ? "would be updated" : "updated"}, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
