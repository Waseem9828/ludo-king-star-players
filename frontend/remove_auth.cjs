const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match the if (!isAuthenticated) { return ( <EmptyState ... > ) } block
  // It handles nested divs and variations of the EmptyState return block.
  const regex = /if \(!isAuthenticated\) \{\s*return \(\s*<div[^>]*>[\s\S]*?<\/div>\s*\);\s*\}/g;
  
  // Some files might have different structures, e.g. MatchRoomDetail.jsx has `if (!isAuthenticated) return null;` or `if (!isAuthenticated) return;`
  const regex2 = /if \(!isAuthenticated\)\s+return\s*(null)?;?/g;

  let newContent = content.replace(regex, '');
  newContent = newContent.replace(regex2, '');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
