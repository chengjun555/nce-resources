const fs = require('fs');
const path = require('path');

const ROOT = 'e:\\nce-resources';
const BOOKS = ['NCE1', 'NCE2', 'NCE3', 'NCE4'];
const DRY = process.env.DRY === '1';

function canonical(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function sanitize(name) {
  return name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// 建立每本书磁盘文件(去扩展名)的 canonical -> 实际基名 映射
function buildIndex(dir) {
  const idx = { '.mp3': {}, '.lrc': {} };
  for (const ext of ['.mp3', '.lrc']) {
    for (const f of fs.readdirSync(dir)) {
      if (f.toLowerCase().endsWith(ext)) {
        const base = f.slice(0, f.length - ext.length);
        idx[ext][canonical(base)] = base;
      }
    }
  }
  return idx;
}

const problems = [];
const plan = {};

for (const book of BOOKS) {
  const dir = path.join(ROOT, book);
  const jsonPath = path.join(dir, 'book.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const idx = buildIndex(dir);
  const seen = new Set();
  const changes = [];
  const renames = [];

  for (const unit of data.units) {
    const oldName = unit.filename;
    let newName = sanitize(oldName);
    if (seen.has(newName)) {
      let i = 2;
      while (seen.has(newName + '-' + i)) i++;
      newName = newName + '-' + i;
    }
    seen.add(newName);

    for (const ext of ['.mp3', '.lrc']) {
      if (oldName === newName) continue;
      const target = idx[ext][canonical(oldName)];
      if (target) {
        if (target !== newName) renames.push([path.join(dir, target + ext), path.join(dir, newName + ext)]);
      } else if (ext === '.mp3') {
        problems.push(`[${book}] 磁盘上找不到匹配 mp3: ${oldName}.mp3`);
      }
    }
    if (oldName !== newName) changes.push(`${oldName}  ->  ${newName}`);
    unit.filename = newName;
  }

  plan[book] = { changes, renames, jsonPath, data };
}

if (problems.length) {
  process.exit(1);
}

for (const book of BOOKS) {
  const p = plan[book];
  if (!DRY) {
    for (const [from, to] of p.renames) fs.renameSync(from, to);
    fs.writeFileSync(p.jsonPath, JSON.stringify(p.data, null, 2) + '\n', 'utf8');
  }
}
