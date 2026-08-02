module.exports = {
  apps: [
    {
      name: 'velox-worker',
      script: 'apps/worker/dist/index.js',
      time: false, // Pino já gera timestamp ISO interno no JSON. time: false previne timestamp duplicado no início da linha.
      out_file: './logs/velox-worker-out.log',
      error_file: './logs/velox-worker-error.log',
      merge_logs: true,
      env: {
        TZ: 'America/Sao_Paulo',
        SYSTEMD_IGNORE_CHROOT: '1',
        DBUS_SESSION_BUS_ADDRESS: '/dev/null',
      },
    },
  ],
};
