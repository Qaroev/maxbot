import 'dotenv/config';
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import fs from 'fs';
import tls from 'tls';

// platform-api2.max.ru использует сертификат Минцифры — доверяем ему явно в коде,
// т.к. переменная окружения NODE_EXTRA_CA_CERTS не подхватывается уже запущенными терминалами/IDE.
try {
    const extraCa = fs.readFileSync(new URL('./certs/russian_trusted_sub_ca.pem', import.meta.url), 'utf8');
    const certs = extraCa.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
    tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...certs]);
} catch (e) {
    console.error('Не удалось загрузить доверенный сертификат Минцифры:', e.message);
}

const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID || '0');
const CALC_URL = process.env.CALC_URL || 'https://osago.ru';
const BANNER_PHOTO_TOKEN = process.env.BANNER_PHOTO_TOKEN || '';
const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK || '';

const USERS_FILE = './users.json';

function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return new Set(JSON.parse(data));
    } catch {
        return new Set();
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify([...users]));
}

const states = new Map();
const users = loadUsers();

function trackUser(userId) {
    if (!users.has(userId)) {
        users.add(userId);
        saveUsers();
    }
}

function getState(userId) {
    return states.get(userId) || { step: 'idle' };
}

function setState(userId, data) {
    states.set(userId, data);
}

function extractLink(body, text) {
    const markup = (body && body.markup) || [];
    const linkMarkups = markup.filter(m => m.type === 'link' && m.url);
    const firstLink = linkMarkups[0];
    if (firstLink) {
        const btnUrl = firstLink.url;
        const allSameUrl = linkMarkups.filter(m => m.url === btnUrl);
        const minFrom = Math.min(...allSameUrl.map(m => m.from));
        const maxTo = Math.max(...allSameUrl.map(m => m.from + m.length));
        const btnText = text.substring(minFrom, maxTo).trim() || '👉 Перейти по ссылке';
        const cleanText = (text.substring(0, minFrom) + text.substring(maxTo)).trim();
        return { btnUrl, btnText, cleanText };
    }
    const urlMatch = text && text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        return { btnUrl: urlMatch[0], btnText: '👉 Перейти по ссылке', cleanText: text.replace(urlMatch[0], '').trim() };
    }
    return { btnUrl: null, btnText: null, cleanText: text };
}

