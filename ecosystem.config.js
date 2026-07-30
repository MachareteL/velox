module.exports = {
  apps: [
    {
      name: 'velox-worker',
      script: 'apps/worker/dist/index.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
      env: {
        TZ: 'America/Sao_Paulo',
        SYSTEMD_IGNORE_CHROOT: '1',
        DBUS_SESSION_BUS_ADDRESS: '/dev/null',
      },
    },
  ],
};
