/**
 * 环境预检（docs/phase-0 · scripts/check-env.ts）
 * 检查 Node/pnpm 版本、端口占用、服务健康。
 */
import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => string) {
  try {
    results.push({ name, ok: true, detail: fn() });
  } catch (e: any) {
    results.push({ name, ok: false, detail: e.message ?? String(e) });
  }
}

function version(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim().split('\n')[0].trim();
}

function portFree(port: number): Promise<boolean> {
  return new Promise((res) => {
    const sock = createConnection({ port, host: '127.0.0.1' });
    sock.on('connect', () => {
      sock.destroy();
      res(false); // occupied
    });
    sock.on('error', () => res(true));
    setTimeout(() => {
      sock.destroy();
      res(true);
    }, 1000);
  });
}

async function httpOk(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  check('node', () => {
    const v = process.version;
    const major = Number(v.slice(1).split('.')[0]);
    if (major < 20) throw new Error(`${v} < required 20`);
    return v;
  });
  check('pnpm', () => version('pnpm -v'));
  check('git', () => version('git --version'));
  check('workspace', () => {
    if (!existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))) {
      throw new Error('run from repo root');
    }
    return 'pnpm-workspace.yaml found';
  });
  check('prisma schema', () => {
    const p = resolve(process.cwd(), 'apps/server/prisma/schema.prisma');
    if (!existsSync(p)) throw new Error('schema missing');
    return p;
  });
  check('.env', () => {
    const p = resolve(process.cwd(), 'apps/server/.env');
    return existsSync(p) ? 'present' : 'missing (db:migrate will fail)';
  });

  const ports = [3000, 1883, 8888, 7001, 5173];
  for (const p of ports) {
    const free = await portFree(p);
    results.push({
      name: `port ${p}`,
      ok: true,
      detail: free ? 'free' : 'IN USE (service may be running)',
    });
  }

  const health = await httpOk('http://127.0.0.1:3000/api/v1/health');
  results.push({ name: 'server health', ok: health, detail: health ? 'healthy' : 'not running' });

  const docker = (() => {
    try {
      return version('docker --version');
    } catch {
      return null;
    }
  })();
  results.push({
    name: 'docker (optional)',
    ok: true,
    detail: docker ?? 'not installed → SQLite/Aedes fallback in use',
  });

  let failed = 0;
  console.log('\n=== check-env ===');
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    if (!r.ok) failed++;
    console.log(`${mark} ${r.name.padEnd(20)} ${r.detail}`);
  }
  console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed})`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
