// Конфиг PM2: запускает все боты на сервере.
// Запуск: pm2 start ecosystem.config.cjs
// cwd важен — каждый бот читает .env и users.json из своей папки.
module.exports = {
    apps: [
        { name: 'vakansii', cwd: __dirname, script: 'bot.js' },
        { name: 'osago', cwd: __dirname + '/osago_bot', script: 'bot.js' },
        { name: 'samokat', cwd: __dirname + '/samokat', script: 'bot.js' },
        { name: 'yandex_job', cwd: __dirname + '/yandex_job_tgbot', script: 'bot.js' },
        { name: 'samokat_tg', cwd: __dirname + '/samokat_tg', script: 'bot.js' },
        { name: 'yandex_tg', cwd: __dirname + '/yandex_tg', script: 'bot.js' },
        { name: 'vakansii_tg', cwd: __dirname + '/vakansii_tg', script: 'bot.js' },
    ].map(app => ({
        ...app,
        autorestart: true,
        restart_delay: 5000,
        max_memory_restart: '300M',
    })),
};
