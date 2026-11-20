import { Body, Controller, Get, Param, Post, Req, Patch, Delete } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiError, FamilyRole, familyCan } from '@smart-home/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentClaims, UserGuard } from '../auth/auth.guards';
import { ok } from '../common/response';
import { randomBytes } from 'node:crypto';

class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class InviteDto {
  @IsOptional()
  @IsString()
  expiresInMin?: string;
}

class JoinDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

class HomeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;
}

class RoomDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

@Controller()
@UserGuard()
export class FamilyController {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  /** 当前用户家庭列表 */
  @Get('families')
  async listFamilies(@CurrentClaims() claims: { sub: string }) {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId: claims.sub },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });
    return ok(
      memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        role: m.role as FamilyRole,
        ownerId: m.family.ownerId,
        createdAt: m.family.createdAt.toISOString(),
      })),
    );
  }

  @Post('families')
  async createFamily(@CurrentClaims() claims: { sub: string }, @Body() dto: CreateFamilyDto, @Req() req: any) {
    const family = await this.prisma.family.create({
      data: {
        name: dto.name,
        ownerId: claims.sub,
        members: { create: { userId: claims.sub, role: 'owner' } },
      },
    });
    const home = await this.prisma.home.create({ data: { familyId: family.id, name: '我的家' } });
    await this.prisma.room.createMany({
      data: ['客厅', '主卧', '厨房'].map((n, i) => ({ homeId: home.id, name: n, sort: i })),
    });
    await this.auth.audit('user', claims.sub, 'family.create', 'family', family.id, undefined, family, req.ip);
    return ok({ id: family.id, name: family.name, role: 'owner' as FamilyRole, ownerId: family.ownerId });
  }

  /** 生成邀请码（owner/admin） */
  @Post('families/:id/invites')
  async createInvite(
    @CurrentClaims() claims: { sub: string },
    @Param('id') familyId: string,
    @Req() req: any,
  ) {
    const role = await this.memberRole(familyId, claims.sub);
    if (!familyCan(role, 'inviteMembers')) throw new ApiError('FORBIDDEN', 'cannot invite');
    const code = randomBytes(6).toString('hex').toUpperCase();
    const invite = await this.prisma.familyInvite.create({
      data: {
        familyId,
        code,
        createdBy: claims.sub,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    await this.auth.audit('user', claims.sub, 'family.invite', 'family', familyId, undefined, { code }, req.ip);
    return ok({ code, expiresAt: invite.expiresAt.toISOString() });
  }

  /** 加入家庭 */
  @Post('families/join')
  async join(@CurrentClaims() claims: { sub: string }, @Body() dto: JoinDto, @Req() req: any) {
    const invite = await this.prisma.familyInvite.findUnique({ where: { code: dto.code } });
    if (!invite || invite.expiresAt < new Date() || invite.usedAt) {
      throw new ApiError('VALIDATION_ERROR', '邀请码无效或已过期');
    }
    const existing = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: invite.familyId, userId: claims.sub } },
    });
    if (existing) throw new ApiError('CONFLICT', '已是家庭成员');
    await this.prisma.familyMember.create({
      data: { familyId: invite.familyId, userId: claims.sub, role: 'member' },
    });
    await this.prisma.familyInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedBy: claims.sub },
    });
    await this.auth.audit('user', claims.sub, 'family.join', 'family', invite.familyId, undefined, undefined, req.ip);
    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: invite.familyId } });
    return ok({ id: family.id, name: family.name, role: 'member' as FamilyRole, ownerId: family.ownerId });
  }

  @Get('families/:id/members')
  async listMembers(@CurrentClaims() claims: { sub: string }, @Param('id') familyId: string) {
    await this.memberRole(familyId, claims.sub); // 校验成员身份
    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
    return ok(
      members.map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        avatar: m.user.avatar ?? undefined,
        role: m.role as FamilyRole,
        joinedAt: m.joinedAt.toISOString(),
      })),
    );
  }

  /** 移除成员（仅 owner） */
  @Delete('families/:id/members/:userId')
  async removeMember(
    @CurrentClaims() claims: { sub: string },
    @Param('id') familyId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const role = await this.memberRole(familyId, claims.sub);
    if (!familyCan(role, 'removeMembers')) throw new ApiError('FORBIDDEN', 'owner only');
    if (userId === claims.sub) throw new ApiError('VALIDATION_ERROR', '不能移除自己');
    await this.prisma.familyMember.deleteMany({ where: { familyId, userId } });
    await this.auth.audit('user', claims.sub, 'family.member.remove', 'family', familyId, undefined, { userId }, req.ip);
    return ok({ success: true });
  }

  /** 住宅 */
  @Get('homes')
  async listHomes(@CurrentClaims() claims: { sub: string }, @Req() req: any) {
    const familyIds = await this.myFamilyIds(claims.sub);
    const homes = await this.prisma.home.findMany({
      where: { familyId: { in: familyIds } },
      include: { rooms: { orderBy: { sort: 'asc' } } },
    });
    return ok(
      homes.map((h) => ({
        id: h.id,
        familyId: h.familyId,
        name: h.name,
        address: h.address ?? undefined,
        rooms: h.rooms.map((r) => ({ id: r.id, homeId: r.id, name: r.name, sort: r.sort })),
      })),
    );
  }

  @Post('homes')
  async createHome(@CurrentClaims() claims: { sub: string }, @Body() dto: HomeDto) {
    const familyId = (await this.myFamilyIds(claims.sub))[0];
    if (!familyId) throw new ApiError('FAMILY_NOT_FOUND', 'no family');
    const role = await this.memberRole(familyId, claims.sub);
    if (!familyCan(role, 'manageDevices')) throw new ApiError('FORBIDDEN', 'cannot create home');
    const home = await this.prisma.home.create({
      data: { familyId, name: dto.name, address: dto.address },
    });
    return ok({ id: home.id, familyId, name: home.name });
  }

  @Get('homes/:id/rooms')
  async listRooms(@CurrentClaims() claims: { sub: string }, @Param('id') homeId: string) {
    await this.assertHomeAccess(homeId, claims.sub);
    const rooms = await this.prisma.room.findMany({
      where: { homeId },
      orderBy: { sort: 'asc' },
    });
    return ok(rooms.map((r) => ({ id: r.id, homeId, name: r.name, sort: r.sort })));
  }

  @Post('homes/:id/rooms')
  async createRoom(
    @CurrentClaims() claims: { sub: string },
    @Param('id') homeId: string,
    @Body() dto: RoomDto,
  ) {
    const home = await this.assertHomeAccess(homeId, claims.sub);
    const role = await this.memberRole(home.familyId, claims.sub);
    if (!familyCan(role, 'manageDevices')) throw new ApiError('FORBIDDEN', 'cannot create room');
    const count = await this.prisma.room.count({ where: { homeId } });
    const room = await this.prisma.room.create({
      data: { homeId, name: dto.name, sort: count },
    });
    return ok({ id: room.id, homeId, name: room.name, sort: room.sort });
  }

  // ---- helpers ----

  private async myFamilyIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.familyMember.findMany({ where: { userId }, select: { familyId: true } });
    return rows.map((r) => r.familyId);
  }

  private async memberRole(familyId: string, userId: string): Promise<FamilyRole> {
    const m = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!m) throw new ApiError('FAMILY_NOT_FOUND', 'not a member');
    return m.role as FamilyRole;
  }

  private async assertHomeAccess(homeId: string, userId: string) {
    const home = await this.prisma.home.findUnique({ where: { id: homeId } });
    if (!home) throw new ApiError('FAMILY_NOT_FOUND', 'home not found');
    await this.memberRole(home.familyId, userId);
    return home;
  }
}
