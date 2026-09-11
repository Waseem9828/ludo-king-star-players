const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/WASEEM/Desktop/Projects/mewat plachis clone/frontend/src';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk(srcDir);
const toastMatches = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('toast.') || line.includes('toast(') || line.includes('showToast(')) {
      toastMatches.push({
        file: path.relative(srcDir, file),
        lineNum: idx + 1,
        content: line.trim()
      });
    }
  });
});

console.log(`Found ${toastMatches.length} toast invocations:\n`);
toastMatches.forEach(m => {
  console.log(`${m.file}:${m.lineNum} -> ${m.content}`);
});
