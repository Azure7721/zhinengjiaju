import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { DeviceModule } from '../device/device.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [AuthModule, DeviceModule, WsModule],
  controllers: [AdminController],
})
export class AdminModule {}
