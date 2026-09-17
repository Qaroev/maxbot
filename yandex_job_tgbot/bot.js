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
const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://max.ru/prostorabotaru';

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

// ─── Вакансии ────────────────────────────────────────────────────────────────

const JOBS = {
    foot_courier: {
        title: '🚶 Пеший курьер',
        description:
            '🚶 Пеший курьер\n\n' +
            'Основные обязанности:\n' +
            '* Доставка заказов в радиусе 3 км\n' +
            '* Работа с приложением для получения заказов\n' +
            '* Коммуникация с клиентами\n' +
            '* Соблюдение стандартов компании\n\n' +
            'Условия работы:\n' +
            '* График - от 3 часов в день\n' +
            '* Оплата - до 480₽ в час\n' +
            '* Средний заработок - 5800₽ за смену\n' +
            '* Выплаты - раз в неделю\n' +
            '* Территория - в пределах 3 км от пункта выдачи',
    },
    bike_courier: {
        title: '🚴 Велокурьер',
        description:
            '🚴 Велокурьер\n\n' +
            'Основные обязанности:\n' +
            '* Доставка заказов в радиусе 5 км\n' +
            '* Работа с приложением для получения заказов\n' +
            '* Коммуникация с клиентами\n' +
            '* Соблюдение стандартов компании\n\n' +
            'Условия работы:\n' +
            '* График - от 3 часов в день\n' +
            '* Оплата - до 520₽ в час\n' +
            '* Средний заработок - 6500₽ за смену\n' +
            '* Выплаты - раз в неделю\n' +
            '* Нужен собственный велосипед',
    },
    auto_courier: {
        title: '🚗 Автокурьер',
        description:
            '🚗 Автокурьер\n\n' +
            'Основные обязанности:\n' +
            '* Доставка заказов по городу\n' +
            '* Работа с приложением для получения заказов\n' +
            '* Коммуникация с клиентами\n' +
            '* Соблюдение стандартов компании\n\n' +
            'Условия работы:\n' +
            '* График - от 4 часов в день\n' +
            '* Оплата - до 600₽ в час\n' +
            '* Средний заработок - 8000₽ за смену\n' +
            '* Выплаты - раз в неделю\n' +
            '* Нужен собственный автомобиль',
    },
};

// ─── Bitrix24 ─────────────────────────────────────────────────────────────────

const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK || 'https://b24-hjgutj.bitrix24.ru/rest/1/uly0yxxwby5qitzv';

