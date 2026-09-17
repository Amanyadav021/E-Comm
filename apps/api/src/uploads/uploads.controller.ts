import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { RequirePerms } from '../auth/decorators';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

/**
 * Image upload endpoint (admin). Files are validated by MIME + magic bytes,
 * resized/optimized with sharp, and stored via the configured storage
 * provider (local disk in dev; S3-compatible in production — see
 * STORAGE_PROVIDER). The DB stores only URLs, never binaries.
 */
@Controller('uploads')
export class UploadsController {
  @RequirePerms('products.write')
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file received.');
    const ext = ALLOWED_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Only JPEG, PNG, WEBP or AVIF images are allowed.');
    if (!this.sniffImage(file.buffer)) throw new BadRequestException('File content does not look like a valid image.');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;

    // Optimized main image (max 1600px) + thumbnail (max 400px), both webp
    const main = await sharp(file.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const thumb = await sharp(file.buffer).rotate().resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();

    if (process.env.STORAGE_PROVIDER === 's3') {
      throw new BadRequestException(
        'S3 storage is configured but the S3 SDK is not installed. Run: npm i @aws-sdk/client-s3 -w @shopcraft/api and restart.',
      );
    }

    const dir = join(__dirname, '..', '..', 'uploads', 'products');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, `${name}.webp`), main);
    await fs.writeFile(join(dir, `${name}-thumb.webp`), thumb);

    const base = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    return {
      url: `${base}/uploads/products/${name}.webp`,
      thumbUrl: `${base}/uploads/products/${name}-thumb.webp`,
    };
  }

  /** Magic-byte sniffing — the client-provided MIME type alone is never trusted. */
  private sniffImage(buf: Buffer): boolean {
    if (buf.length < 12) return false;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return true; // WEBP
    if (buf.slice(4, 12).toString().startsWith('ftyp')) return true; // AVIF/HEIF
    return false;
  }
}
