// skill-audit.mjs — 仓级 skill 审查共享库
// 零第三方依赖（只用 node: 内置模块）。被 check_*.mjs 复用。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库根 = 向上查找第一个含 SKILL.md 的目录（这样脚本放在 scripts/ 或 scripts/hygiene/ 都能工作）
export const REPO_ROOT = (() => {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, 'SKILL.md'))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
})();

export function readText(p) {
  return readFileSync(p, 'utf8');
}

// 统一行尾：CRLF 文件必须先归一再解析，否则 frontmatter 标量键会被静默丢弃。
export function toLF(s) {
  return s.replace(/\r\n/g, '\n');
}

// 匹配归一：空格/连字符/下划线不敏感，便于 "deep review" 命中 "deep-review-loop"
export function norm(s) {
  return s.replace(/[\s_\-]/g, '').toLowerCase();
}

// CRLF-safe 的 frontmatter 解析：逐行收集缩进块，不用易被 \r 破坏的行尾锚定正则。
export function parseFrontmatter(content) {
  const lines = toLF(content).split('\n');
  if (lines[0].trim() !== '---') return { fm: {}, endIdx: -1 };
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return { fm: {}, endIdx: -1 };
  const fm = {};
  let key = null, buf = [], inBlock = false;
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    if (inBlock) {
      if (/^[A-Za-z_-]+\s*:/.test(line)) {
        fm[key] = buf.join('\n').trim();
        key = null; buf = []; inBlock = false;
      } else {
        buf.push(line.replace(/^[ \t]{0,4}/, ''));
        continue;
      }
    }
    const m = line.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
    if (m) {
      const k = m[1], v = m[2];
      if (v === '|' || v === '>' || v === '|-' || v === '>-') { key = k; buf = []; inBlock = true; }
      else fm[k] = v.trim();
    }
  }
  if (inBlock && key) fm[key] = buf.join('\n').trim();
  return { fm, endIdx };
}

// 取 description 的完整块（支持 | 与 > 两种标量）
export function getDescription(skillDir) {
  const content = readText(join(skillDir, 'SKILL.md'));
  const lines = toLF(content).split('\n');
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { endIdx = i; break; } }
  if (endIdx === -1) return '';
  const out = [];
  let inDesc = false;
  for (let i = 1; i < endIdx; i++) {
    const l = lines[i];
    if (/^description\s*:/.test(l)) { inDesc = true; continue; }
    if (inDesc) {
      if (/^[ \t]+\S/.test(l)) out.push(l.trim());
      else break;
    }
  }
  return out.join('\n');
}

// 负触发面判定：整行出现下列任一标记即视为「不该由本 skill 触发」的表述。
const NEG_LINE = /Do not trigger|不触发|→\s*(deep-review-loop|self-evolution|mem-wrap-up|agent-session-loop)|use (deep-review-loop|self-evolution|mem-wrap-up|agent-session-loop)/;

// 逐行判定正/负触发面。
// 注意：不能用「全文首个 Do not trigger」做全局切分——英中双语两段式描述会把中文正面误判为负面。
export function splitTriggerFaces(description) {
  const pos = [], neg = [];
  for (const line of toLF(description).split('\n')) {
    (NEG_LINE.test(line) ? neg : pos).push(line);
  }
  return { pos: pos.join('\n'), neg: neg.join('\n') };
}

// 从一段文本里抽取「引号包裹的触发短语」，按 / 切分成单词。
export function extractPhrases(face) {
  const out = new Set();
  const push = (raw) => {
    for (const part of raw.split('/')) {
      const t = part.trim();
      if (t.length >= 2) out.add(t);
    }
  };
  for (const m of face.matchAll(/"([^"]+)"/g)) push(m[1]);
  for (const m of face.matchAll(/「([^」]+)」/g)) push(m[1]);
  return out;
}

export function triggerProfile(skillDir) {
  const f = splitTriggerFaces(getDescription(skillDir));
  return { pos: extractPhrases(f.pos), neg: extractPhrases(f.neg) };
}

// 列出 skill 包（含 SKILL.md 的目录）
export function listSkillDirs(root) {
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(root, d.name, 'SKILL.md')))
    .map(d => join(root, d.name))
    .sort();
  // 独立 skill 仓库形态：仓库根自身就是 skill 包（SKILL.md 在根）
  if (existsSync(join(root, 'SKILL.md'))) dirs.unshift(root);
  return dirs;
}

// 列出目录下的 .md（排除 .git / repo 归档区 / node_modules / .venv）
export function listMarkdownFiles(dir, opts) {
  const skip = (opts && opts.skip) || ['.git', 'node_modules', '.venv'];
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.includes(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// 跨包 references 死链：某 .md 里写了 references/x.md，但同包 references/ 下没有该文件
export function findDeadRefs(skillDir) {
  const dead = [];
  for (const f of listMarkdownFiles(skillDir, { skip: ['.git', 'node_modules', '.venv', 'repo'] })) {
    const txt = toLF(readText(f));
    for (const m of txt.matchAll(/references\/([A-Za-z0-9_-]+\.md)/g)) {
      if (!existsSync(join(skillDir, 'references', m[1]))) {
        dead.push({ from: relative(skillDir, f), ref: 'references/' + m[1] });
      }
    }
  }
  return dead;
}

export function fmtHeader(title) {
  return '=== ' + title + ' ===';
}
