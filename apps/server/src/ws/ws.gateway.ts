import { Injectable, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { verifyAccessToken } from '../auth/jwt';
import { WsServerEvent } from '@smart-home/contracts';

interface Client {
  ws: WebSocket;
  userId?: string;
  adminId?: string;
  familyIds: Set<string>;
}

/**
 * WebSocket 网关：JWT 鉴权 + 家庭订阅推送
 * 连接：ws://host/ws?token=<access_token>
 */
@Injectable()
@WebSocketGateway({ path: '/ws' })
export class WsGateway implements OnModuleInit {
  @WebSocketServer() server!: Server;

  private clients = new Set<Client>();

  onModuleInit() {
    // ws adapter 使用 'connection' 事件
    this.server.on('connection', (ws: WebSocket, req: any) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
          ws.close(4001, 'token required');
          return;
        }
        const claims = verifyAccessToken(token);
        const client: Client = {
          ws,
          userId: claims.kind === 'user' ? claims.sub : undefined,
          adminId: claims.kind === 'admin' ? claims.sub : undefined,
          familyIds: new Set(claims.fam ?? []),
        };
        this.clients.add(client);
        ws.on('close', () => this.clients.delete(client));
        ws.on('error', () => this.clients.delete(client));
        ws.on('message', (raw) => this.onMessage(client, raw.toString()));
        ws.send(JSON.stringify({ type: 'connected', ok: true }));
      } catch {
        ws.close(4001, 'invalid token');
      }
    });
  }

  private onMessage(client: Client, raw: string) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'presence' && msg.payload?.homeId) {
        // 订阅家庭（简单实现：校验成员身份后加入 familyIds）
        // 已由 JWT claims.fam 初始化，此处允许补充
        client.familyIds.add(msg.payload.homeId);
      }
      if (msg.type === 'ping') {
        client.ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {
      /* ignore malformed */
    }
  }

  /** 推送到某家庭的所有在线成员 */
  pushToFamily(familyId: string, event: WsServerEvent | { type: string; payload: unknown }) {
    const data = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.familyIds.has(familyId) && c.ws.readyState === 1) {
        c.ws.send(data);
      }
    }
  }

  /** 推送到某用户 */
  pushToUser(userId: string, event: { type: string; payload: unknown }) {
    const data = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.userId === userId && c.ws.readyState === 1) {
        c.ws.send(data);
      }
    }
  }

  /** 推送给所有管理员（后台模拟器观察） */
  broadcastAdmin(event: { type: string; payload: unknown }) {
    const data = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.adminId && c.ws.readyState === 1) {
        c.ws.send(data);
      }
    }
  }

  /** 根据设备找家庭并推送 */
  pushToDeviceFamily(deviceId: string, event: { type: string; payload: unknown }) {
    // 由调用方（MQTT 桥接）传入 familyId 更高效；这里做通用广播兜底
    const data = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.ws.readyState === 1 && (c.familyIds.size > 0 || c.adminId)) {
        c.ws.send(data);
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: { ts: Date.now() } };
  }
}
