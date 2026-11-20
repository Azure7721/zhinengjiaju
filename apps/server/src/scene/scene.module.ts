import { Module } from '@nestjs/common';
import { SceneService } from './scene.service';
import { SceneController } from './scene.controller';
import { DeviceModule } from '../device/device.module';
import { WsModule } from '../ws/ws.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DeviceModule, WsModule, AuthModule],
  controllers: [SceneController],
  providers: [SceneService],
  exports: [SceneService],
})
export class SceneModule {}
