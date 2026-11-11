import 'dotenv/config';
import fs from 'fs';
import { Bot } from '@maxhub/max-bot-api';

// Загрузка через Buffer: загрузка из потока (source: './img.png') возвращает пустой ответ
const bot = new Bot(process.env.BOT_TOKEN);
const result = await bot.api.upload.image({ source: fs.readFileSync('./img.png') });
let token = result.token;
if (!token && result.photos) {
    const firstKey = Object.keys(result.photos)[0];
    token = result.photos[firstKey].token;
}
console.log('Token:', token);
