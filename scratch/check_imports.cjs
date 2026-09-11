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
const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(srcDir, file);

  // Check for apiRequest without import
  if (content.includes('apiRequest') && !content.includes('import') && !content.includes('function apiRequest') && !content.includes('export async function apiRequest')) {
    issues.push(`${rel}: uses apiRequest without import`);
  }
});

console.log(`Scan completed. Found ${issues.length} potential issues:`);
issues.forEach(i => console.log(' - ' + i));
