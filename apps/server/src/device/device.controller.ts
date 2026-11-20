import { Body, Controller, Get, Param, Patch, Post, Query, Req, Delete } from '@nestjs/common';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DeviceService } from './device.service';
import { CurrentClaims, UserGuard, Public } from '../auth/auth.guards';
import { ok } from '../common/response';
import { ApiError } from '@smart-home/shared';

class CommandDto {
  @IsString()
  @IsNotEmpty()
  capability!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  params!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  cmdId?: string;
}

class ProvisionDto {
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @IsOptional()
  @IsString()
  familyId?: string;

  @IsOptional()
  @IsString()
  modelCode?: string;
}

class BindDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsString()
  homeId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  modelCode?: string;
}

class PatchDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}

@Controller('devices')
@UserGuard()
export class DeviceController {
  constructor(private device: DeviceService) {}

  @Get()
  async list(@CurrentClaims() claims: { sub: string }, @Query('homeId') homeId?: string) {
    return ok(await this.device.listDevices(claims.sub, homeId));
  }

  @Get('models')
  async models(@Query('status') status?: string, @Query('category') category?: string) {
    return ok(await this.device.listModels({ status, category }));
  }

  @Get('models/:id')
  async model(@Param('id') id: string) {
    return ok(await this.device.getModel(id));
  }

  @Get(':id')
  async detail(@CurrentClaims() claims: { sub: string }, @Param('id') id: string) {
    return ok(await this.device.getDevice(id, claims.sub));
  }

  @Patch(':id')
  async patch(
    @CurrentClaims() claims: { sub: string },
    @Param('id') id: string,
    @Body() dto: PatchDeviceDto,
    @Req() req: any,
  ) {
    return ok(await this.device.patchDevice(id, claims.sub, dto, req.ip));
  }

  @Delete(':id/bind')
  async unbind(@CurrentClaims() claims: { sub: string }, @Param('id') id: string, @Req() req: any) {
    await this.device.unbind(id, claims.sub, req.ip);
    return ok({ success: true });
  }

  @Post(':id/commands')
  async command(
    @CurrentClaims() claims: { sub: string },
    @Param('id') id: string,
    @Body() dto: CommandDto,
  ) {
    return ok(
      await this.device.sendCommand({
        deviceId: id,
        userId: claims.sub,
        cmdId: dto.cmdId,
        capability: dto.capability,
        name: dto.name,
        cmdParams: dto.params,
      }),
    );
  }

  @Get(':id/telemetry')
  async telemetry(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return ok(await this.device.getTelemetry(id, from, to, limit ? Number(limit) : 200));
  }
}

@Controller('provisioning')
@UserGuard()
export class ProvisioningController {
  constructor(private device: DeviceService) {}

  @Post('sessions')
  async createSession(
    @CurrentClaims() claims: { sub: string },
    @Body() dto: ProvisionDto,
  ) {
    if (!dto.familyId) {
      // 取第一个家庭
      // 由 service 内部解析
    }
    return ok(
      await this.device.createProvisioningSession(claims.sub, dto.familyId ?? '', dto.serial, dto.modelCode),
    );
  }

  @Post('sessions/:id/bind')
  async bind(
    @CurrentClaims() claims: { sub: string },
    @Param('id') id: string,
    @Body() dto: BindDto,
    @Req() req: any,
  ) {
    if (!dto.token) throw new ApiError('PROVISION_TOKEN_INVALID', 'token required');
    return ok(
      await this.device.bindDevice({
        sessionId: id,
        token: dto.token,
        userId: claims.sub,
        homeId: dto.homeId,
        roomId: dto.roomId,
        name: dto.name,
        modelCode: dto.modelCode,
        ip: req.ip,
      }),
    );
  }
}