async function sendToBitrix(data) {
    if (!BITRIX_WEBHOOK) return;
    const url = `${BITRIX_WEBHOOK}/crm.lead.add`;
    const fields = {
        TITLE: `ОСАГО — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'OTHER',
        SOURCE_DESCRIPTION: 'Бот ОСАГО',
        COMMENTS:
            `Источник: Бот ОСАГО\n` +
            `ФИО: ${data.fio}\n` +
            `Телефон: ${data.phone}\n` +
            `Автомобиль: ${data.car}\n` +
            `Регион: ${data.region}`,
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
    const result = await res.json();
    if (result.error) {
        console.error('Bitrix error:', result.error, result.error_description);
    } else {
        console.log('Bitrix лид создан, ID:', result.result);
    }
}

const adminKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('📊 Статистика', 'admin_stats')],
    [Keyboard.button.callback('📢 Рассылка', 'admin_broadcast')],
    [Keyboard.button.callback('🏠 В меню', 'menu')],
]);

const broadcastTypeKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('Текст', 'broadcast_text')],
    [Keyboard.button.callback('Фото + текст', 'broadcast_photo')],
    [Keyboard.button.callback('Видео + текст', 'broadcast_video')],
    [Keyboard.button.callback('◀ Назад', 'admin_panel')],
]);

const menuKeyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback('🏠 Меню', 'menu')]]);

function getMainKeyboard(userId) {
    const rows = [
        [Keyboard.button.link('👉 Рассчитать ОСАГО', CALC_URL)],
    ];
    if (userId === ADMIN_ID) {
        rows.push([Keyboard.button.callback('⚙️ Админ-панель', 'admin_panel')]);
    }
    return Keyboard.inlineKeyboard(rows);
}

const WELCOME_TEXT =
    '🚗 ОСАГО онлайн — быстро и без переплат\n\n' +
    'Хватит переплачивать за страховку 🙌\n' +
    'Наш калькулятор подберёт лучшие предложения от\n' +
    'страховых компаний всего за 30 секунд 🏁\n\n' +
    '✅ без звонков\n' +
    '✅ без скрытых комиссий\n' +
    '✅ сравнение цен сразу от нескольких компаний\n\n' +
    'Просто введи данные автомобиля и водителя\n' +
    '— и увидишь реальную стоимость полиса 👇';

async function showMenu(ctx) {
    const userId = ctx.user.user_id;
    trackUser(userId);
    setState(userId, { step: 'idle' });
    await ctx.reply(WELCOME_TEXT, { attachments: [getMainKeyboard(userId)] });
}

async function handleStart(ctx) {
    const userId = ctx.user.user_id;
    trackUser(userId);
    setState(userId, { step: 'idle' });

    if (BANNER_PHOTO_TOKEN) {
        try {
            await ctx.reply('', {
                attachments: [{ type: 'image', payload: { token: BANNER_PHOTO_TOKEN } }],
            });
        } catch (e) {
            console.error('Banner photo error:', e.message);
        }
    }

    await ctx.reply(WELCOME_TEXT, { attachments: [getMainKeyboard(userId)] });
}

bot.command('start', handleStart);
bot.on('bot_started', handleStart);

bot.action('menu', async (ctx) => {
    await showMenu(ctx);
});

bot.action('admin_panel', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'idle' });
    await ctx.reply('Добро пожаловать в админ-панель!\n\nВыберите действие:', {
        attachments: [adminKeyboard],
    });
});

bot.action('admin_stats', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    await ctx.reply(`📊 Статистика\n\n👥 Всего пользователей: ${users.size}`, {
        attachments: [adminKeyboard],
    });
});

bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'idle' });
    await ctx.reply('Выберите, какую именно рассылку вы хотите запустить:', {
        attachments: [broadcastTypeKeyboard],
    });
});

bot.action('broadcast_text', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'admin_broadcast_text' });
    await ctx.reply('Введите текст для рассылки 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

bot.action('broadcast_photo', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'admin_broadcast_photo' });
    await ctx.reply('Отправьте фото с подписью (или без) 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

bot.action('broadcast_video', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'admin_broadcast_video' });
    await ctx.reply('Отправьте видео с подписью (или без) 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

bot.on('message_created', async (ctx) => {
    const userId = ctx.user.user_id;
    trackUser(userId);
    const text = ctx.message && ctx.message.body && ctx.message.body.text;
    const state = getState(userId);

    if (state.step === 'admin_broadcast_text' && userId === ADMIN_ID) {
        if (!text) {
            await ctx.reply('Пожалуйста, отправьте текстовое сообщение.');
            return;
        }
        setState(userId, { step: 'idle' });
        const { btnUrl, btnText, cleanText } = extractLink(ctx.message && ctx.message.body, text);
        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                if (btnUrl) {
                    await bot.api.sendMessageToUser(uid, cleanText, {
                        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.link(btnText, btnUrl)]])],
                    });
                } else {
                    await bot.api.sendMessageToUser(uid, text);
                }
                sent++;
            } catch (e) {
                console.error('broadcast text error:', uid, e.message);
                failed++;
            }
        }
        await ctx.reply(`✅ Рассылка завершена!\n📤 Отправлено: ${sent}\n❌ Ошибок: ${failed}`, {
            attachments: [adminKeyboard],
        });
        return;
    }

    if (state.step === 'admin_broadcast_photo' && userId === ADMIN_ID) {
        const attachments = (ctx.message && ctx.message.body && ctx.message.body.attachments) || [];
        const photo = attachments.find(a => a.type === 'image');
        if (!photo) {
            await ctx.reply('Пожалуйста, отправьте фото.');
            return;
        }
        setState(userId, { step: 'idle' });
        const { btnUrl: photoBtnUrl, btnText: photoBtnText, cleanText: photoCleanText } = extractLink(ctx.message && ctx.message.body, text);
        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                const msgAttachments = [{ type: 'image', payload: { token: photo.payload.token } }];
                if (photoBtnUrl) msgAttachments.push(Keyboard.inlineKeyboard([[Keyboard.button.link(photoBtnText, photoBtnUrl)]]));
                await bot.api.sendMessageToUser(uid, photoCleanText || '', { attachments: msgAttachments });
                sent++;
            } catch (e) {
                console.error('broadcast photo error:', uid, e.message);
                failed++;
            }
        }
        await ctx.reply(`✅ Рассылка завершена!\n📤 Отправлено: ${sent}\n❌ Ошибок: ${failed}`, {
            attachments: [adminKeyboard],
        });
        return;
    }

    if (state.step === 'admin_broadcast_video' && userId === ADMIN_ID) {
        const attachments = (ctx.message && ctx.message.body && ctx.message.body.attachments) || [];
        const video = attachments.find(a => a.type === 'video');
        if (!video) {
            await ctx.reply('Пожалуйста, отправьте видео.');
            return;
        }
        setState(userId, { step: 'idle' });
        const { btnUrl: videoBtnUrl, btnText: videoBtnText, cleanText: videoCleanText } = extractLink(ctx.message && ctx.message.body, text);
        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                const msgAttachments = [{ type: 'video', payload: { token: video.payload.token } }];
                if (videoBtnUrl) msgAttachments.push(Keyboard.inlineKeyboard([[Keyboard.button.link(videoBtnText, videoBtnUrl)]]));
                await bot.api.sendMessageToUser(uid, videoCleanText || '', { attachments: msgAttachments });
                sent++;
            } catch (e) {
                console.error('broadcast video error:', uid, e.message);
                failed++;
            }
        }
        await ctx.reply(`✅ Рассылка завершена!\n📤 Отправлено: ${sent}\n❌ Ошибок: ${failed}`, {
            attachments: [adminKeyboard],
        });
        return;
    }

    if (!text) return;

    await showMenu(ctx);
});

bot.start();
console.log('✅ ОСАГО бот запущен!');
