/**
 * Aedes MQTT broker（TCP 1883 + WS 8888）
 * P0 兜底方案：无需 Docker/Mosquitto（docs/00 · 环境三级降级）
 */
import { createServer } from 'node:http';
import Aedes from 'aedes';
import { WebSocketServer } from 'ws';
import { createServer as createNetServer } from 'node:net';

const aedes = new Aedes();
const tcpPort = Number(process.env.MQTT_PORT ?? 1883);
const wsPort = Number(process.env.MQTT_WS_PORT ?? 8888);

const tcpServer = createNetServer(aedes.handle);
tcpServer.listen(tcpPort, () => {
  console.log(`[mqtt] TCP broker on 0.0.0.0:${tcpPort}`);
});

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, path: '/mqtt' });
wss.on('connection', (socket) => {
  const stream = aedes.createConnectionStream();
  socket.pipe(stream as any).pipe(socket as any);
});
httpServer.listen(wsPort, () => {
  console.log(`[mqtt] WS broker on ws://127.0.0.1:${wsPort}/mqtt`);
});

aedes.on('client', (c) => console.log(`[mqtt] client connected: ${c.id}`));
aedes.on('clientDisconnect', (c) => console.log(`[mqtt] client disconnected: ${c.id}`));
aedes.on('publish', (packet, client) => {
  if (client && packet.topic.startsWith('device/')) {
    // 可选：调试日志
  }
});

process.on('SIGINT', () => {
  aedes.close(() => {
    tcpServer.close();
    httpServer.close();
    process.exit(0);
  });
});
