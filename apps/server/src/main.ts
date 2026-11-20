import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiError } from '@smart-home/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters({
    catch(exception: unknown, host: any) {
      const ctx = host.switchToHttp();
      const res = ctx.getResponse();
      const requestId = (ctx.getRequest() as any).requestId;
      if (exception instanceof ApiError) {
        res.status(exception.httpStatus).json({
          ok: false,
          error: { code: exception.code, message: exception.message, details: exception.details },
          requestId,
        });
        return;
      }
      // NestJS HttpException
      const anyEx = exception as any;
      const status = anyEx?.status ?? anyEx?.statusCode ?? 500;
      const message = anyEx?.response?.message ?? anyEx?.message ?? 'Internal error';
      const code =
        status === 401
          ? 'AUTH_REQUIRED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 409
                ? 'CONFLICT'
                : status === 422 || status === 400
                  ? 'VALIDATION_ERROR'
                  : status === 429
                    ? 'RATE_LIMITED'
                    : 'INTERNAL_ERROR';
      res.status(status).json({
        ok: false,
        error: { code, message: Array.isArray(message) ? message.join('; ') : message },
        requestId,
      });
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://127.0.0.1:${port}/api/v1`);
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
