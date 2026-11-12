import 'dotenv/config';
import { Bot, InlineKeyboard, Keyboard, InputFile, GrammyError } from 'grammy';
import fs from 'fs';
import { fileURLToPath } from 'url';

const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID || '0');
const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://max.ru/prostorabotaru';
const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK || '';
// Сжатая копия img.png (~110 КБ): тяжёлый PNG на 1.8 МБ не успевает загрузиться в Telegram
// Путь строкой: URL-объект grammy ошибочно пытается скачать через fetch ("Only absolute URLs are supported")
const BANNER_FILE = fileURLToPath(new URL('./banner.jpg', import.meta.url));

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function sendToBitrix(data, job) {
    if (!BITRIX_WEBHOOK) return;
    const url = `${BITRIX_WEBHOOK}/crm.lead.add`;
    const jobTitle = ((job && job.title) || data.selectedJob || '—').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    const source = 'Бот Telegram ЯндексЕда';
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
        SOURCE_DESCRIPTION: source,
        ADDRESS_CITY: data.city,
        COMMENTS:
            `Источник: ${source}\n` +
            `Вакансия: ${jobTitle}\n` +
            `ФИО: ${data.fio}\n` +
            `Город: ${data.city}\n` +
            `Возраст: ${data.age}\n` +
            `Email: ${data.email}\n` +
            `Гражданство: ${data.citizenship}\n` +
            `Telegram: ${data.username ? '@' + data.username : data.userId}`,
        UF_CRM_1777750252: jobTitle,
        UF_CRM_1777750300: data.age,
        UF_CRM_1777750316: data.citizenship,
        UF_CRM_1777750988: data.fio,
        UF_CRM_1777750997: data.city,
        UF_CRM_1777751018: source,
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

// Ищет первую ссылку в сообщении (entities Telegram или голый URL) и выносит её в кнопку
function extractLink(text, entities) {
    if (!text) return { btnUrl: null, btnText: null, cleanText: text };
    const link = (entities || []).find(e => e.type === 'text_link' || e.type === 'url');
    if (link) {
        const linkText = text.substr(link.offset, link.length);
        const btnUrl = link.type === 'text_link' ? link.url : linkText;
        const btnText = (link.type === 'text_link' && linkText.trim()) || '👉 Перейти по ссылке';
        const cleanText = (text.substring(0, link.offset) + text.substring(link.offset + link.length)).trim();
        return { btnUrl, btnText, cleanText };
    }
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        return { btnUrl: urlMatch[0], btnText: '👉 Перейти по ссылке', cleanText: text.replace(urlMatch[0], '').trim() };
    }
    return { btnUrl: null, btnText: null, cleanText: text };
}

// Редактирует сообщение с кнопкой; если это невозможно (фото, старое сообщение) — шлёт новое
async function editOrReply(ctx, text, extra = {}) {
    try {
        await ctx.editMessageText(text, extra);
    } catch (e) {
        if (e instanceof GrammyError && e.description.includes('message is not modified')) return;
        await ctx.reply(text, extra);
    }
}

// ─── Клавиатуры ───────────────────────────────────────────────────────────────

function getJobKeyboard(userId) {
    const kb = new InlineKeyboard()
        .text('🚶 Пеший курьер', 'job_foot_courier').text('🚴 Велокурьер', 'job_bike_courier').row()
        .text('🚗 Автокурьер', 'job_auto_courier').text('🏠 В меню', 'menu');
    if (userId === ADMIN_ID) kb.row().text('⚙️ Админ-панель', 'admin_panel');
    return kb;
}

const menuKeyboard = new InlineKeyboard().text('🏠 Меню', 'menu');

const phoneKeyboard = new Keyboard()
    .requestContact('📱 Отправить номер телефона')
    .resized()
    .oneTime();

function jobConfirmKeyboard(jobKey) {
    return new InlineKeyboard()
        .text('Согласен, продолжить ▶', `confirm_${jobKey}`).row()
        .text('◀ Назад', 'menu');
}

const adminKeyboard = new InlineKeyboard()
    .text('📊 Статистика', 'admin_stats').row()
    .text('📢 Рассылка', 'admin_broadcast').row()
    .text('🏠 В меню', 'menu');

const broadcastTypeKeyboard = new InlineKeyboard()
    .text('Текст', 'broadcast_text').row()
    .text('Фото + текст', 'broadcast_photo').row()
    .text('Видео + текст', 'broadcast_video').row()
    .text('◀ Назад', 'admin_panel');

const broadcastBackKeyboard = new InlineKeyboard().text('◀ Назад', 'admin_broadcast');

// ─── Главное меню ─────────────────────────────────────────────────────────────

