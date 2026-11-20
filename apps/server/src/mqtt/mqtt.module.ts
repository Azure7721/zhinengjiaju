import { Module, forwardRef } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DeviceModule } from '../device/device.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [forwardRef(() => DeviceModule), WsModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
