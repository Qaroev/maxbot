import fs from 'fs';
import tls from 'tls';
import { Bot } from '@maxhub/max-bot-api';

const extraCa = fs.readFileSync(new URL('./certs/russian_trusted_sub_ca.pem', import.meta.url), 'utf8');
const certs = extraCa.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...certs]);

// Загрузка через Buffer: загрузка из потока (source: './img.png') возвращает пустой ответ
const bot = new Bot("f9LHodD0cOJa50rkNYVUoRbk1E3EkgeNv74-GdNOCfUen93SNve85THJH3TIE2ciSilD29jQ9QDQOevo-d0i");
const result = await bot.api.upload.image({ source: fs.readFileSync('./img.png') });
let token = result.token;
if (!token && result.photos) {
    const firstKey = Object.keys(result.photos)[0];
    token = result.photos[firstKey].token;
}
console.log('Token:', token);