async function showMenu(ctx, edit = false) {
    trackUser(ctx.from.id);
    await showStartMenu(ctx, edit);
}

// ─── /start ───────────────────────────────────────────────────────────────────

// file_id баннера: из BANNER_FILE_ID в .env или после первой загрузки — чтобы не грузить файл каждый раз
let bannerFileId = process.env.BANNER_FILE_ID || null;

async function handleStart(ctx) {
    const userId = ctx.from.id;
    trackUser(userId);
    setState(userId, { step: 'idle' });

    try {
        const msg = await ctx.replyWithPhoto(bannerFileId || new InputFile(BANNER_FILE), {
            reply_markup: { remove_keyboard: true },
        });
        if (!bannerFileId) {
            bannerFileId = msg.photo[msg.photo.length - 1].file_id;
            console.log('Баннер загружен, BANNER_FILE_ID =', bannerFileId);
        }
    } catch (e) {
        console.error('Banner photo error:', e.message, e.error ? e.error.message || e.error : '');
    }

    await showStartMenu(ctx);
}

bot.command('start', handleStart);

// Убираем «часики» на кнопке после любого callback
bot.on('callback_query:data', async (ctx, next) => {
    await next();
    await ctx.answerCallbackQuery().catch(() => {});
});

// ─── Стартовое меню и топ-вакансии ───────────────────────────────────────────

const SELF_REG_LINK = 'https://reg.eda.yandex.ru/?advertisement_campaign=forms_for_agents&user_invite_code=1554eafb14ff442faf47d25ea1da4dab&utm_content=blank&utm_campaign=tgbot';

const TOP_JOBS = [
    {
        title: '📦 Кладовщик — Яндекс Лавка',
        url: 'https://forms.yandex.ru/surveys/13772545.48faecb25aa340921af8ef66633ff921ebe9d35e/?campaign=forms_for_agents&referral_code=cukinaarina',
    },
    {
        title: '📦 Кладовщик — Яндекс Маркет',
        url: 'https://forms.yandex.ru/surveys/13916260.3aadc38b7fad3d17d248c5a9b1a59de1e2635b49/?utm_campaign=yaeda&utm_content=cukinaarina&utm_medium=&utm_term=',
    },
    {
        title: '🚚 Водитель-курьер на грузовом авто',
        url: 'https://forms.yandex.ru/surveys/13884444.0874de62dbe30ef1af2aa9637228d4e4511f9277/?utm_source=partner&utm_content=cukinaarina',
    },
    {
        title: '⏱ Подработка — смены',
        url: 'https://forms.yandex.ru/surveys/13481168.7fea6d48affc7f446a50d154a1871c925b2c22be/?utm_source=main_landing&utm_medium=yandexeda&utm_content=cukinaarina&page=1',
    },
];

const START_TEXT =
    '💛 Работа с партнером Яндекса — выбирай своё направление!\n\n' +
    'Помогаем найти работу и подработку.\n\n' +
    'Здесь ты можешь самостоятельно зарегистрироваться, выбрать одну из популярных вакансий или посмотреть ещё больше предложений.\n\n' +
    '👇 Выбирай подходящий вариант!';

function getStartKeyboard(userId) {
    const kb = new InlineKeyboard()
        .url('💛 Самостоятельная регистрация', SELF_REG_LINK).row()
        .text('🔥 Другие топ-вакансии от Яндекса', 'top_jobs').row()
        .url('📢 Множество других вакансий', CHANNEL_LINK);
    if (userId === ADMIN_ID) kb.row().text('⚙️ Админ-панель', 'admin_panel');
    return kb;
}

const topJobsKeyboard = new InlineKeyboard();
for (const job of TOP_JOBS) topJobsKeyboard.url(job.title, job.url).row();
topJobsKeyboard.text('⬅️ Назад в главное меню', 'start_menu');

async function showStartMenu(ctx, edit = false) {
    const userId = ctx.from.id;
    setState(userId, { step: 'idle' });
    const keyboard = getStartKeyboard(userId);
    if (edit) {
        await editOrReply(ctx, START_TEXT, { reply_markup: keyboard });
    } else {
        await ctx.reply(START_TEXT, { reply_markup: keyboard });
    }
}

bot.callbackQuery('top_jobs', async (ctx) => {
    await editOrReply(ctx, '🔥 Популярные вакансии Яндекса\n\nВыбирай вакансию, которая тебе подходит:', {
        reply_markup: topJobsKeyboard,
    });
});

bot.callbackQuery('start_menu', async (ctx) => {
    await showStartMenu(ctx, true);
});

// ─── Действия ─────────────────────────────────────────────────────────────────