async function sendToBitrix(data, job) {
    const url = `${BITRIX_WEBHOOK}/crm.lead.add`;
    const jobTitle = ((job && job.title) || data.selectedJob || '—').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    console.log('Отправка в Bitrix:', {
        fio: data.fio,
        phone: data.phone,
        city: data.city,
        age: data.age,
        email: data.email,
        citizenship: data.citizenship,
        job: jobTitle,
    });
    const fields = {
        TITLE: `${jobTitle} — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: data.email, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'OTHER',
        SOURCE_DESCRIPTION: 'Бот Max ЯндексЕда',
        ADDRESS_CITY: data.city,
        COMMENTS:
            `Источник: Бот Max ЯндексЕда\n` +
            `Вакансия: ${jobTitle}\n` +
            `ФИО: ${data.fio}\n` +
            `Город: ${data.city}\n` +
            `Возраст: ${data.age}\n` +
            `Email: ${data.email}\n` +
            `Гражданство: ${data.citizenship}`,
        UF_CRM_1777750252: jobTitle,
        UF_CRM_1777750300: data.age,
        UF_CRM_1777750316: data.citizenship,
        UF_CRM_1777750988: data.fio,
        UF_CRM_1777750997: data.city,
        UF_CRM_1777751018: 'Бот Max ЯндексЕда',
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
    return result;
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

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

// ─── Клавиатуры ───────────────────────────────────────────────────────────────

function getJobKeyboard(userId) {
    const rows = [
        [
            Keyboard.button.callback('🚶 Пеший курьер', 'job_foot_courier'),
            Keyboard.button.callback('🚴 Велокурьер', 'job_bike_courier'),
        ],
        [
            Keyboard.button.callback('🚗 Автокурьер', 'job_auto_courier'),
            Keyboard.button.callback('🏠 В меню', 'menu'),
        ],
    ];
    if (userId === ADMIN_ID) {
        rows.push([Keyboard.button.callback('⚙️ Админ-панель', 'admin_panel')]);
    }
    return Keyboard.inlineKeyboard(rows);
}

const menuKeyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback('🏠 Меню', 'menu')]]);

function jobConfirmKeyboard(jobKey) {
    return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Согласен, продолжить ▶', `confirm_${jobKey}`)],
        [Keyboard.button.callback('◀ Назад', 'menu')],
    ]);
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

// ─── Главное меню ─────────────────────────────────────────────────────────────

async function showMenu(ctx, edit = false) {
    const userId = ctx.user.user_id;
    trackUser(userId);
    setState(userId, { step: 'idle' });
    const text = 'У нас открыты несколько интересных вакансий 🔥\n\n🔍 Ищете работу? Выберите вакансию, которая вам подходит! 😊';
    const keyboard = getJobKeyboard(userId);
    if (edit) {
        await ctx.editMessage({ text, attachments: [keyboard] });
    } else {
        await ctx.reply(text, { attachments: [keyboard] });
    }
}

// ─── /start и bot_started ─────────────────────────────────────────────────────

async function handleStart(ctx) {
    const userId = ctx.user.user_id;
    trackUser(userId);
    setState(userId, { step: 'idle' });
    await ctx.reply(
        '👋 Привет!\n' +
        'Добро пожаловать в бот для трудоустройства к партнёру ЯндексЕда.\n\n' +
        '✅ Ежедневные выплаты\n' +
        '✅ Быстрая регистрация\n\n' +
        'Выберите удобный для вас способ регистрации:',
        {
            attachments: [
                Keyboard.inlineKeyboard([
                    [Keyboard.button.link('💠 Самостоятельная регистрация', 'https://reg.eda.yandex.ru/?advertisement_campaign=forms_for_agents&user_invite_code=1554eafb14ff442faf47d25ea1da4dab&utm_content=blank&utm_campaign=maxbot')],
                    [Keyboard.button.callback('💠 Хочу связаться с менеджером', 'contact_manager')],
                ]),
            ],
        }
    );
}

bot.on('bot_started', handleStart);

// ─── Действия ─────────────────────────────────────────────────────────────────

bot.action('contact_manager', async (ctx) => {
    const userId = ctx.user.user_id;
    await ctx.editMessage({
        text: 'Наш менеджер свяжется с вами в ближайшее время! 📞\n\nПока вы ждёте — можете ознакомиться с нашими вакансиями 👇',
        attachments: [getJobKeyboard(userId)],
    });
});

bot.action('menu', async (ctx) => {
    await showMenu(ctx, true);
});

// ─── Вакансии ─────────────────────────────────────────────────────────────────

for (const [jobKey, job] of Object.entries(JOBS)) {
    bot.action(`job_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, { step: 'viewing', selectedJob: jobKey });
        await ctx.editMessage({ text: job.description, attachments: [jobConfirmKeyboard(jobKey)] });
    });

    bot.action(`confirm_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, { step: 'consent', selectedJob: jobKey });
        await ctx.editMessage({
            text:
                '🔒 Ваши данные под защитой\n\n' +
                'Мы обрабатываем ваши персональные данные в соответствии с Федеральным законом №152-ФЗ «О персональных данных».\n\n' +
                'Перед началом, пожалуйста, ознакомьтесь с нашими документами:\n\n' +
                '📄 [Политика конфиденциальности](https://disk.yandex.ru/d/k4c4N8dtZSYhBQ)\n' +
                '✍️ [Согласие на обработку данных](https://disk.yandex.ru/d/k4c4N8dtZSYhBQ)',
            attachments: [
                Keyboard.inlineKeyboard([
                    [Keyboard.button.callback('Ознакомлен и согласен!', `consent_ok_${jobKey}`)],
                    [Keyboard.button.callback('◀ Назад', 'menu')],
                ]),
            ],
        });
    });

    bot.action(`consent_ok_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        await ctx.editMessage({ text: 'Введите ваши Фамилию, Имя и Отчество 👇', attachments: [menuKeyboard] });
        setState(userId, { step: 'fio', selectedJob: jobKey });
    });
}

