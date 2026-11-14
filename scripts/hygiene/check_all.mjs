// check_all.mjs — 一键跑全部 skill 门禁
// 组成：① 官方 skill-creator lint  ② 触发对拍  ③ 死链扫描  ④ 副本一致性
// 用法：
//   node scripts/check_all.mjs                 跑全部门禁
//   node scripts/check_all.mjs --creator <dir> 指定 skill-creator 目录（默认自动探测）
//   node scripts/check_all.mjs --creator <dir> 指定 skill-creator 目录（默认自动探测）
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, listSkillDirs, fmtHeader } from './lib/skill-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function findCreator() {
  const i = args.indexOf('--creator');
  if (i >= 0 && args[i + 1]) return resolve(args[i + 1]);
  if (process.env.SKILL_CREATOR_DIR) return resolve(process.env.SKILL_CREATOR_DIR);
  const candidates = [
    join(homedir(), '.minimax', '.builtin-skills', 'skill-creator'),
    join('C:', 'Users', process.env.USERNAME || '', '.minimax', '.builtin-skills', 'skill-creator')
  ];
  for (const c of candidates) if (existsSync(join(c, 'scripts', 'lint-skill.js'))) return c;
  return null;
}

function run(label, cmd, cmdArgs) {
  process.stdout.write(fmtHeader(label) + '\n');
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: false });
  const code = r.status === null ? 1 : r.status;
  console.log('  => ' + label + ' ' + (code === 0 ? 'PASS' : 'FAIL (exit ' + code + ')') + '\n');
  return code === 0;
}

console.log('=== Mavis skill 仓级门禁 ===');
console.log('仓库根: ' + REPO_ROOT);
console.log('skill 包: ' + listSkillDirs(REPO_ROOT).length + ' 个\n');

const results = [];

if (args.includes('--no-lint')) {
  console.log('  跳过官方 lint（--no-lint）：CI 环境没有内置 skill-creator；本地跑 check_all.mjs 即含官方 lint。\n');
} else {
const creator = findCreator();
if (!creator) {
  console.log('!! 未找到 skill-creator 的 lint-skill.js —— 官方 lint 检查跳过。');
  console.log('   定位方法：设置环境变量 SKILL_CREATOR_DIR=<skill-creator 目录>，或用 --creator <dir> 指定。\n');
  results.push(['官方 lint', false]);
} else {
  const lintPath = join(creator, 'scripts', 'lint-skill.js');
  console.log('skill-creator: ' + creator + '\n');
  const dirs = listSkillDirs(REPO_ROOT);
  let allOk = true;
  const failed = [];
  for (const d of dirs) {
    const r = spawnSync(process.execPath, [lintPath, d], { encoding: 'utf8' });
    const name = d.split(/[\\/]/).pop();
    if (r.status === 0) {
      console.log('  PASS  [' + name + ']');
    } else {
      allOk = false;
      failed.push(name);
      console.log('  FAIL  [' + name + ']');
      const out = (r.stdout || '') + (r.stderr || '');
      for (const l of out.split('\n')) {
        if (l.includes('[FAIL]')) console.log('        ' + l.replace(/\x1b\[[0-9;]*m/g, '').trim());
      }
    }
  }
  console.log('  => 官方 lint ' + (allOk ? 'PASS' : 'FAIL (' + failed.join(', ') + ')') + '\n');
  results.push(['官方 lint', allOk]);
}
}

results.push(['触发对拍', run('门禁 2 · 触发面对拍', process.execPath, [join(HERE, 'check_triggers.mjs')])]);
results.push(['死链扫描', run('门禁 3 · 跨包死链扫描', process.execPath, [join(HERE, 'check_deadlinks.mjs')])]);
results.push(['副本一致性', run('门禁 4 · 分册副本一致性', process.execPath, [join(HERE, 'check_copies.mjs')])]);

console.log(fmtHeader('门禁汇总'));
for (const [name, ok] of results) console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name);
const failedCount = results.filter(r => !r[1]).length;
console.log('');
console.log(failedCount === 0 ? '全部门禁通过' : failedCount + ' 项门禁未通过');
process.exit(failedCount === 0 ? 0 : 1);
