/**
 * 虚拟 BLE WebSocket 服务（docs/04 · 5 / docs/08 · 2.3）
 * 用 WS 模拟 GATT 语义：scan/connect/discover/read/write/notify
 * 端口 7001，路径 /virtual-ble
 * 4 标准设备 + 1 未知能力设备（验证降级）
 */
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { BLE_UUIDS, VirtualBleMessage } from '@smart-home/contracts';

interface VirtualDevice {
  deviceId: string;
  name: string;
  modelCode: string;
  category: string;
  firmware: string;
  capabilities: string[];
  state: Record<string, unknown>;
}

const TEMPLATES: VirtualDevice[] = [
  {
    deviceId: 'vble-ac-001',
    name: 'Smart AC',
    modelCode: 'ac.dual.v1',
    category: 'climate',
    firmware: '1.0.0',
    capabilities: ['switch', 'temperature', 'mode', 'fanSpeed'],
    state: { power: false, targetTemp: 26, mode: 'cool', fanSpeed: 'mid' },
  },
  {
    deviceId: 'vble-curtain-001',
    name: 'Smart Curtain',
    modelCode: 'curtain.v1',
    category: 'cover',
    firmware: '1.0.0',
    capabilities: ['switch', 'position', 'mode'],
    state: { power: true, position: 50, mode: 'pause' },
  },
  {
    deviceId: 'vble-tv-001',
    name: 'Smart TV',
    modelCode: 'tv.smart.v1',
    category: 'tv',
    firmware: '2.1.0',
    capabilities: ['switch', 'remote', 'brightness'],
    state: { power: false, brightness: 60, lastKey: '' },
  },
  {
    deviceId: 'vble-purifier-001',
    name: 'Air Purifier',
    modelCode: 'purifier.v1',
    category: 'purifier',
    firmware: '1.3.0',
    capabilities: ['switch', 'mode', 'pm25', 'fanSpeed'],
    state: { power: true, mode: 'auto', pm25: 32, fanSpeed: 'low' },
  },
  {
    deviceId: 'vble-mystery-001',
    name: 'Mystery Box',
    modelCode: 'mystery.box.v1',
    category: 'other',
    firmware: '0.0.1',
    capabilities: ['switch', 'fluxLevel', 'wibbleMode'],
    state: { power: true, fluxLevel: 42, wibbleMode: 'a' },
  },
];

interface Session {
  ws: WebSocket;
  connected?: VirtualDevice;
  subscribedNotify: Set<string>;
}

const SERVICE_UUID = BLE_UUIDS.service;

function characteristics() {
  return [
    { uuid: BLE_UUIDS.deviceInfo, properties: ['read'] },
    { uuid: BLE_UUIDS.provision, properties: ['write'] },
    { uuid: BLE_UUIDS.command, properties: ['write'] },
    { uuid: BLE_UUIDS.telemetry, properties: ['notify'] },
    { uuid: BLE_UUIDS.ack, properties: ['notify'] },
  ];
}

