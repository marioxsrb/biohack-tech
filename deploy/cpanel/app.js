/**
 * Phusion Passenger entry point (cPanel Application Manager) for the Next.js standalone build.
 * The production environment lives outside every web root, in ~/.biohack-app.env (chmod 600),
 * and is loaded here before the server starts. Variables already set by the host win.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const file = process.env.BIOHACK_ENV_FILE || path.join(os.homedir(), '.biohack-app.env')
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}
process.env.NODE_ENV = 'production'
require('./server.js')
