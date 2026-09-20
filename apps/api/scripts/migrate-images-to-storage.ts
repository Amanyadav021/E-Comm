import 'dotenv/config';
/**
 * One-time migration: push every locally-stored image into the configured
 * object storage and rewrite the URLs held in the database.
 *
 * Why: image URLs currently embed whatever host served them (localhost, or a
 * tunnel URL that changes on every restart). Once the files live in object
 * storage their URLs are permanent and no longer depend on where the API runs.
 *
 *   STORAGE_PROVIDER=s3  (+ the S3_* vars)  npm run images:migrate -w @shopcraft/api
 *
 * Safe to re-run: files are re-uploaded under the same keys and rows already
 * pointing at the storage host are skipped.
 */
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join, relative, extname, sep } from 'path';
import { storageProviderFactory } from '../src/uploads/storage.provider';

const prisma = new PrismaClient();
const UPLOADS = join(__dirname, '..', 'uploads');

const CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function main() {
  const storage = storageProviderFactory();
  if (storage.name !== 's3') {
    console.error('STORAGE_PROVIDER is "local" — set it to s3 (with the S3_* vars) before running this.');
    process.exit(1);
  }

  const files = await walk(UPLOADS);
  if (files.length === 0) {
    console.log('No local images found under apps/api/uploads — nothing to migrate.');
    return;
  }
  console.log(`Uploading ${files.length} file(s)...`);

  /** basename -> permanent storage URL */
  const urlByName = new Map<string, string>();
  for (const file of files) {
    const key = relative(UPLOADS, file).split(sep).join('/');
    const body = await fs.readFile(file);
    const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const url = await storage.put(key, body, type);
    urlByName.set(key.split('/').pop()!, url);
  }
  console.log(`Uploaded ${urlByName.size} file(s).`);

  /** Swap a stored URL for the storage one, matched on filename. */
  const remap = (current: string | null): string | null => {
    if (!current) return null;
    const name = current.split('?')[0].split('/').pop();
    if (!name) return null;
    const next = urlByName.get(name);
    return next && next !== current ? next : null;
  };

  let changed = 0;

  for (const row of await prisma.productImage.findMany()) {
    const url = remap(row.url);
    if (url) { await prisma.productImage.update({ where: { id: row.id }, data: { url } }); changed++; }
  }
  for (const row of await prisma.banner.findMany()) {
    const imageUrl = remap(row.imageUrl);
    const mobileImageUrl = remap(row.mobileImageUrl);
    if (imageUrl || mobileImageUrl) {
      await prisma.banner.update({
        where: { id: row.id },
        data: { ...(imageUrl ? { imageUrl } : {}), ...(mobileImageUrl ? { mobileImageUrl } : {}) },
      });
      changed++;
    }
  }
  for (const row of await prisma.category.findMany()) {
    const imageUrl = remap(row.imageUrl);
    if (imageUrl) { await prisma.category.update({ where: { id: row.id }, data: { imageUrl } }); changed++; }
  }
  for (const row of await prisma.brand.findMany()) {
    const logoUrl = remap(row.logoUrl);
    if (logoUrl) { await prisma.brand.update({ where: { id: row.id }, data: { logoUrl } }); changed++; }
  }
  // Order items keep an image snapshot so historic orders still render
  for (const row of await prisma.orderItem.findMany({ where: { imageSnapshot: { not: null } } })) {
    const imageSnapshot = remap(row.imageSnapshot);
    if (imageSnapshot) { await prisma.orderItem.update({ where: { id: row.id }, data: { imageSnapshot } }); changed++; }
  }

  console.log(`Rewrote ${changed} database row(s).`);
  console.log('\nImage URLs are now permanent and independent of where the API runs.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
