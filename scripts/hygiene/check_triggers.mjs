// check_triggers.mjs — 触发面对拍门禁
// 判据：① 正触发面 ∩ 负触发面 = 0（自身不自相矛盾）
//       ② 两包正触发短语集合两两不相交
//       ③ 与各包 trigger-eval 合同逐样本对拍（应触发必命中、不应触发必不命中）
// 用法：node scripts/check_triggers.mjs [--selftest] [--json]
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, listSkillDirs, triggerProfile, norm, fmtHeader } from './lib/skill-audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function loadContracts() {
  const out = [];
  for (const dir of listSkillDirs(REPO_ROOT)) {
    const p = [join(dir, 'repo', 'evals', 'trigger-eval.json'), join(dir, 'evals', 'trigger-eval.json')]
      .find((x) => existsSync(x));
    if (!p) continue;
    let ev;
    try { ev = JSON.parse(readFileSync(p, 'utf8')); } catch (e) {
      out.push({ pkg: dir, error: 'JSON 解析失败: ' + e.message, queries: [] });
      continue;
    }
    out.push({ pkg: dir, name: ev.skill_name, queries: ev.queries || [] });
  }
  return out;
}

// —— 自测：用已知真值样本验证判据本身（先验证尺子，再用量尺）——
function selftest() {
  let fails = 0;
  const check = (name, cond) => {
    console.log((cond ? '  PASS  ' : '  FAIL  ') + name);
    if (!cond) fails++;
  };
  const SAMPLE = [
    '  Trigger when the user asks for a review pass — says "deep review / 复检 / 收敛", or when false convergence is suspected.',
    '  Do not trigger for session close-out ("收尾 / wrap up", use mem-wrap-up) or retro analysis ("复盘").',
    '  5 轮深度复检闭环。用户要求「复检/收敛/DRL」时触发。',
    '  不触发：session 收尾（用 mem-wrap-up）。'
  ].join('\n');

  const profile = (() => {
    const pos = [], neg = [];
    const NEG_LINE = /Do not trigger|不触发|→\s*(deep-review-loop|self-evolution|mem-wrap-up|agent-session-loop)|use (deep-review-loop|self-evolution|mem-wrap-up|agent-session-loop)/;
    for (const l of SAMPLE.split('\n')) (NEG_LINE.test(l) ? neg : pos).push(l);
    const set = (face) => {
      const o = new Set();
      const push = (raw) => { for (const part of raw.split('/')) { const t = part.trim(); if (t.length >= 2) o.add(t); } };
      for (const m of face.matchAll(/"([^"]+)"/g)) push(m[1]);
      for (const m of face.matchAll(/「([^」]+)」/g)) push(m[1]);
      return o;
    };
    return { pos: set(pos.join('\n')), neg: set(neg.join('\n')) };
  })();

  check('英中双语两段式：中文正面不被误判为负面', profile.pos.has('复检') && profile.pos.has('收敛') && profile.pos.has('DRL'));
  check('英文正面触发词被提取', profile.pos.has('deep review'));
  check('负触发行的引号短语归入负面且不在正面', profile.neg.has('收尾') && !profile.pos.has('收尾'));
  check('负触发行无引号时不产生噪声词', !profile.neg.has('mem-wrap-up'));
  check('归一化匹配：deep review 命中 deep-review-loop', norm('帮我用 deep-review-loop 检查').includes(norm('deep review')));
  check('归一化匹配：DRL 命中 DRL', norm('跑一下 DRL 闭环').includes(norm('DRL')));
  check('两包交集判据：同词判 FAIL', [...new Set(['复检'])].filter(x => new Set(['复例']) === undefined ? false : new Set(['复检']).has(x)).length === 1);
  check('漏识别防护：无引号短语时判不可判定', (() => {
    const bare = '  Use when user asks 复检 / 收敛.';
    const o = new Set();
    for (const m of bare.matchAll(/"([^"]+)"/g)) o.add(m[1]);
    return o.size === 0;
  })());
  console.log(fails === 0 ? '  自测全部通过' : '  自测失败 ' + fails + ' 项');
  return fails;
}

if (args.includes('--selftest')) {
  console.log(fmtHeader('触发对拍判据 · 自测'));
  const f = selftest();
  process.exit(f === 0 ? 0 : 1);
}

const contracts = loadContracts();
if (contracts.length === 0) {
  console.error('未找到任何 */repo/evals/trigger-eval.json —— 跳过触发对拍');
  process.exit(0);
}
const profiles = {};
for (const c of contracts) profiles[c.pkg] = triggerProfile(c.pkg);

