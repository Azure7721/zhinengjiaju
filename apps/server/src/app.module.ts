import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { FamilyModule } from './family/family.module';
import { DeviceModule } from './device/device.module';
import { SceneModule } from './scene/scene.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
import { WsModule } from './ws/ws.module';
import { MqttModule } from './mqtt/mqtt.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    FamilyModule,
    DeviceModule,
    SceneModule,
    AdminModule,
    NotificationModule,
    WsModule,
    MqttModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
