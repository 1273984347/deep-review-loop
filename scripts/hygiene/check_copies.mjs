// check_copies.mjs — 分册副本一致性门禁
// 批 B 引入了「同一分册多份副本」的交付方式（每个包自包含）。
// 副本文件顶部带「自包含副本」标注，本脚本从标注自动解析源路径（零人工维护表），
// 去掉标注行后与源文件逐字比对——lint 与死链扫描都对「副本内容落后」完全无感。
// 用法：node scripts/check_copies.mjs [--selftest] [--json]
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO_ROOT, listSkillDirs, listMarkdownFiles, readText, toLF, fmtHeader } from './lib/skill-audit.mjs';

const args = process.argv.slice(2);

const NOTE_RE = /^> \*\*自包含副本\*\*：本文件复制自 (.+?)（/m;

// 从副本文件还原「去掉标注行与其后空行」的正文
export function stripNote(content) {
  const lines = toLF(content).split('\n');
  const i = lines.findIndex(l => NOTE_RE.test(l));
  if (i < 0) return null;
  const rest = lines.slice(i + 1);
  if (rest.length && rest[0].trim() === '') rest.shift();
  return [...lines.slice(0, i), ...rest].join('\n');
}

function selftest() {
  let fails = 0;
  const check = (name, cond) => {
    console.log((cond ? '  PASS  ' : '  FAIL  ') + name);
    if (!cond) fails++;
  };
  const note = '> **自包含副本**：本文件复制自 pkg-a/references/x.md（2026-11-14 批 B）——本包内副本供本包独立引用。';
  const body = '# 标题\n\n正文内容\n';
  const stripped = stripNote(note + '\n' + body);
  check('标注行与源路径可解析', (note.match(NOTE_RE) || [])[1] === 'pkg-a/references/x.md');
  check('去标注后与源正文逐字相同', stripped === body);
  check('无标注的文件不被误判', stripNote(body) === null);
  check('标注后多一个空行也能还原', stripNote(note + '\n\n' + body) === body);
  const real = '# 标题\n\n' + note + '\n\n' + body;
  check('真实副本结构（标题/空行/标注/空行/正文）还原正确', stripNote(real) === '# 标题\n\n' + body);
  console.log(fails === 0 ? '  自测全部通过' : '  自测失败 ' + fails + ' 项');
  return fails;
}

if (args.includes('--selftest')) {
  console.log(fmtHeader('副本一致性判据 · 自测'));
  const f = selftest();
  process.exit(f === 0 ? 0 : 1);
}

let checked = 0, bad = 0, skipped = 0;
const report = [];
for (const d of listSkillDirs(REPO_ROOT)) {
  const pkgName = d.split(/[\\/]/).pop();
  for (const f of listMarkdownFiles(d, { skip: ['.git', 'node_modules', '.venv', 'repo'] })) {
    const txt = toLF(readText(f));
    if (!NOTE_RE.test(txt)) continue;
    const srcRel = (txt.match(NOTE_RE) || [])[1];
    const srcPath = join(REPO_ROOT, srcRel);
    checked++;
    const restored = stripNote(txt);
    const owner = srcRel.split('/')[0];
    const crossRepo = owner !== basename(REPO_ROOT);
    if (!existsSync(srcPath)) {
      if (crossRepo) {
        // 跨仓副本：源在另一个 skill 仓库里 ⇒ 本仓无法校验 ⇒ 跳过并提示（不算失败）
        skipped++;
        console.log('  SKIP  [' + pkgName + '] 跨仓副本（源在 ' + owner + ' 仓库）·本仓无法校验: ' + srcRel);
        continue;
      }
      bad++;
      report.push({ pkg: pkgName, copy: relative(REPO_ROOT, f), src: srcRel, status: 'SOURCE_MISSING' });
      console.log('  FAIL  [' + pkgName + '] 源文件不存在: ' + srcRel);
      continue;
    }
    const src = toLF(readText(srcPath));
    const same = restored === src;
    if (!same) {
      bad++;
      report.push({ pkg: pkgName, copy: relative(REPO_ROOT, f), src: srcRel, status: 'DIFFERS', copyLen: restored.length, srcLen: src.length });
      console.log('  FAIL  [' + pkgName + '] ' + relative(REPO_ROOT, f) + '  ≠  ' + srcRel + ' (副本 ' + restored.length + ' / 源 ' + src.length + ' 字符)');
    } else {
      console.log('  PASS  [' + pkgName + '] ' + relative(REPO_ROOT, f) + '  ==  ' + srcRel);
    }
  }
}
console.log('');
console.log('=== 汇总：副本 ' + checked + ' 份，不一致 ' + bad + ' 份，跨仓跳过 ' + skipped + ' 份 ===');
if (args.includes('--json')) {
  console.log('---JSON---');
  console.log(JSON.stringify({ checked, bad, report }, null, 2));
}
process.exit(bad === 0 ? 0 : 1);
