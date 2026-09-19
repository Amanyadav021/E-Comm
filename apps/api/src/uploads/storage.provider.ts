import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * File storage abstraction (STORAGE_PROVIDER = local | s3).
 *
 * `local` writes under apps/api/uploads and is fine for development, but on any
 * container host the filesystem is ephemeral — images uploaded through the admin
 * disappear on the next deploy. Production should use `s3`.
 *
 * The `s3` provider speaks plain S3, so it works with Supabase Storage,
 * Cloudflare R2, AWS S3 or MinIO; only the env vars change.
 */
export interface StorageProvider {
  readonly name: string;
  /** Store bytes under `key` and return the public URL to read them back. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  async put(key: string, body: Buffer): Promise<string> {
    // __dirname is dist/uploads at runtime, so ../.. lands on the app root
    const full = join(__dirname, '..', '..', 'uploads', key);
    await fs.mkdir(join(full, '..'), { recursive: true });
    await fs.writeFile(full, body);
    const base = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
    return `${base}/uploads/${key}`;
  }
}

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger('S3StorageProvider');
  private client: any | null = null;

  private get bucket(): string {
    const b = process.env.S3_BUCKET;
    if (!b) throw new Error('S3_BUCKET is not set');
    return b;
  }

  private getClient() {
    if (this.client) return this.client;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
      // Supabase, R2 and MinIO all require path-style addressing
      forcePathStyle: true,
    });
    return this.client;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    if (!base) {
      this.logger.warn('S3_PUBLIC_BASE_URL is not set — stored URLs will not be readable');
      return key;
    }
    return `${base}/${key}`;
  }
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export function storageProviderFactory(): StorageProvider {
  return process.env.STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
}
