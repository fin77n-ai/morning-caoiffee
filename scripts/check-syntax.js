const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

for (const directory of ['src', 'scripts', 'test']) {
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', `${directory}/${file}`], { stdio: 'inherit' });
  }
}
