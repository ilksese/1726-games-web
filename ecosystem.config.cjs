module.exports = {
  apps: [
    {
      name: '1726-games-web-dev',
      cwd: __dirname,
      script: './node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0 --port 5173',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      watch: false,
    },
  ],
}
