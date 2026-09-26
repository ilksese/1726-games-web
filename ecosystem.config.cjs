module.exports = {
  apps: [
    {
      name: '1726-games-web-dev',
      cwd: __dirname,
      script: './node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0 --port ' + (process.env.VITE_1726_GAME_PORT || '5173') + ' --strictPort',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        VITE_1726_GAME_PORT: process.env.VITE_1726_GAME_PORT || '5173',
      },
      autorestart: true,
      watch: false,
    },
    {
      name: '1726-games-server',
      cwd: __dirname + '/packages/server',
      script: 'go',
      args: 'run ./cmd/server',
      interpreter: 'none',
      env: {
        VITE_1726_GAME_PORT: process.env.VITE_1726_GAME_PORT || '5173',
        VITE_1726_SERVER_PORT: process.env.VITE_1726_SERVER_PORT || '5174',
      },
      autorestart: true,
      watch: false,
    },
  ],
}
