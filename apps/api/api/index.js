/**
 * Vercel serverless entry point for the ShopCraft API.
 *
 * Routing: vercel.json rewrites /api/* to this single function. Vercel's
 * non-Next function router treats api/[...path].js as ONE dynamic segment
 * (so /api/a matched but /api/a/b 404'd), which is why an explicit rewrite is
 * used instead of filesystem routing.
 *
 * Loading: this requires the PRE-COMPILED ../dist rather than the TypeScript
 * sources. Vercel bundles functions with esbuild, which ignores
 * `emitDecoratorMetadata` — NestJS needs that metadata for dependency
 * injection, so bundling from src would break every provider at runtime.
 *
 * All requires are inside bootstrap() on purpose: a throw at module scope
 * produces an opaque FUNCTION_INVOCATION_FAILED with no detail, whereas this
 * way the real error reaches the response.
 */

let cached = null;
let bootstrapError = null;

async function bootstrap() {
  if (cached) return cached;
  if (bootstrapError) throw bootstrapError;

  require('reflect-metadata');
  const express = require('express');
  const helmet = require('helmet');
  const cookieParser = require('cookie-parser');
  const { NestFactory } = require('@nestjs/core');
  const { ExpressAdapter } = require('@nestjs/platform-express');
  const { AppModule } = require('../dist/app.module');

  const expressApp = express();

  // Preserve the raw body so payment webhook HMAC verification still works.
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
  // live in object storage (STORAGE_PROVIDER=s3).

  await app.init();
  cached = expressApp;
  return cached;
}

module.exports = async (req, res) => {
  try {
    const server = await bootstrap();
    return server(req, res);
  } catch (err) {
    bootstrapError = err;
    console.error('API bootstrap failed:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    // Detail is returned because a cold-start failure is otherwise invisible
    // without Vercel log access. Remove before handling real customer traffic.
    res.end(
      JSON.stringify({
        message: 'API failed to start',
        error: err && err.message,
        code: err && err.code,
        url: req.url,
        stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8) : undefined,
      }),
    );
  }
};
