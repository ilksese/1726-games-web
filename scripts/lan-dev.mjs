import { spawn } from 'node:child_process'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const serverArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const processes = [
  spawn(pnpm, ['dev'], { stdio: 'inherit' }),
  spawn(pnpm, ['server:dev', '--', ...serverArgs], { stdio: 'inherit' }),
]

let shuttingDown = false

function shutdown(signal = 'SIGTERM') {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of processes) {
    if (!child.killed) child.kill(signal)
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal))
}

const exitCode = await new Promise((resolve) => {
  for (const child of processes) {
    child.once('exit', (code, signal) => {
      if (!shuttingDown) shutdown(signal || 'SIGTERM')
      resolve(code ?? (signal ? 1 : 0))
    })
    child.once('error', () => {
      shutdown('SIGTERM')
      resolve(1)
    })
  }
})

process.exitCode = exitCode
