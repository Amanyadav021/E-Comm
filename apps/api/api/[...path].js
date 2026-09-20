/**
 * Vercel serverless entry point for the ShopCraft API.
 *
 * This deliberately requires the PRE-COMPILED ../dist build rather than the
 * TypeScript sources. Vercel compiles functions with esbuild, which does not
 * support `emitDecoratorMetadata` — NestJS depends on that metadata for
 * dependency injection, so bundling from src would break every @Injectable at
 * runtime. `nest build` (tsc) runs first and emits the metadata correctly.
 *
 * The Nest app is cached across invocations so warm requests skip bootstrap.
 */
require('reflect-metadata');

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/app.module');

let cached = null;

async function bootstrap() {
  if (cached) return cached;

  const expressApp = express();

  // Keep the raw body so payment webhook HMAC verification still works.
  expressApp.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn'],
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  app.setGlobalPrefix('api');

  // No useStaticAssets: a serverless filesystem is ephemeral, and images now
  // live in object storage (see STORAGE_PROVIDER=s3).

  await app.init();
  cached = expressApp;
  return cached;
}

module.exports = async (req, res) => {
  try {
    const server = await bootstrap();
    return server(req, res);
  } catch (err) {
    // Surfaced in the response because a cold-start failure is otherwise
    // invisible without Vercel log access. Safe for this demo deployment;
    // drop the detail before handling real customer traffic.
    console.error('API bootstrap failed:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        message: 'API failed to start',
        error: err && err.message,
        code: err && err.code,
        stack: err && err.stack ? String(err.stack).split('
').slice(0, 6) : undefined,
      }),
    );
  }
};
