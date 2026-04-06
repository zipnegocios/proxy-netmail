module.exports = {
  apps: [
    {
      name: 'proxy-netmail-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Política de reinicio
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      // Logs
      log_file: '../../logs/api-combined.log',
      out_file: '../../logs/api-out.log',
      error_file: '../../logs/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Monitoreo
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: 'proxy-netmail-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Política de reinicio
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      // Logs
      log_file: '../../logs/web-combined.log',
      out_file: '../../logs/web-out.log',
      error_file: '../../logs/web-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Monitoreo
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],

  // Configuración de despliegue (opcional, para usar con pm2 deploy)
  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/main',
      repo: 'GIT_REPOSITORY',
      path: 'DESTINATION_PATH',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
