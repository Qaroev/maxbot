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
        parent: 'courier',
        description:
            '🕐 График работы:\n' +
            'Свободный — выбирайте смены под себя!\n\n' +
            '📋 Обязанности курьера:\n' +
            '• Доставка продуктов покупателям\n' +
            '• Работа в пешем, вело или авто-формате\n' +
            '• Максимальный вес заказа — до 20 кг\n\n' +
            '📍 Радиус доставки:\n' +
            '🚶 Пешком — 1,5–2 км\n' +
            '🚴 Вело — 1,5–3 км\n' +
            '🚗 Авто — 5–10 км\n\n' +
            '✅ Требования:\n' +
            '• Ответственность и аккуратность\n' +
            '• Готовность к физнагрузке\n' +
            '• Умение работать в команде\n' +
            '• Знание русского языка (умение читать)\n' +
            '• Телефон на Android (от версии 7.0)\n\n' +
            '🧥 Экипировка:\n' +
            'На складе каждому курьеру выдаётся:\n' +
            '👕 Куртка\n' +
            '🎒 Рюкзак',
    },
    bike_courier: {
        title: '🚲 Вело/электро/мото курьер',
        parent: 'courier',
        description:
            '🚲 Вело/электро/мото курьер\n\n' +
            '🕐 График работы:\n' +
            'Свободный — выбирайте смены под себя!\n\n' +
            '📋 Обязанности:\n' +
            '• Доставка продуктов покупателям\n' +
            '• Максимальный вес заказа — до 20 кг\n' +
            '• Работа с приложением для получения заказов\n\n' +
            '📍 Радиус доставки:\n' +
            '🚴 Вело/электро — 1,5–3 км\n' +
            '🛵 Мото — 3–7 км\n\n' +
            '✅ Требования:\n' +
            '• Наличие велосипеда, электровелосипеда или мотоцикла\n' +
            '• Ответственность и аккуратность\n' +
            '• Телефон на Android (от версии 7.0)\n\n' +
            '🧥 Экипировка:\n' +
            'На складе каждому курьеру выдаётся:\n' +
            '👕 Куртка\n' +
            '🎒 Рюкзак',
    },
    auto_courier: {
        title: '🚛 Авто курьер',
        parent: 'courier',
        description:
            '🚛 Авто курьер\n\n' +
            '🕐 График работы:\n' +
            'Свободный — выбирайте смены под себя!\n\n' +
            '📋 Обязанности:\n' +
            '• Доставка продуктов покупателям на автомобиле\n' +
            '• Максимальный вес заказа — до 50 кг\n' +
            '• Работа с приложением для получения заказов\n\n' +
            '📍 Радиус доставки:\n' +
            '🚗 Авто — 5–10 км\n\n' +
            '✅ Требования:\n' +
            '• Наличие собственного автомобиля\n' +
            '• Водительское удостоверение категории B\n' +
            '• Ответственность и аккуратность\n' +
            '• Телефон на Android (от версии 7.0)\n\n' +
            '🧥 Экипировка:\n' +
            'На складе каждому курьеру выдаётся:\n' +
            '👕 Куртка\n' +
            '🎒 Рюкзак',
    },
    picker: {
        title: '📦 Сборщик',
        description:
            '🏆 Вакансия: Сборщик заказов (ЦФЗ)\n\n' +
            '🔧 Работа со сканером-кольцом и телефоном — ничего сложного, всему обучим!\n\n' +
            '⏰ График смен:\n' +
            '6 / 8 / 10 / 12 / 15 часов\n' +
            '📅 Можно выходить по выходным или только по вечерам\n' +
            '📌 Форматы занятости:\n' +
            '☐ Полная\n' +
            '☐ Частичная\n' +
            '☐ Подработка от 4 часов\n\n' +
            '👤 Что нужно делать:\n' +
            '• Собирать заказы по категориям (не адресное хранение)\n' +
            '• Быстро ориентироваться на складе\n' +
            '• Знать ассортимент (научим!)\n\n' +
            '🎁 Преимущества:\n' +
            '1️⃣ Удобная маршрутизация по стеллажам\n' +
            '2️⃣ Стабильные выплаты — раз в неделю, по четвергам\n' +
            '3️⃣ Гибкий график — подбираем под вас\n' +
            '4️⃣ Только оплаченные заказы (никаких примерок)\n' +
            '5️⃣ Почасовая оплата\n' +
            '6️⃣ Карьерный рост — более 50% директоров ЦФЗ начали с этой позиции\n' +
            '7️⃣ Самозанятые — в приоритете',
    },
    scanner: {
        title: '🔍 Сканировщик',
        description:
            '🔍 Вакансия: Сканировщик\n\n' +
            '📋 Обязанности:\n' +
            '• Пересчёт товаров на складе\n' +
            '• Работа со сканером штрих-кодов\n' +
            '• Контроль наличия товаров\n' +
            '• Ведение отчётности\n\n' +
            '⏰ График работы:\n' +
            '📅 Смены: 8 или 12 часов\n' +
            '🔄 Режимы: 5/2 или 4/3\n\n' +
            '🏢 Условия:\n' +
            '✅ Без опыта — всему обучим!\n' +
            '✅ Официальное оформление\n' +
            '✅ Стабильные выплаты — раз в неделю\n' +
            '✅ Бесплатная форма\n' +
            '📋 Заработная плата — еженедельно, на карту любого банка',
    },
    kitchen: {
        title: '👨‍🍳 Работник кухни',
        description:
            '🍳 Вакансия: Работник кухни\n\n' +
            '🧾 Обязанности:\n' +
            '• Приготовление блюд по технологическим картам\n' +
            '• Разогрев готовой продукции (из охлаждённых или замороженных заготовок)\n' +
            '• Контроль качества готовых блюд\n' +
            '• Подготовка и заготовка продуктов\n\n' +
            '⏰ График работы:\n' +
            '📅 Смены: 8 или 12 часов\n' +
            '🔄 Режимы: 5/2 или 4/3\n' +
            '🌙 Работа возможна до 00:00\n\n' +
            '🏢 Условия:\n' +
            '✅ Официальное оформление\n' +
            '✅ Без опыта — всему обучим!\n' +
            '✅ Личная медкнижка обязательна (если нет — дадим скидку на оформление)\n' +
            '✅ Бесплатная форма и инвентарь\n' +
            '📋 Заработная плата — еженедельно, на карту любого банка',
    },
    vakta: {
        title: '😎 ВАХТА 😎',
        description:
            '🔧 Условия работы курьером:\n\n' +
            '📅 Вахта: 30 дней (минимум 30 дней для смен 60/90)\n' +
            '🔄 Радиус работы: до 3 км\n' +
            '⏰ График: 6/1 или 7/0, смены от 12 часов (больше можно, меньше — нет)\n' +
            '⚡ Бесплатная аренда электровелосипеда\n' +
            '🏠 Бесплатное проживание в хостеле\n' +
            '🍎 Промокод на продукты: 1800 рублей каждую неделю\n' +
            '💸 Выплаты каждую среду за отработанную неделю',
    },
};

