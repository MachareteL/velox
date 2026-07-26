module.exports = {
  apps: [
    {
      name: 'velox-worker',
      script: 'apps/worker/dist/index.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
    },
  ],
};