// ─── Админ-панель ─────────────────────────────────────────────────────────────

bot.action('admin_panel', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'idle' });
    await ctx.editMessage({
        text: 'Добро пожаловать в админ-панель!\n\nВыберите действие:',
        attachments: [adminKeyboard],
    });
});

bot.action('admin_stats', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    await ctx.editMessage({
        text: `📊 Статистика\n\n👥 Всего пользователей: ${users.size}`,
        attachments: [adminKeyboard],
    });
});

bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'idle' });
    await ctx.editMessage({
        text: 'Выберите, какую именно рассылку вы хотите запустить:',
        attachments: [broadcastTypeKeyboard],
    });
});

bot.action('broadcast_text', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, { step: 'admin_broadcast_text' });
    await ctx.editMessage({
        text: 'Введите текст для рассылки 👇',
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

// ─── Обработка сообщений ──────────────────────────────────────────────────────

bot.on('message_created', async (ctx) => {
    const userId = ctx.user.user_id;
    trackUser(userId);
    const text = ctx.message && ctx.message.body && ctx.message.body.text;
    const state = getState(userId);

    // Рассылка: текст
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

    // Рассылка: фото + текст
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

    // Рассылка: видео + текст
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

    switch (state.step) {
        case 'fio':
            setState(userId, { ...state, step: 'city', fio: text });
            await ctx.reply('Введите город, в котором вы ищете работу 👇', { attachments: [menuKeyboard] });
            break;

        case 'city':
            setState(userId, { ...state, step: 'phone', city: text });
            await ctx.reply('Введите ваш номер телефона 👇\n\nВы можете ввести его вручную или отправить с помощью соответствующей кнопки', { attachments: [menuKeyboard] });
            break;

        case 'phone':
            setState(userId, { ...state, step: 'age', phone: text });
            await ctx.reply('Введите ваш возраст 👇', { attachments: [menuKeyboard] });
            break;

        case 'age':
            setState(userId, { ...state, step: 'email', age: text });
            await ctx.reply('Введите ваш E-Mail адрес 👇', { attachments: [menuKeyboard] });
            break;

        case 'email': {
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
            if (!emailValid) {
                await ctx.reply('❌ Некорректный e-mail. Введите правильный адрес (например: name@mail.ru) 👇', { attachments: [menuKeyboard] });
                break;
            }
            setState(userId, { ...state, step: 'citizenship', email: text });
            await ctx.reply('Какое у вас Гражданство 👇', { attachments: [menuKeyboard] });
            break;
        }

        case 'citizenship': {
            const data = { ...state, citizenship: text, step: 'done' };
            setState(userId, data);
            const job = JOBS[data.selectedJob];
            try {
                await sendToBitrix(data, job);
            } catch (e) {
                console.error('Ошибка отправки в Bitrix:', e.message);
            }

            await ctx.reply(
                '🎉 Анкета заполнена! 🎉\n\n' +
                'Спасибо, что потратили время! Мы уже отправили вашу информацию в нужные руки, ' +
                'и совсем скоро с вами свяжется наш менеджер, чтобы обсудить все детали. 📞\n\n' +
                'Будьте готовы к интересным предложениям — мы скоро на связи! 😎',
                {
                    attachments: [
                        Keyboard.inlineKeyboard([
                            [Keyboard.button.link('Вступить в группу', CHANNEL_LINK)],
                        ]),
                    ],
                }
            );

            await new Promise(resolve => setTimeout(resolve, 60000));

            await ctx.reply(
                '🥲 Вы не подписались на канал!\n\n☺️ Для доступа к боту нужно подписаться на канал ПРОСТО РАБОТА',
                {
                    attachments: [
                        Keyboard.inlineKeyboard([
                            [Keyboard.button.link('✅ Подписаться', CHANNEL_LINK)],
                        ]),
                    ],
                }
            );

            await new Promise(resolve => setTimeout(resolve, 60000));

            await handleStart(ctx);
            break;
        }

        default:
            await showMenu(ctx);
    }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────

bot.start();
console.log('✅ Max бот запущен!');