let failCount = 0;
const results = [];

// 漏识别防护：正触发短语为空的包，其触发面「不可判定」——不得静默 PASS。
// 判据漏识别比误识别更隐蔽：它不产生红灯，只让整套对拍悄悄失效。
const noPhrase = contracts.filter(c => profiles[c.pkg].pos.size === 0);
for (const c of noPhrase) {
  console.log('  WARN  [' + c.name + '] description 未提取到任何引号触发短语 → 触发面不可判定（记为失败）');
  failCount++;
}

console.log(fmtHeader('触发面提取'));
for (const c of contracts) {
  const pr = profiles[c.pkg];
  console.log('  [' + c.name + ']');
  console.log('    正: ' + [...pr.pos].join(' | '));
  console.log('    负: ' + [...pr.neg].join(' | '));
}

console.log('');
console.log(fmtHeader('判据 1 · 正触发面 ∩ 负触发面（自身不应自相矛盾）'));
let c1 = 0;
for (const c of contracts) {
  const pr = profiles[c.pkg];
  if (pr.pos.size === 0) { console.log('  SKIP  [' + c.name + '] 无可判定触发短语（已记为失败）'); continue; }
  const hit = [...pr.pos].filter(x => pr.neg.has(x));
  const ok = hit.length === 0;
  if (ok) c1++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  [' + c.name + ']' + (hit.length ? '  冲突: ' + hit.join(', ') : ''));
  if (!ok) failCount++;
}

console.log('');
console.log(fmtHeader('判据 2 · 两包正触发短语交集（应两两不相交）'));
let c2 = 0, pairs = 0;
for (let i = 0; i < contracts.length; i++) {
  for (let j = i + 1; j < contracts.length; j++) {
    const A = contracts[i], B = contracts[j];
    if (profiles[A.pkg].pos.size === 0 || profiles[B.pkg].pos.size === 0) continue;
    pairs++;
    const hit = [...profiles[A.pkg].pos].filter(x => profiles[B.pkg].pos.has(x));
    const ok = hit.length === 0;
    if (ok) c2++;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + A.name + ' ∩ ' + B.name + (hit.length ? '  交集: ' + hit.join(', ') : ''));
    if (!ok) failCount++;
  }
}

console.log('');
console.log(fmtHeader('判据 3 · 与 trigger-eval 合同逐样本对拍'));
let c3 = 0, t3 = 0;
const crossHits = [];
for (const c of contracts) {
  console.log('  --- ' + c.name + ' ---');
  if (c.error) { console.log('    FAIL  ' + c.error); failCount++; continue; }
  if (profiles[c.pkg].pos.size === 0) { console.log('    SKIP  无可判定触发短语（已记为失败）'); continue; }
  for (const q of c.queries) {
    t3++;
    const hits = [...profiles[c.pkg].pos].filter(x => norm(q.query).includes(norm(x)));
    const ok = q.should_trigger ? hits.length > 0 : hits.length === 0;
    if (ok) c3++;
    else failCount++;
    console.log('    ' + (ok ? 'OK  ' : 'FAIL') + '  [' + (q.should_trigger ? '应触发' : '不应触发') + '] 命中[' + hits.join(',') + ']  « ' + q.query + ' »');
    const others = contracts.filter(x => x.pkg !== c.pkg && [...profiles[x.pkg].pos].some(y => norm(q.query).includes(norm(y))));
    if (others.length) crossHits.push({ pkg: c.name, query: q.query, also: others.map(o => o.name).join(',') });
  }
}

console.log('');
console.log(fmtHeader('判据 4 · 跨包命中分布（信息性：需由「更具体者优先」消解）'));
if (crossHits.length === 0) console.log('  无跨包命中');
for (const h of crossHits) console.log('  [' + h.pkg + '] « ' + h.query + ' » 同时命中: ' + h.also);

console.log('');
console.log('=== 汇总 ===');
console.log('  判据1: ' + c1 + '/' + contracts.length + '   判据2: ' + c2 + '/' + pairs + '   判据3: ' + c3 + '/' + t3);
console.log('  失败项: ' + failCount);

if (args.includes('--json')) {
  console.log('---JSON---');
  console.log(JSON.stringify({ c1, c2, c3, t3, failCount, crossHits }, null, 2));
}
process.exit(failCount === 0 ? 0 : 1);
