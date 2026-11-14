// check_deadlinks.mjs — 跨包 references 死链门禁
// 官方 lint 只扫根 SKILL.md 的 references 链接，不进 references/ 内部；
// 本脚本补上那一层，并覆盖全仓所有 .md。
// 用法：node scripts/check_deadlinks.mjs [--selftest] [--json]
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO_ROOT, listSkillDirs, listMarkdownFiles, findDeadRefs, readText, toLF, fmtHeader } from './lib/skill-audit.mjs';

const args = process.argv.slice(2);

function selftest() {
  let fails = 0;
  const check = (name, cond) => {
    console.log((cond ? '  PASS  ' : '  FAIL  ') + name);
    if (!cond) fails++;
  };
  const root = join(tmpdir(), 'mavis-deadlink-selftest-' + process.pid);
  const pkg = join(root, 'demo-skill');
  mkdirSync(join(pkg, 'references'), { recursive: true });
  writeFileSync(join(pkg, 'SKILL.md'), '---\nname: demo-skill\ndescription: "use when x"\n---\n\nbody\n');
  writeFileSync(join(pkg, 'references', 'ok.md'), '# ok\n');
  writeFileSync(join(pkg, 'references', 'sub.md'), '指向 references/ok.md 与 references/missing.md\n');
  const dead = findDeadRefs(pkg);
  check('存在的引用不报死链', !dead.some(d => d.ref === 'references/ok.md'));
  check('缺失的引用被判死链', dead.some(d => d.ref === 'references/missing.md'));
  check('references/ 内部的引用也被扫到', dead.some(d => d.from.indexOf('references') >= 0));
  rmSync(root, { recursive: true, force: true });
  console.log(fails === 0 ? '  自测全部通过' : '  自测失败 ' + fails + ' 项');
  return fails;
}

if (args.includes('--selftest')) {
  console.log(fmtHeader('死链扫描判据 · 自测'));
  const f = selftest();
  process.exit(f === 0 ? 0 : 1);
}

const dirs = listSkillDirs(REPO_ROOT);
let total = 0, bad = 0;
const report = [];
for (const d of dirs) {
  const dead = findDeadRefs(d);
  const name = d.split(/[\\/]/).pop();
  total += dead.length;
  if (dead.length) {
    bad++;
    report.push({ pkg: name, dead });
    console.log('  FAIL  [' + name + ']  死链 ' + dead.length + ' 条');
    for (const x of dead) console.log('        ' + x.from + ' -> ' + x.ref);
  } else {
    console.log('  PASS  [' + name + ']');
  }
}
console.log('');
console.log('=== 汇总：' + dirs.length + ' 个包，死链 ' + total + ' 条（FAIL 包 ' + bad + ' 个）===');
if (args.includes('--json')) {
  console.log('---JSON---');
  console.log(JSON.stringify({ total, bad, report }, null, 2));
}
process.exit(bad === 0 ? 0 : 1);