bot.callbackQuery('contact_manager', async (ctx) => {
    await editOrReply(ctx, 'Наш менеджер свяжется с вами в ближайшее время! 📞\n\nПока вы ждёте — можете ознакомиться с нашими вакансиями 👇', {
        reply_markup: getJobKeyboard(ctx.from.id),
    });
});

bot.callbackQuery('menu', async (ctx) => {
    await showMenu(ctx, true);
});

// ─── Вакансии ─────────────────────────────────────────────────────────────────

for (const [jobKey, job] of Object.entries(JOBS)) {
    bot.callbackQuery(`job_${jobKey}`, async (ctx) => {
        setState(ctx.from.id, { step: 'viewing', selectedJob: jobKey });
        await editOrReply(ctx, job.description, { reply_markup: jobConfirmKeyboard(jobKey) });
    });

    bot.callbackQuery(`confirm_${jobKey}`, async (ctx) => {
        setState(ctx.from.id, { step: 'consent', selectedJob: jobKey });
        await editOrReply(
            ctx,
            '🔒 Ваши данные под защитой\n\n' +
            'Мы обрабатываем ваши персональные данные в соответствии с Федеральным законом №152-ФЗ «О персональных данных».\n\n' +
            'Перед началом, пожалуйста, ознакомьтесь с нашими документами:\n\n' +
            '📄 <a href="https://disk.yandex.ru/d/k4c4N8dtZSYhBQ">Политика конфиденциальности</a>\n' +
            '✍️ <a href="https://disk.yandex.ru/d/k4c4N8dtZSYhBQ">Согласие на обработку данных</a>',
            {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
                reply_markup: new InlineKeyboard()
                    .text('Ознакомлен и согласен!', `consent_ok_${jobKey}`).row()
                    .text('◀ Назад', 'menu'),
            }
        );
    });

    bot.callbackQuery(`consent_ok_${jobKey}`, async (ctx) => {
        await editOrReply(ctx, 'Введите ваши Фамилию, Имя и Отчество 👇', { reply_markup: menuKeyboard });
        setState(ctx.from.id, { step: 'fio', selectedJob: jobKey });
    });
}

// ─── Админ-панель ─────────────────────────────────────────────────────────────

bot.callbackQuery('admin_panel', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    setState(ctx.from.id, { step: 'idle' });
    await editOrReply(ctx, 'Добро пожаловать в админ-панель!\n\nВыберите действие:', { reply_markup: adminKeyboard });
});

bot.callbackQuery('admin_stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await editOrReply(ctx, `📊 Статистика\n\n👥 Всего пользователей: ${users.size}`, { reply_markup: adminKeyboard });
});

bot.callbackQuery('admin_broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    setState(ctx.from.id, { step: 'idle' });
    await editOrReply(ctx, 'Выберите, какую именно рассылку вы хотите запустить:', { reply_markup: broadcastTypeKeyboard });
});

bot.callbackQuery('broadcast_text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    setState(ctx.from.id, { step: 'admin_broadcast_text' });
    await editOrReply(ctx, 'Введите текст для рассылки 👇', { reply_markup: broadcastBackKeyboard });
});

bot.callbackQuery('broadcast_photo', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    setState(ctx.from.id, { step: 'admin_broadcast_photo' });
    await ctx.reply('Отправьте фото с подписью (или без) 👇', { reply_markup: broadcastBackKeyboard });
});

bot.callbackQuery('broadcast_video', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    setState(ctx.from.id, { step: 'admin_broadcast_video' });
    await ctx.reply('Отправьте видео с подписью (или без) 👇', { reply_markup: broadcastBackKeyboard });
});

// Рассылка всем пользователям; send(uid) отправляет одно сообщение
async function broadcast(ctx, send) {
    let sent = 0, failed = 0;
    for (const uid of users) {
        if (uid === ADMIN_ID) continue;
        try {
            await send(uid);
            sent++;
        } catch (e) {
            console.error('broadcast error:', uid, e.message);
            failed++;
        }
        await sleep(50); // лимит Telegram ~30 сообщений в секунду
    }
    await ctx.reply(`✅ Рассылка завершена!\n📤 Отправлено: ${sent}\n❌ Ошибок: ${failed}`, {
        reply_markup: adminKeyboard,
    });
}

function linkButton(btnText, btnUrl) {
    return btnUrl ? new InlineKeyboard().url(btnText, btnUrl) : undefined;
}

// После анкеты: через минуту — напоминание о канале, ещё через минуту — снова стартовое меню.
// Не через await: grammy обрабатывает апдейты по очереди, и пауза заблокировала бы бота для всех.
function scheduleFollowUp(ctx) {
    setTimeout(async () => {
        try {
            await ctx.reply(
                '🥲 Вы не подписались на канал!\n\n☺️ Для доступа к боту нужно подписаться на канал ПРОСТО РАБОТА',
                { reply_markup: new InlineKeyboard().url('✅ Подписаться', CHANNEL_LINK) }
            );
            await sleep(60000);
            await handleStart(ctx);
        } catch (e) {
            console.error('follow-up error:', ctx.from.id, e.message);
        }
    }, 60000);
}