// ─── Bitrix24 ─────────────────────────────────────────────────────────────────

async function sendToBitrix(data, job) {
    if (!BITRIX_WEBHOOK) return;
    const url = `${BITRIX_WEBHOOK}/crm.lead.add`;
    const jobTitle = ((job && job.title) || data.selectedJob || '—').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    const regTypeLabel = data.registrationType === 'manager' ? 'С помощью менеджера' : 'Самостоятельная регистрация';
    const source = 'Бот Telegram Самокат Партнёр';
    const fields = {
        TITLE: `${jobTitle} — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'OTHER',
        SOURCE_DESCRIPTION: source,
        ADDRESS_CITY: data.city,
        COMMENTS:
            `Источник: ${source}\n` +
            `Способ регистрации: ${regTypeLabel}\n` +
            `Вакансия: ${jobTitle}\n` +
            `ФИО: ${data.fio}\n` +
            `Город: ${data.city}\n` +
            `Возраст: ${data.age}\n` +
            `Гражданство: ${data.citizenship}\n` +
            `Район: ${data.district}\n` +
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
        const btnUrl = link.type === 'text_link' ? link.url : text.substr(link.offset, link.length);
        const cleanText = (text.substring(0, link.offset) + text.substring(link.offset + link.length)).trim();
        return { btnUrl, btnText: '👉 Перейти по ссылке', cleanText };
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

function getMainJobKeyboard(userId) {
    const kb = new InlineKeyboard()
        .text('🚛 Курьер', 'job_courier').text('📦 Сборщик', 'job_picker').row()
        .text('🔍 Сканировщик', 'job_scanner').text('👨‍🍳 Работник кухни', 'job_kitchen').row()
        .text('😎 ВАХТА 😎', 'job_vakta');
    if (userId === ADMIN_ID) kb.row().text('⚙️ Админ-панель', 'admin_panel');
    return kb;
}

const courierSubKeyboard = new InlineKeyboard()
    .text('🚛 Авто курьер', 'job_auto_courier').row()
    .text('🚲 Вело/электро/мото курьер', 'job_bike_courier').row()
    .text('🚶 Пеший курьер', 'job_foot_courier').row()
    .text('◀ Назад', 'menu');

const menuKeyboard = new InlineKeyboard().text('🏠 Меню', 'menu');

const phoneKeyboard = new Keyboard()
    .requestContact('📱 Отправить номер телефона')
    .resized()
    .oneTime();

const SAMOKAT_LINK = 'https://clck.ru/3WD4H5';
const YANDEX_LINK = 'https://ya.cc/t/a2gKSseTBXZTsB';

function getStartKeyboard(userId) {
    const kb = new InlineKeyboard()
        .url('🛵 Самокат', SAMOKAT_LINK).row()
        .url('🚴 Яндекс', YANDEX_LINK).row()
        .url('🔥 Больше вакансий', CHANNEL_LINK);
    if (userId === ADMIN_ID) kb.row().text('⚙️ Админ-панель', 'admin_panel');
    return kb;
}

function jobConfirmKeyboard(jobKey) {
    return new InlineKeyboard()
        .text('Согласен, продолжить ▶', `confirm_${jobKey}`).row()
        .text('◀ Назад', 'back_from_job');
}

function subscriptionKeyboard() {
    return new InlineKeyboard()
        .url('✅ Подписаться', CHANNEL_LINK).row()
        .text('👀 Проверить подписку', 'check_subscription');
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
    const userId = ctx.from.id;
    trackUser(userId);
    setState(userId, { step: 'idle' });
    const text =
        '👋 Привет! Ищешь работу? Поможем начать!\n\n' +
        'У нас есть проверенные варианты трудоустройства у партнёров и актуальные вакансии в разных сферах.\n\n' +
        'Выбирай, что тебе подходит:\n\n' +
        '🛵 Самокат — самостоятельная регистрация и выход на работу.\n\n' +
        '🚴 Яндекс — вакансии для курьеров.\n\n' +
        '🔥 Больше вакансий — смотри новые предложения в нашем канале.\n\n' +
        'Выбирай направление и начинай зарабатывать!';
    const keyboard = getStartKeyboard(userId);
    if (edit) {
        await editOrReply(ctx, text, { reply_markup: keyboard });
    } else {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

async function showJobMenu(ctx, edit = false) {
    const userId = ctx.from.id;
    const text =
        'У нас открыты несколько интересных вакансий:\n\n' +
        '1️⃣ Курьер-доставщик – доставка заказов на автомобиле, велосипеде или пешком.\n' +
        '2️⃣ Сборщик заказов – комплектация заказов в центре выдачи.\n' +
        '3️⃣ Сканировщик – пересчёт товаров на складах.\n' +
        '4️⃣ Работник кухни – приготовление и разогрев блюд.\n' +
        '5️⃣ Вахта – курьерская доставка с проживанием в хостеле.\n\n' +
        '📍 Ищете работу? Выберите вакансию, которая вам подходит! 😊';
    const keyboard = getMainJobKeyboard(userId);
    if (edit) {
        await editOrReply(ctx, text, { reply_markup: keyboard });
    } else {
        await ctx.reply(text, { reply_markup: keyboard });
    }
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

    await showMenu(ctx);
}

bot.command('start', handleStart);

// Убираем «часики» на кнопке после любого callback
bot.on('callback_query:data', async (ctx, next) => {
    await next();
    await ctx.answerCallbackQuery().catch(() => {});
});

// ─── Действия ─────────────────────────────────────────────────────────────────

bot.callbackQuery('menu', async (ctx) => {
    await showMenu(ctx, true);
});

// Выбор способа регистрации
bot.callbackQuery('reg_manager', async (ctx) => {
    setState(ctx.from.id, { step: 'idle', registrationType: 'manager' });
    await showJobMenu(ctx, true);
});

// Курьер → показ подменю
bot.callbackQuery('job_courier', async (ctx) => {
    const userId = ctx.from.id;
    setState(userId, { ...getState(userId), step: 'idle' });
    await editOrReply(ctx, 'Выберите, какой вид профессии "Курьер" вас больше всего устраивает 👇', {
        reply_markup: courierSubKeyboard,
    });
});

// Кнопка "Назад" из описания вакансии — возвращает в нужное место
bot.callbackQuery('back_from_job', async (ctx) => {
    const userId = ctx.from.id;
    const state = getState(userId);
    const job = JOBS[state.selectedJob];
    if (job && job.parent === 'courier') {
        setState(userId, { ...state, step: 'idle' });
        await editOrReply(ctx, 'Выберите, какой вид профессии "Курьер" вас больше всего устраивает 👇', {
            reply_markup: courierSubKeyboard,
        });
    } else {
        await showJobMenu(ctx, true);
    }
});

// ─── Вакансии (описание + подтверждение) ────────────────────────────────────

for (const [jobKey, job] of Object.entries(JOBS)) {
    bot.callbackQuery(`job_${jobKey}`, async (ctx) => {
        const userId = ctx.from.id;
        setState(userId, { ...getState(userId), step: 'viewing', selectedJob: jobKey });
        await editOrReply(ctx, job.description, { reply_markup: jobConfirmKeyboard(jobKey) });
    });

    bot.callbackQuery(`confirm_${jobKey}`, async (ctx) => {
        const userId = ctx.from.id;
        setState(userId, { ...getState(userId), step: 'consent', selectedJob: jobKey });
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
                    .text('◀ Назад', `job_${jobKey}`),
            }
        );
    });

    bot.callbackQuery(`consent_ok_${jobKey}`, async (ctx) => {
        const userId = ctx.from.id;
        await editOrReply(ctx, 'Введите ваши Фамилию, Имя и Отчество 👇', { reply_markup: menuKeyboard });
        setState(userId, { ...getState(userId), step: 'fio', selectedJob: jobKey });
    });
}

// ─── Проверка подписки ────────────────────────────────────────────────────────

bot.callbackQuery('check_subscription', async (ctx) => {
    const userId = ctx.from.id;
    await editOrReply(ctx, '✅ Спасибо за подписку! Добро пожаловать в команду!\n\nВыбирайте вакансию и начинайте путь к новому! 🚀', {
        reply_markup: getMainJobKeyboard(userId),
    });
    setState(userId, { step: 'idle' });
});

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
            await ctx.reply(
                'Введите ваш номер телефона 👇\n\n' +
                'Вы можете ввести его вручную или отправить с помощью соответствующей кнопки',
                { reply_markup: phoneKeyboard }
            );
            break;

        case 'phone':
            setState(userId, { ...state, step: 'age', phone: text });
            await ctx.reply('Введите ваш возраст 👇', { reply_markup: { remove_keyboard: true } });
            break;

        case 'age':
            setState(userId, { ...state, step: 'citizenship', age: text });
            await ctx.reply('Какое у вас Гражданство 👇', { reply_markup: menuKeyboard });
            break;

        case 'citizenship':
            setState(userId, { ...state, step: 'district', citizenship: text });
            await ctx.reply(
                'Введите район проживания (или в каком районе вы хотели бы работать) 👇',
                { reply_markup: menuKeyboard }
            );
            break;

        case 'district': {
            const data = { ...state, district: text, step: 'done', userId, username: ctx.from.username };
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
                'Будьте готовы к интересным предложениям — мы скоро на связи! 😎'
            );

            await ctx.reply(
                '🥲 Вы не подписались на канал!\n\n' +
                '☺️ Для доступа к боту нужно подписаться на канал ПРОСТО РАБОТА',
                { reply_markup: subscriptionKeyboard() }
            );
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

// Команда /start в меню бота — чтобы у пользователя была кнопка запуска
bot.api.setMyCommands([{ command: 'start', description: 'Запустить бот' }])
    .catch((e) => console.error('Не удалось установить команды бота:', e.message));

bot.start({
    onStart: (me) => console.log(`✅ Самокат партнёр Telegram-бот запущен: @${me.username}`),
});
