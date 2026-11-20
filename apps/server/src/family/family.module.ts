import { Module } from '@nestjs/common';
import { FamilyController } from './family.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FamilyController],
})
export class FamilyModule {}