// ─── Обработка сообщений ──────────────────────────────────────────────────────

bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    trackUser(userId);
    const msg = ctx.message;
    const text = msg.text;
    const state = getState(userId);

    // Рассылка: текст
    if (state.step === 'admin_broadcast_text' && userId === ADMIN_ID) {
        if (!text) {
            await ctx.reply('Пожалуйста, отправьте текстовое сообщение.');
            return;
        }
        setState(userId, { step: 'idle' });
        const { btnUrl, btnText, cleanText } = extractLink(text, msg.entities);
        await broadcast(ctx, (uid) => btnUrl
            ? bot.api.sendMessage(uid, cleanText || text, { reply_markup: linkButton(btnText, btnUrl) })
            : bot.api.sendMessage(uid, text, { entities: msg.entities }));
        return;
    }

    // Рассылка: фото + текст
    if (state.step === 'admin_broadcast_photo' && userId === ADMIN_ID) {
        if (!msg.photo) {
            await ctx.reply('Пожалуйста, отправьте фото.');
            return;
        }
        setState(userId, { step: 'idle' });
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const { btnUrl, btnText, cleanText } = extractLink(msg.caption, msg.caption_entities);
        await broadcast(ctx, (uid) => bot.api.sendPhoto(uid, fileId, {
            caption: cleanText || undefined,
            reply_markup: linkButton(btnText, btnUrl),
        }));
        return;
    }

    // Рассылка: видео + текст
    if (state.step === 'admin_broadcast_video' && userId === ADMIN_ID) {
        if (!msg.video) {
            await ctx.reply('Пожалуйста, отправьте видео.');
            return;
        }
        setState(userId, { step: 'idle' });
        const fileId = msg.video.file_id;
        const { btnUrl, btnText, cleanText } = extractLink(msg.caption, msg.caption_entities);
        await broadcast(ctx, (uid) => bot.api.sendVideo(uid, fileId, {
            caption: cleanText || undefined,
            reply_markup: linkButton(btnText, btnUrl),
        }));
        return;
    }

    // Номер телефона через кнопку «Отправить номер»
    if (state.step === 'phone' && msg.contact) {
        setState(userId, { ...state, step: 'age', phone: msg.contact.phone_number });
        await ctx.reply('Введите ваш возраст 👇', { reply_markup: { remove_keyboard: true } });
        return;
    }

    if (!text) return;

    switch (state.step) {
        case 'fio':
            setState(userId, { ...state, step: 'city', fio: text });
            await ctx.reply('Введите город, в котором вы ищете работу 👇', { reply_markup: menuKeyboard });
            break;

        case 'city':
            setState(userId, { ...state, step: 'phone', city: text });
            await ctx.reply('Введите ваш номер телефона 👇\n\nВы можете ввести его вручную или отправить с помощью соответствующей кнопки', { reply_markup: phoneKeyboard });
            break;

        case 'phone':
            setState(userId, { ...state, step: 'age', phone: text });
            await ctx.reply('Введите ваш возраст 👇', { reply_markup: { remove_keyboard: true } });
            break;

        case 'age':
            setState(userId, { ...state, step: 'email', age: text });
            await ctx.reply('Введите ваш E-Mail адрес 👇', { reply_markup: menuKeyboard });
            break;

        case 'email': {
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
            if (!emailValid) {
                await ctx.reply('❌ Некорректный e-mail. Введите правильный адрес (например: name@mail.ru) 👇', { reply_markup: menuKeyboard });
                break;
            }
            setState(userId, { ...state, step: 'citizenship', email: text });
            await ctx.reply('Какое у вас Гражданство 👇', { reply_markup: menuKeyboard });
            break;
        }

        case 'citizenship': {
            const data = { ...state, citizenship: text, step: 'done', userId, username: ctx.from.username };
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
                { reply_markup: new InlineKeyboard().url('Вступить в группу', CHANNEL_LINK) }
            );

            scheduleFollowUp(ctx);
            break;
        }

        default:
            await showMenu(ctx);
    }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────

bot.catch((err) => {
    console.error(`Ошибка при обработке update ${err.ctx.update.update_id}:`, err.error);
});

bot.api.setMyCommands([{ command: 'start', description: 'Запустить бот' }])
    .catch((e) => console.error('Не удалось установить команды бота:', e.message));

bot.start({
    onStart: (me) => console.log(`✅ Яндекс Telegram-бот запущен: @${me.username}`),
});
