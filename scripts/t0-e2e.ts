/**
 * T0 单机全链路验收脚本（docs/08 · 测试矩阵 T0.1–T0.7 / docs/09）
 * 依赖：MQTT(1883) + server(3000) + device-engine(7001) 已启动
 * 运行：node --experimental-strip-types scripts/t0-e2e.ts
 * 退出码 0 = 全部通过
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000/api/v1';

interface Row {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}

const rows: Row[] = [];
let failures = 0;

function record(id: string, name: string, pass: boolean, detail: string) {
  rows.push({ id, name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} — ${detail}`);
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // T0.1 健康检查
  try {
    const h = await api('/health');
    const checks = h.json?.data?.checks ?? {};
    const allOk = Object.values(checks).every((c: any) => c.ok);
    record('T0.1', '一键启动健康检查', h.status === 200 && allOk, JSON.stringify(checks));
  } catch (e: any) {
    record('T0.1', '一键启动健康检查', false, e.message);
    summary();
    process.exit(1);
  }

  // 登录
  const login = await api('/auth/wechat/mock', {
    method: 'POST',
    body: { nickname: 'userA', mockOpenId: 'mock_userA' },
  });
  const token = login.json?.data?.accessToken;
  if (!token) {
    record('T0.0', 'mock 登录', false, JSON.stringify(login.json));
    summary();
    process.exit(1);
  }
  record('T0.0', 'mock 登录', true, 'token issued');

  // 设备列表
  const devices = await api('/devices', { token });
  const list = devices.json?.data ?? [];
  record('T0.2a', '设备列表', devices.status === 200 && list.length >= 5, `${list.length} devices`);

  const ac = list.find((d: any) => d.serialNo === 'DEMO-AC-001');
  if (!ac) {
    record('T0.2b', '演示设备存在', false, 'DEMO-AC-001 not found');
    summary();
    process.exit(1);
  }
  record('T0.2b', '演示设备存在', true, ac.name);

  // 在线状态（引擎 presence/state）
  const online = ac.state?.online === true;
  record('T0.2c', '设备在线(state)', online, `online=${online}`);

  // T0.5 命令 + ack（1s 内语义：等 3s 内到终态）
  const cmdId = `t0-${Date.now()}`;
  const cmd = await api(`/devices/${ac.id}/commands`, {
    method: 'POST',
    token,
    body: { capability: 'temperature', name: 'setTemperature', params: { value: 25 }, cmdId },
  });
  const sent = cmd.json?.data?.status;
  record('T0.5a', '命令下发', cmd.status < 300 && ['sent', 'acked'].includes(sent), `status=${sent}`);

  let acked = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const again = await api(`/devices/${ac.id}/commands`, {
      method: 'POST',
      token,
      body: { capability: 'temperature', name: 'setTemperature', params: { value: 25 }, cmdId },
    });
    if (again.json?.data?.status === 'acked') {
      acked = true;
      break;
    }
    // 用查询方式：重复 POST 幂等返回同一条
  }
  record('T0.5b', '命令 ack（幂等重放）', acked, acked ? 'acked' : 'timeout waiting ack');

  // 幂等：同 cmdId 不产生新命令
  const dup = await api(`/devices/${ac.id}/commands`, {
    method: 'POST',
    token,
    body: { capability: 'temperature', name: 'setTemperature', params: { value: 25 }, cmdId },
  });
  const sameCmd = dup.json?.data?.cmdId === cmdId;
  record('T0.5c', 'cmdId 幂等', sameCmd, `cmdId=${dup.json?.data?.cmdId}`);

  // T0.4 遥测
  await new Promise((r) => setTimeout(r, 6000));
  const tel = await api(`/devices/${ac.id}/telemetry?limit=5`, { token });
  const points = tel.json?.data ?? [];
  record('T0.4', '遥测落库', points.length > 0, `${points.length} points`);

  // T0.3 绑定落库（归属校验）
  const detail = await api(`/devices/${ac.id}`, { token });
  const bound = detail.json?.data?.boundAt;
  record('T0.3', '绑定归属', Boolean(bound), `boundAt=${bound}`);

  // T0.6 场景执行
  const scenes = await api('/scenes', { token });
  const scene = (scenes.json?.data ?? []).find((s: any) => s.name === '观影模式');
  if (!scene) {
    record('T0.6', '场景执行', false, '观影模式 not found');
  } else {
    const run = await api(`/scenes/${scene.id}/run`, { method: 'POST', token, body: {} });
    const runId = run.json?.data?.id;
    record('T0.6a', '场景 run 创建', Boolean(runId), `runId=${runId}`);
    let finalStatus = '';
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const runs = await api(`/scenes/${scene.id}/runs`, { token });
      const r0 = (runs.json?.data ?? []).find((r: any) => r.id === runId);
      if (r0 && ['success', 'partial', 'failed'].includes(r0.status)) {
        finalStatus = r0.status;
        break;
      }
    }
    record('T0.6b', '场景终态', ['success', 'partial'].includes(finalStatus), `status=${finalStatus}`);
  }

  // T0.7 管理员日志可见
  const admin = await api('/auth/admin/login', {
    method: 'POST',
    body: { email: 'root@smart.local', password: 'Admin@123456' },
  });
  const adminToken = admin.json?.data?.accessToken;
  if (adminToken) {
    const logs = await api('/admin/logs/commands?pageSize=5', { token: adminToken });
    record('T0.7', '后台命令日志', logs.status === 200, `${logs.json?.data?.total ?? 0} total`);
    const dash = await api('/admin/dashboard', { token: adminToken });
    record('T0.8', '后台仪表盘', dash.status === 200, JSON.stringify(dash.json?.data ?? {}).slice(0, 120));
  } else {
    record('T0.7', '后台命令日志', false, 'admin login failed');
    record('T0.8', '后台仪表盘', false, 'admin login failed');
  }

  summary();
  process.exit(failures === 0 ? 0 : 1);
}

function summary() {
  const pass = rows.filter((r) => r.pass).length;
  console.log(`\n=== T0 Summary: ${pass}/${rows.length} passed ===\n`);
  for (const r of rows.filter((r) => !r.pass)) {
    console.log(`  FAIL ${r.id} ${r.name}: ${r.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
