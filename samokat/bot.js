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
const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK || '';
const BANNER_PHOTO_TOKEN = process.env.BANNER_PHOTO_TOKEN || '';

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
    const fields = {
        TITLE: `${jobTitle} — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'OTHER',
        SOURCE_DESCRIPTION: 'Бот Самокат Партнёр',
        ADDRESS_CITY: data.city,
        COMMENTS:
            `Источник: Бот Самокат Партнёр\n` +
            `Способ регистрации: ${regTypeLabel}\n` +
            `Вакансия: ${jobTitle}\n` +
            `ФИО: ${data.fio}\n` +
            `Город: ${data.city}\n` +
            `Возраст: ${data.age}\n` +
            `Гражданство: ${data.citizenship}\n` +
            `Район: ${data.district}`,
        UF_CRM_1777750252: jobTitle,
        UF_CRM_1777750300: data.age,
        UF_CRM_1777750316: data.citizenship,
        UF_CRM_1777750988: data.fio,
        UF_CRM_1777750997: data.city,
        UF_CRM_1777751018: 'Бот Самокат Партнёр',
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

const BUTTON_TEXT_LIMIT = 128;

function truncateButtonText(str) {
    if (str.length <= BUTTON_TEXT_LIMIT) return str;
    return str.substring(0, BUTTON_TEXT_LIMIT - 1).trim() + '…';
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
        const btnText = truncateButtonText('👉 Перейти по ссылке');
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

function getMainJobKeyboard(userId) {
    const rows = [
        [
            Keyboard.button.callback('🚛 Курьер', 'job_courier'),
            Keyboard.button.callback('📦 Сборщик', 'job_picker'),
        ],
        [
            Keyboard.button.callback('🔍 Сканировщик', 'job_scanner'),
            Keyboard.button.callback('👨‍🍳 Работник кухни', 'job_kitchen'),
        ],
        [
            Keyboard.button.callback('😎 ВАХТА 😎', 'job_vakta'),
        ],
    ];
    if (userId === ADMIN_ID) {
        rows.push([Keyboard.button.callback('⚙️ Админ-панель', 'admin_panel')]);
    }
    return Keyboard.inlineKeyboard(rows);
}

const courierSubKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('🚛 Авто курьер', 'job_auto_courier')],
    [Keyboard.button.callback('🚲 Вело/электро/мото курьер', 'job_bike_courier')],
    [Keyboard.button.callback('🚶 Пеший курьер', 'job_foot_courier')],
    [Keyboard.button.callback('◀ Назад', 'menu')],
]);

const menuKeyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback('🏠 Меню', 'menu')]]);

const SAMOKAT_LINK = 'https://clck.ru/3WD4H5';
const YANDEX_LINK = 'https://ya.cc/t/a2gKSseTBXZTsB';

function getStartKeyboard(userId) {
    const rows = [
        [Keyboard.button.link('🛵 Самокат', SAMOKAT_LINK)],
        [Keyboard.button.link('🚴 Яндекс', YANDEX_LINK)],
        [Keyboard.button.link('🔥 Больше вакансий', CHANNEL_LINK)],
    ];
    if (userId === ADMIN_ID) {
        rows.push([Keyboard.button.callback('⚙️ Админ-панель', 'admin_panel')]);
    }
    return Keyboard.inlineKeyboard(rows);
}

function jobConfirmKeyboard(jobKey) {
    return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Согласен, продолжить ▶', `confirm_${jobKey}`)],
        [Keyboard.button.callback('◀ Назад', 'back_from_job')],
    ]);
}

function subscriptionKeyboard() {
    return Keyboard.inlineKeyboard([
        [Keyboard.button.link('✅ Подписаться', CHANNEL_LINK)],
        [Keyboard.button.callback('👀 Проверить подписку', 'check_subscription')],
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
    const text =
        '👋 Привет! Ищешь работу? Поможем начать!\n\n' +
        'У нас есть проверенные варианты трудоустройства у партнёров и актуальные вакансии в разных сферах.\n\n' +
        'Выбирай, что тебе подходит:\n\n' +
        '🛵 Самокат — самостоятельная регистрация и выход на работу.\n\n' +
        '🚴 Яндекс — вакансии для курьеров.\n\n' +
        '🔥 Больше вакансий — смотри новые предложения в нашем канале МАХ.\n\n' +
        'Выбирай направление и начинай зарабатывать!';
    const keyboard = getStartKeyboard(userId);
    if (edit) {
        await ctx.editMessage({ text, attachments: [keyboard] });
    } else {
        await ctx.reply(text, { attachments: [keyboard] });
    }
}

async function showJobMenu(ctx, edit = false) {
    const userId = ctx.user.user_id;
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

    if (BANNER_PHOTO_TOKEN) {
        try {
            await ctx.reply('', {
                attachments: [{ type: 'image', payload: { token: BANNER_PHOTO_TOKEN } }],
            });
        } catch (e) {
            console.error('Banner photo error:', e.message);
        }
    }

    await showMenu(ctx);
}

bot.command('start', handleStart);
bot.on('bot_started', handleStart);

// ─── Действия ─────────────────────────────────────────────────────────────────

bot.action('menu', async (ctx) => {
    await showMenu(ctx, true);
});

// Выбор способа регистрации
bot.action('reg_manager', async (ctx) => {
    const userId = ctx.user.user_id;
    setState(userId, { step: 'idle', registrationType: 'manager' });
    await showJobMenu(ctx, true);
});

// Курьер → показ подменю
bot.action('job_courier', async (ctx) => {
    const userId = ctx.user.user_id;
    setState(userId, { ...getState(userId), step: 'idle' });
    await ctx.editMessage({
        text: 'Выберите, какой вид профессии "Курьер" вас больше всего устраивает 👇',
        attachments: [courierSubKeyboard],
    });
});

// Кнопка "Назад" из описания вакансии — возвращает в нужное место
bot.action('back_from_job', async (ctx) => {
    const userId = ctx.user.user_id;
    const state = getState(userId);
    const job = JOBS[state.selectedJob];
    if (job && job.parent === 'courier') {
        setState(userId, { ...state, step: 'idle' });
        await ctx.editMessage({
            text: 'Выберите, какой вид профессии "Курьер" вас больше всего устраивает 👇',
            attachments: [courierSubKeyboard],
        });
    } else {
        await showJobMenu(ctx, true);
    }
});

// ─── Вакансии (описание + подтверждение) ────────────────────────────────────

const ALL_JOB_KEYS = Object.keys(JOBS);

for (const jobKey of ALL_JOB_KEYS) {
    const job = JOBS[jobKey];

    bot.action(`job_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, { ...getState(userId), step: 'viewing', selectedJob: jobKey });
        await ctx.editMessage({ text: job.description, attachments: [jobConfirmKeyboard(jobKey)] });
    });

    bot.action(`confirm_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, { ...getState(userId), step: 'consent', selectedJob: jobKey });
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
                    [Keyboard.button.callback('◀ Назад', `job_${jobKey}`)],
                ]),
            ],
        });
    });

    bot.action(`consent_ok_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        await ctx.editMessage({ text: 'Введите ваши Фамилию, Имя и Отчество 👇', attachments: [menuKeyboard] });
        setState(userId, { ...getState(userId), step: 'fio', selectedJob: jobKey });
    });
}

