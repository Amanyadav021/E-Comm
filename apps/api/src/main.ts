import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationError } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for payment webhook signature verification
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images to be embedded by the storefront
    }),
  );
  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3100')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix('api');

  // Dev-local file storage: uploaded product images served from /uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    maxAge: '7d',
  });

  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`ShopCraft API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
