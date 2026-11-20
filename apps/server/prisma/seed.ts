/**
 * 种子数据（docs/08 · 10 测试数据）：
 * - 2 用户、2 家庭、4 类设备型号 + 1 未知能力型号
 * - admin 四角色
 * - 演示场景（观影/清洁）
 * 密码仅用于本地。
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MODELS = [
  {
    code: 'ac.dual.v1',
    name: '双模空调',
    category: 'climate',
    metadata: {
      model: 'ac.dual.v1',
      name: '双模空调',
      category: 'climate',
      capabilities: [
        { key: 'switch', type: 'boolean', control: 'switch', label: '电源' },
        { key: 'temperature', type: 'number', min: 16, max: 30, unit: '℃', control: 'dial', label: '温度' },
        { key: 'mode', type: 'enum', values: ['cool', 'heat', 'auto'], control: 'segmented', label: '模式' },
        { key: 'fanSpeed', type: 'enum', values: ['low', 'mid', 'high'], control: 'segmented', label: '风速' },
      ],
      commands: [
        { name: 'setPower', params: { value: 'boolean' } },
        { name: 'setTemperature', params: { value: 'number' } },
        { name: 'setMode', params: { value: 'string' } },
        { name: 'setFanSpeed', params: { value: 'string' } },
      ],
    },
  },
  {
    code: 'curtain.v1',
    name: '智能窗帘',
    category: 'cover',
    metadata: {
      model: 'curtain.v1',
      name: '智能窗帘',
      category: 'cover',
      capabilities: [
        { key: 'switch', type: 'boolean', control: 'switch', label: '电源' },
        { key: 'position', type: 'number', min: 0, max: 100, unit: '%', control: 'slider', label: '开合度' },
        { key: 'mode', type: 'enum', values: ['open', 'pause', 'close'], control: 'segmented', label: '模式' },
      ],
      commands: [
        { name: 'setPower', params: { value: 'boolean' } },
        { name: 'setPosition', params: { value: 'number' } },
        { name: 'setMode', params: { value: 'string' } },
      ],
    },
  },
  {
    code: 'tv.smart.v1',
    name: '智能电视',
    category: 'tv',
    metadata: {
      model: 'tv.smart.v1',
      name: '智能电视',
      category: 'tv',
      capabilities: [
        { key: 'switch', type: 'boolean', control: 'switch', label: '电源' },
        { key: 'remote', type: 'string', control: 'remote', label: '遥控' },
        { key: 'brightness', type: 'number', min: 0, max: 100, control: 'slider', label: '亮度' },
      ],
      commands: [
        { name: 'setPower', params: { value: 'boolean' } },
        { name: 'sendKey', params: { value: 'string' } },
        { name: 'setBrightness', params: { value: 'number' } },
      ],
    },
  },
  {
    code: 'purifier.v1',
    name: '空气净化器',
    category: 'purifier',
    metadata: {
      model: 'purifier.v1',
      name: '空气净化器',
      category: 'purifier',
      capabilities: [
        { key: 'switch', type: 'boolean', control: 'switch', label: '电源' },
        { key: 'mode', type: 'enum', values: ['auto', 'sleep', 'turbo'], control: 'segmented', label: '模式' },
        { key: 'pm25', type: 'number', control: 'panel', readonly: true, label: 'PM2.5' },
        { key: 'fanSpeed', type: 'enum', values: ['low', 'mid', 'high'], control: 'segmented', label: '风速' },
      ],
      commands: [
        { name: 'setPower', params: { value: 'boolean' } },
        { name: 'setMode', params: { value: 'string' } },
        { name: 'setFanSpeed', params: { value: 'string' } },
      ],
    },
  },
  {
    code: 'mystery.box.v1',
    name: '神秘盒子（未知能力验证）',
    category: 'other',
    metadata: {
      model: 'mystery.box.v1',
      name: '神秘盒子',
      category: 'other',
      capabilities: [
        { key: 'switch', type: 'boolean', control: 'switch', label: '电源' },
        { key: 'fluxLevel', type: 'number', min: 0, max: 100, label: '通量等级' },
        { key: 'wibbleMode', type: 'enum', values: ['a', 'b', 'c'], label: '抖动模式' },
      ],
      commands: [
        { name: 'setPower', params: { value: 'boolean' } },
        { name: 'setFluxLevel', params: { value: 'number' } },
        { name: 'setWibbleMode', params: { value: 'string' } },
      ],
    },
  },
];

async function main() {
  console.log('[seed] start');

  // ---- 型号 ----
  for (const m of MODELS) {
    await prisma.deviceModel.upsert({
      where: { code: m.code },
      update: { metadataJson: JSON.stringify(m.metadata), status: 'published' },
      create: {
        code: m.code,
        name: m.name,
        category: m.category,
        status: 'published',
        metadataJson: JSON.stringify(m.metadata),
      },
    });
  }
  console.log(`[seed] models: ${MODELS.length}`);

  // ---- 管理员四角色 ----
  const admins = [
    { email: 'root@smart.local', name: '超级管理员', role: 'super_admin' },
    { email: 'ops@smart.local', name: '运营', role: 'ops' },
    { email: 'support@smart.local', name: '客服', role: 'support' },
    { email: 'viewer@smart.local', name: '观察员', role: 'viewer' },
  ];
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  for (const a of admins) {
    await prisma.adminUser.upsert({
      where: { email: a.email },
      update: {},
      create: { ...a, passwordHash },
    });
  }
  console.log(`[seed] admins: ${admins.length} (password: Admin@123456)`);

  // ---- 用户 + 家庭 ----
  async function ensureUser(openid: string, nickname: string) {
    let acct = await prisma.weChatAccount.findUnique({ where: { openid }, include: { user: true } });
    if (!acct) {
      const user = await prisma.user.create({
        data: {
          nickname,
          wechatAccount: { create: { openid } },
        },
      });
      const family = await prisma.family.create({
        data: {
          name: `${nickname}的家`,
          ownerId: user.id,
          members: { create: { userId: user.id, role: 'owner' } },
        },
      });
      const home = await prisma.home.create({ data: { familyId: family.id, name: '我的家' } });
      await prisma.room.createMany({
        data: ['客厅', '主卧', '厨房', '卫生间'].map((n, i) => ({ homeId: home.id, name: n, sort: i })),
      });
      acct = await prisma.weChatAccount.findUnique({
        where: { openid },
        include: { user: true },
      });
      console.log(`[seed] user ${nickname} + family created`);
    }
    return acct!.user;
  }

  const userA = await ensureUser('mock_userA', 'userA');
  const userB = await ensureUser('mock_userB', 'userB');

  // ---- 给 userA 绑定演示设备 ----
  const homeA = await prisma.home.findFirst({
    where: { family: { ownerId: userA.id } },
    include: { rooms: true },
  });
  if (homeA) {
    const demoDevices = [
      { serial: 'DEMO-AC-001', modelCode: 'ac.dual.v1', name: '客厅空调', roomName: '客厅' },
      { serial: 'DEMO-CURTAIN-001', modelCode: 'curtain.v1', name: '主卧窗帘', roomName: '主卧' },
      { serial: 'DEMO-TV-001', modelCode: 'tv.smart.v1', name: '客厅电视', roomName: '客厅' },
      { serial: 'DEMO-PURIFIER-001', modelCode: 'purifier.v1', name: '空气净化器', roomName: '客厅' },
      { serial: 'DEMO-MYSTERY-001', modelCode: 'mystery.box.v1', name: '神秘盒子', roomName: '厨房' },
    ];
    for (const d of demoDevices) {
      const model = await prisma.deviceModel.findUnique({ where: { code: d.modelCode } });
      if (!model) continue;
      const room = homeA.rooms.find((r) => r.name === d.roomName);
      const device = await prisma.device.upsert({
        where: { serialNo: d.serial },
        update: {},
        create: {
          modelId: model.id,
          homeId: homeA.id,
          roomId: room?.id,
          name: d.name,
          serialNo: d.serial,
          source: 'admin',
        },
      });
      const bound = await prisma.deviceBinding.findFirst({
        where: { deviceId: device.id, unboundAt: null },
      });
      if (!bound) {
        await prisma.deviceBinding.create({
          data: {
            deviceId: device.id,
            userId: userA.id,
            familyId: homeA.familyId,
            homeId: homeA.id,
            roomId: room?.id,
            source: 'admin',
          },
        });
      }
      await prisma.deviceState.upsert({
        where: { deviceId: device.id },
        update: {},
        create: {
          deviceId: device.id,
          online: true,
          stateJson: JSON.stringify(initialState(d.modelCode)),
        },
      });
    }
    console.log(`[seed] demo devices: ${demoDevices.length}`);

    // ---- 演示场景：观影模式 ----
    const tv = await prisma.device.findUnique({ where: { serialNo: 'DEMO-TV-001' } });
    const curtain = await prisma.device.findUnique({ where: { serialNo: 'DEMO-CURTAIN-001' } });
    const ac = await prisma.device.findUnique({ where: { serialNo: 'DEMO-AC-001' } });
    const existingScene = await prisma.scene.findFirst({ where: { name: '观影模式', homeId: homeA.id } });
    if (!existingScene && tv && curtain && ac) {
      await prisma.scene.create({
        data: {
          homeId: homeA.id,
          familyId: homeA.familyId,
          name: '观影模式',
          createdBy: userA.id,
          policyJson: JSON.stringify({ onActionError: 'continue', maxRetries: 1, cooldownSec: 5 }),
          triggers: { create: [{ type: 'manual', configJson: '{}' }] },
          actions: {
            create: [
              { deviceId: curtain.id, command: 'setPosition', paramsJson: JSON.stringify({ value: 0 }), delayMs: 0, sort: 0 },
              { deviceId: tv.id, command: 'setPower', paramsJson: JSON.stringify({ value: true }), delayMs: 500, sort: 1 },
              { deviceId: ac.id, command: 'setTemperature', paramsJson: JSON.stringify({ value: 26 }), delayMs: 500, sort: 2 },
            ],
          },
        },
      });
      console.log('[seed] scene 观影模式 created');
    }

    const existingClean = await prisma.scene.findFirst({ where: { name: '舒适模式', homeId: homeA.id } });
    if (!existingClean && ac) {
      await prisma.scene.create({
        data: {
          homeId: homeA.id,
          familyId: homeA.familyId,
          name: '舒适模式',
          createdBy: userA.id,
          policyJson: JSON.stringify({ onActionError: 'continue', maxRetries: 1, cooldownSec: 5 }),
          triggers: { create: [{ type: 'manual', configJson: '{}' }] },
          actions: {
            create: [
              { deviceId: ac.id, command: 'setPower', paramsJson: JSON.stringify({ value: true }), delayMs: 0, sort: 0 },
              { deviceId: ac.id, command: 'setTemperature', paramsJson: JSON.stringify({ value: 26 }), delayMs: 300, sort: 1 },
              { deviceId: ac.id, command: 'setMode', paramsJson: JSON.stringify({ value: 'cool' }), delayMs: 300, sort: 2 },
            ],
          },
        },
      });
      console.log('[seed] scene 舒适模式 created');
    }
  }

  void userB;
  console.log('[seed] done');
}

function initialState(modelCode: string): Record<string, unknown> {
  switch (modelCode) {
    case 'ac.dual.v1':
      return { power: true, temperature: 26, targetTemp: 26, currentTemp: 27, mode: 'cool', fanSpeed: 'mid' };
    case 'curtain.v1':
      return { power: true, position: 50, mode: 'pause' };
    case 'tv.smart.v1':
      return { power: false, brightness: 60, lastKey: '' };
    case 'purifier.v1':
      return { power: true, mode: 'auto', pm25: 35, fanSpeed: 'low' };
    default:
      return { power: true, fluxLevel: 42, wibbleMode: 'a' };
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
