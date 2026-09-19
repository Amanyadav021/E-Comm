import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { RequirePerms } from '../auth/decorators';
import { STORAGE_PROVIDER, StorageProvider } from './storage.provider';

const ALLOWED_TYPES: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'image/avif': true,
};
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

/**
 * Image upload (admin only). Files are validated by MIME *and* magic bytes,
 * re-encoded to webp with sharp (which also strips EXIF and would fail on a
 * non-image), then handed to the configured storage provider. The database
 * only ever stores URLs, never binary.
 */
@Controller('uploads')
export class UploadsController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  @RequirePerms('products.write')
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file received.');
    if (!ALLOWED_TYPES[file.mimetype]) {
      throw new BadRequestException('Only JPEG, PNG, WEBP or AVIF images are allowed.');
    }
    if (!this.sniffImage(file.buffer)) {
      throw new BadRequestException('File content does not look like a valid image.');
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;

    let main: Buffer;
    let thumb: Buffer;
    try {
      main = await sharp(file.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
      thumb = await sharp(file.buffer).rotate().resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    } catch {
      throw new BadRequestException('That image could not be processed. Try a different file.');
    }

    const [url, thumbUrl] = await Promise.all([
      this.storage.put(`products/${name}.webp`, main, 'image/webp'),
      this.storage.put(`products/${name}-thumb.webp`, thumb, 'image/webp'),
    ]);
    return { url, thumbUrl };
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
