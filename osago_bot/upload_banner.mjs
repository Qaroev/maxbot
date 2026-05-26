import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);
const result = await bot.api.uploadImage({ source: './img.png' });
let token = result.token;
if (!token && result.payload && result.payload.photos) {
    const firstKey = Object.keys(result.payload.photos)[0];
    token = result.payload.photos[firstKey].token;
}
console.log('Token:', token);
