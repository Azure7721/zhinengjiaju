import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.guards';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { ok } from '../common/response';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private mqtt: MqttService,
  ) {}

  @Public()
  @Get()
  async health() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (e: any) {
      checks.database = { ok: false, detail: e.message };
    }
    checks.mqtt = { ok: this.mqtt.isReady, detail: this.mqtt.isReady ? 'connected' : 'memory mode' };
    const allOk = Object.values(checks).every((c) => c.ok);
    return {
      ok: true,
      data: { status: allOk ? 'healthy' : 'degraded', checks, ts: new Date().toISOString() },
    };
  }
}
