const fs = require('fs');
const path = require('path');
function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file === 'route.ts') {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.includes('export const dynamic')) {
        fs.writeFileSync(fullPath, 'export const dynamic = "force-dynamic";\n' + content);
        console.log('Updated ' + fullPath);
      }
    }
  }
}
walk('src/app/api');
