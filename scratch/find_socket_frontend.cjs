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
const matches = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('socket.io') || content.includes('io(') || content.includes('useSocket')) {
    matches.push(path.relative(srcDir, file));
  }
});

console.log(`Found socket usage in ${matches.length} files:`);
matches.forEach(m => console.log(' - ' + m));
