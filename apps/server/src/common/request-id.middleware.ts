import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    next();
  }
}
