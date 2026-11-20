import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public, CurrentClaims, UserGuard, AuthRequest } from './auth.guards';
import { ok } from '../common/response';

class WechatLoginDto {
  @IsString()
  code!: string;
}

class MockLoginDto {
  @IsString()
  @MinLength(1)
  nickname!: string;

  @IsOptional()
  @IsString()
  mockOpenId?: string;
}

class AdminLoginDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('wechat/login')
  async wechatLogin(@Body() dto: WechatLoginDto) {
    return ok(await this.auth.wechatLogin(dto.code));
  }

  @Public()
  @Post('wechat/mock')
  async mockLogin(@Body() dto: MockLoginDto) {
    return ok(await this.auth.mockLogin(dto.nickname, dto.mockOpenId));
  }

  @Public()
  @Post('admin/login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    return ok(await this.auth.adminLogin(dto.email, dto.password));
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return ok(await this.auth.refresh(dto.refreshToken));
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return ok({ success: true });
  }

  @UserGuard()
  @Get('me')
  async me(@CurrentClaims() claims: { sub: string }) {
    return ok(await this.auth.me(claims.sub));
  }
}
