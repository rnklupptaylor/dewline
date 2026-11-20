const fs = require('node:fs');
const path = require('node:path');
const { version } = require('../package.json');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const baseline = process.argv.includes('--baseline');
const destination = path.join(root, 'build', baseline ? 'baseline' : 'deploy');

fs.mkdirSync(destination, { recursive: true });
for (const file of fs.readdirSync(source)) {
  const input = path.join(source, file);
  const output = path.join(destination, file);
  if (baseline || file !== 'index.html') {
    fs.copyFileSync(input, output);
    continue;
  }

  const html = fs.readFileSync(input, 'utf8');
  const marker = '<p class="credits">';
  if (!html.includes(marker)) throw new Error('Missing version location in footer');
  fs.writeFileSync(output, html.replace(marker, () => marker + 'v' + version + ' · '));
}

console.log('Built ' + path.relative(root, destination));