// ─── Проверка подписки ────────────────────────────────────────────────────────

bot.action('check_subscription', async (ctx) => {
    const userId = ctx.user.user_id;
    await ctx.editMessage({
        text: '✅ Спасибо за подписку! Добро пожаловать в команду!\n\nВыбирайте вакансию и начинайте путь к новому! 🚀',
        attachments: [getMainJobKeyboard(userId)],
    });
    setState(userId, { step: 'idle' });
});

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
            await ctx.reply(
                'Введите ваш номер телефона 👇\n\n' +
                'Вы можете ввести его вручную или отправить с помощью соответствующей кнопки',
                { attachments: [menuKeyboard] }
            );
            break;

        case 'phone':
            setState(userId, { ...state, step: 'age', phone: text });
            await ctx.reply('Введите ваш возраст 👇', { attachments: [menuKeyboard] });
            break;

        case 'age':
            setState(userId, { ...state, step: 'citizenship', age: text });
            await ctx.reply('Какое у вас Гражданство 👇', { attachments: [menuKeyboard] });
            break;

        case 'citizenship':
            setState(userId, { ...state, step: 'district', citizenship: text });
            await ctx.reply(
                'Введите район проживания (или в каком районе вы хотели бы работать) 👇',
                { attachments: [menuKeyboard] }
            );
            break;

        case 'district': {
            const data = { ...state, district: text, step: 'done' };
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
                { attachments: [subscriptionKeyboard()] }
            );
            break;
        }

        default:
            await showMenu(ctx);
    }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────

// Команда /start в меню бота — чтобы у пользователя была кнопка запуска
bot.api.setMyCommands([{ name: 'start', description: 'Запустить бот' }])
    .catch((e) => console.error('Не удалось установить команды бота:', e.message));

bot.start();
console.log('✅ Самокат партнёр бот запущен!');
