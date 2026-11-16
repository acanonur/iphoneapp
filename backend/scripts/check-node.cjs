// Runs before the server and the setup scripts start (npm "pre" scripts), and
// says in plain words what is missing instead of letting them fail obscurely.
// Written in the oldest JavaScript there is, so that a Node.js too old for
// the server can still read it.
var fs = require('fs');
var path = require('path');

function stop(lines) {
  console.error('');
  for (var i = 0; i < lines.length; i++) console.error('  ' + lines[i]);
  console.error('');
  process.exit(1);
}

var parts = process.versions.node.split('.');
var major = Number(parts[0]);
var minor = Number(parts[1]);
// 22.13 is the first version whose built-in database works without a flag.
if (major < 22 || (major === 22 && minor < 13)) {
  stop([
    'Yaver needs Node.js 22.13 or newer. This computer has ' + process.versions.node + '.',
    'Download the current version from https://nodejs.org (the "LTS" button), install it,',
    'open a new Terminal window, and run the command again.',
  ]);
}

// After an update the server may need packages that are not on this computer yet.
var wanted = Object.keys(require('../package.json').dependencies).concat(['tsx']);
var missing = [];
for (var i = 0; i < wanted.length; i++) {
  if (!fs.existsSync(path.join(__dirname, '..', 'node_modules', wanted[i]))) missing.push(wanted[i]);
}
if (missing.length > 0) {
  stop([
    'The server\'s packages are not all installed yet. Run this first, then try again:',
    '',
    '    npm install',
  ]);
}