function send(ws: WebSocket, msg: VirtualBleMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function startVirtualBle() {
  const port = Number(process.env.VIRTUAL_BLE_PORT ?? 7001);
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer, path: '/virtual-ble' });

  wss.on('connection', (ws) => {
    const session: Session = { ws, subscribedNotify: new Set() };

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', code: 'BAD_JSON', message: 'invalid json' });
        return;
      }
      handle(session, msg);
    });

    ws.on('close', () => {
      session.connected = undefined;
    });
  });

  httpServer.listen(port, () => {
    console.log(`[virtual-ble] ws://127.0.0.1:${port}/virtual-ble (${TEMPLATES.length} devices)`);
  });

  // 周期 notify 已订阅的 telemetry（模拟 FFF4 推送）
  setInterval(() => {
    for (const client of wss.clients) {
      const s = (client as any).__session as Session | undefined;
      if (s?.connected && s.subscribedNotify.has(BLE_UUIDS.telemetry)) {
        const d = s.connected;
        // 简单随机游走
        if (typeof d.state.pm25 === 'number') {
          d.state.pm25 = Math.max(10, Math.min(120, (d.state.pm25 as number) + (Math.random() * 10 - 5)));
        }
        send(s.ws, {
          type: 'notify',
          characteristicId: BLE_UUIDS.telemetry,
          value: JSON.stringify({ deviceId: d.deviceId, ts: Date.now(), state: d.state }),
        });
      }
    }
  }, 3000);

  function handle(s: Session, msg: any) {
    const ws = s.ws;
    (ws as any).__session = s;

    switch (msg.type) {
      case 'scan.start': {
        send(ws, {
          type: 'scan.result',
          devices: TEMPLATES.map((d, i) => ({
            deviceId: d.deviceId,
            name: d.name,
            rssi: -40 - i * 5,
            serviceUUID: SERVICE_UUID,
          })),
        });
        break;
      }
      case 'connect': {
        const d = TEMPLATES.find((t) => t.deviceId === msg.deviceId);
        if (!d) {
          send(ws, { type: 'error', code: 'NOT_FOUND', message: 'device not found' });
          return;
        }
        s.connected = d;
        send(ws, { type: 'connected', deviceId: d.deviceId });
        break;
      }
      case 'discover': {
        send(ws, {
          type: 'services',
          services: [{ uuid: SERVICE_UUID, characteristics: characteristics() }],
        });
        break;
      }
      case 'read': {
        if (!s.connected) {
          send(ws, { type: 'error', code: 'NO_CONNECT', message: 'not connected' });
          return;
        }
        if (msg.characteristicId === BLE_UUIDS.deviceInfo) {
          const d = s.connected;
          send(ws, {
            type: 'value',
            serviceId: SERVICE_UUID,
            characteristicId: BLE_UUIDS.deviceInfo,
            value: JSON.stringify({
              deviceId: d.deviceId,
              model: d.modelCode,
              firmware: d.firmware,
              capabilities: d.capabilities,
            }),
          });
        } else {
          send(ws, {
            type: 'value',
            serviceId: SERVICE_UUID,
            characteristicId: msg.characteristicId,
            value: '',
          });
        }
        break;
      }
      case 'write': {
        if (!s.connected) {
          send(ws, { type: 'error', code: 'NO_CONNECT', message: 'not connected' });
          return;
        }
        handleWrite(s, msg);
        break;
      }
      case 'notify': {
        // client 订阅特征通知
        if (msg.state === true || msg.characteristicId) {
          s.subscribedNotify.add(msg.characteristicId);
        }
        break;
      }
      case 'disconnect': {
        s.connected = undefined;
        s.subscribedNotify.clear();
        send(ws, { type: 'disconnect', deviceId: msg.deviceId, reason: msg.reason ?? 'local' });
        break;
      }
      default:
        send(ws, { type: 'error', code: 'UNKNOWN', message: `unknown type ${msg.type}` });
    }
  }

  function handleWrite(s: Session, msg: any) {
    const ws = s.ws;
    const d = s.connected!;
    let payload: any = {};
    try {
      payload = typeof msg.value === 'string' ? JSON.parse(msg.value) : msg.value;
    } catch {
      payload = {};
    }

    if (msg.characteristicId === BLE_UUIDS.provision) {
      // 配网写入：校验 token 存在，模拟入网
      if (!payload.token) {
        send(ws, {
          type: 'notify',
          characteristicId: BLE_UUIDS.ack,
          value: JSON.stringify({ cmdId: 'provision', status: 'error', error: 'token required' }),
        });
        return;
      }
      // 未入网前不能连 broker（真实场景）；虚拟场景直接 ack 成功
      send(ws, {
        type: 'notify',
        characteristicId: BLE_UUIDS.ack,
        value: JSON.stringify({ cmdId: 'provision', status: 'ok', deviceId: d.deviceId }),
      });
      console.log(`[virtual-ble] provisioned ${d.deviceId} token=${String(payload.token).slice(0, 8)}…`);
      return;
    }

    if (msg.characteristicId === BLE_UUIDS.command) {
      // 应用命令到虚拟状态
      const name = payload.command ?? payload.name;
      const v = payload.params?.value ?? payload.value;
      switch (name) {
        case 'setPower':
          d.state.power = Boolean(v);
          break;
        case 'setTemperature':
          d.state.targetTemp = Number(v);
          break;
        case 'setMode':
          d.state.mode = String(v);
          break;
        case 'setPosition':
          d.state.position = Number(v);
          break;
        case 'setFanSpeed':
          d.state.fanSpeed = String(v);
          break;
        case 'setBrightness':
          d.state.brightness = Number(v);
          break;
        case 'sendKey':
          d.state.lastKey = String(v);
          break;
        case 'setFluxLevel':
          d.state.fluxLevel = Number(v);
          break;
        case 'setWibbleMode':
          d.state.wibbleMode = String(v);
          break;
        default:
          d.state[`last_${name}`] = v;
      }
      // ack (FFF5)
      send(ws, {
        type: 'notify',
        characteristicId: BLE_UUIDS.ack,
        value: JSON.stringify({ cmdId: payload.cmdId ?? 'unknown', status: 'ok' }),
      });
      // telemetry (FFF4)
      if (s.subscribedNotify.has(BLE_UUIDS.telemetry)) {
        send(ws, {
          type: 'notify',
          characteristicId: BLE_UUIDS.telemetry,
          value: JSON.stringify({ deviceId: d.deviceId, ts: Date.now(), state: d.state }),
        });
      }
      return;
    }

    send(ws, {
      type: 'notify',
      characteristicId: BLE_UUIDS.ack,
      value: JSON.stringify({ cmdId: payload.cmdId, status: 'error', error: 'unknown characteristic' }),
    });
  }
}

export { startVirtualBle };
