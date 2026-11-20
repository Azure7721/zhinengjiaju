import { Module, forwardRef } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController, ProvisioningController } from './device.controller';
import { AuthModule } from '../auth/auth.module';
import { WsModule } from '../ws/ws.module';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [AuthModule, WsModule, forwardRef(() => MqttModule)],
  controllers: [DeviceController, ProvisioningController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
