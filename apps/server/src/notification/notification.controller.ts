import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentClaims, UserGuard } from '../auth/auth.guards';
import { ok } from '../common/response';

@Controller('notifications')
@UserGuard()
export class NotificationController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@CurrentClaims() claims: { sub: string }, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = { userId: claims.sub };
    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    return ok({
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Post('read')
  async markRead(@CurrentClaims() claims: { sub: string }, @Body() body: { ids?: string[] }) {
    await this.prisma.notification.updateMany({
      where: { userId: claims.sub, ...(body.ids?.length ? { id: { in: body.ids } } : {}) },
      data: { read: true },
    });
    return ok({ success: true });
  }
}
