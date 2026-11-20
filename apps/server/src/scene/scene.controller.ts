import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SceneService } from './scene.service';
import { CurrentClaims, UserGuard } from '../auth/auth.guards';
import { ok } from '../common/response';
import { PrismaService } from '../prisma/prisma.service';

class ActionDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  command!: string;

  @IsObject()
  params!: Record<string, unknown>;

  @IsOptional()
  delayMs?: number;
}

class TriggerDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

class CreateSceneDto {
  @IsString()
  @IsNotEmpty()
  homeId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TriggerDto)
  triggers?: TriggerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];
}

class RunSceneDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@Controller('scenes')
@UserGuard()
export class SceneController {
  constructor(
    private scene: SceneService,
    private prisma: PrismaService,
  ) {}

  private async homeIdsOf(userId: string): Promise<string[]> {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId },
      include: { family: { include: { homes: true } } },
    });
    return memberships.flatMap((m) => m.family.homes.map((h) => h.id));
  }

  @Get()
  async list(@CurrentClaims() claims: { sub: string }) {
    const homeIds = await this.homeIdsOf(claims.sub);
    return ok(await this.scene.listScenes(homeIds));
  }

  @Post()
  async create(@CurrentClaims() claims: { sub: string }, @Body() dto: CreateSceneDto) {
    return ok(
      await this.scene.createScene(claims.sub, {
        homeId: dto.homeId,
        name: dto.name,
        cover: dto.cover,
        triggers: dto.triggers,
        actions: dto.actions,
      }),
    );
  }

  @Get(':id')
  async detail(@CurrentClaims() claims: { sub: string }, @Param('id') id: string) {
    const homeIds = await this.homeIdsOf(claims.sub);
    return ok(await this.scene.getScene(id, homeIds));
  }

  @Post(':id/run')
  async run(@CurrentClaims() claims: { sub: string }, @Param('id') id: string, @Body() dto: RunSceneDto) {
    return ok(await this.scene.runScene(id, claims.sub, dto.idempotencyKey));
  }

  @Get(':id/runs')
  async runs(@Param('id') id: string) {
    return ok(await this.scene.getRuns(id));
  }

  @Delete(':id')
  async remove(@CurrentClaims() claims: { sub: string }, @Param('id') id: string) {
    await this.scene.deleteScene(id, claims.sub);
    return ok({ success: true });
  }
}
