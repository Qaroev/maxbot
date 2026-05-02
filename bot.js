import 'dotenv/config';
import {Bot, Keyboard} from '@maxhub/max-bot-api';

const bot = new Bot("f9LHodD0cOJa50rkNYVUoRbk1E3EkgeNv74-GdNOCfUen93SNve85THJH3TIE2ciSilD29jQ9QDQOevo-d0i");
const ADMIN_ID = Number("75038254"); //  12564804   203379794

// Хранилище состояний пользователей
const states = new Map();

// Хранилище всех пользователей
const users = new Set();

function trackUser(userId) {
    users.add(userId);
}

function getState(userId) {
    return states.get(userId) || {step: 'idle'};
}

function setState(userId, data) {
    states.set(userId, data);
}

// Вакансии
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
    picker: {
        title: '📦 Сборщик заказов',
        description:
            '📦 Сборщик заказов\n\n' +
            'Основные обязанности:\n' +
            '* Сборка заказов на складе\n' +
            '* Работа с приложением для учёта заказов\n' +
            '* Упаковка и маркировка товаров\n' +
            '* Соблюдение стандартов компании\n\n' +
            'Условия работы:\n' +
            '* График - сменный (12 часов)\n' +
            '* Оплата - до 400₽ в час\n' +
            '* Средний заработок - 4800₽ за смену\n' +
            '* Выплаты - раз в неделю\n' +
            '* Работа в помещении',
    },
};

// Клавиатуры
function getJobKeyboard(userId) {
    const rows = [
        [
            Keyboard.button.callback('🚶 Пеший курьер', 'job_foot_courier'),
            Keyboard.button.callback('🚴 Велокурьер', 'job_bike_courier'),
        ],
        [
            Keyboard.button.callback('🚗 Автокурьер', 'job_auto_courier'),
            Keyboard.button.callback('📦 Сборщик заказов', 'job_picker'),
        ],
    ];
    if (userId === ADMIN_ID) {
        rows.push([Keyboard.button.callback('⚙️ Админ-панель', 'admin_panel')]);
    }
    return Keyboard.inlineKeyboard(rows);
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

const menuKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('🏠 Меню', 'menu')],
]);

function jobConfirmKeyboard(jobKey) {
    return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Согласен, продолжить ▶', `confirm_${jobKey}`)],
        [Keyboard.button.callback('◀ Назад', 'menu')],
    ]);
}

const BITRIX_WEBHOOK = 'https://b24-hjgutj.bitrix24.ru/rest/1/uly0yxxwby5qitzv';

async function sendToBitrix(data, job) {
    const url = `${BITRIX_WEBHOOK}/crm.lead.add`;
    const jobTitle = job?.title || data.selectedJob || '—';
    console.log('Отправка в Bitrix:', {
        fio: data.fio,
        phone: data.phone,
        city: data.city,
        age: data.age,
        citizenship: data.citizenship,
        job: jobTitle,
    });
    const fields = {
        TITLE: `${jobTitle} — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{VALUE: data.phone, VALUE_TYPE: 'WORK'}],
        SOURCE_ID: 'WEB',
        SOURCE_DESCRIPTION: `Бот Макс Купер | Вакансия: ${jobTitle} | Возраст: ${data.age} | Гражданство: ${data.citizenship}`,
        ADDRESS_CITY: data.city,
        COMMENTS:
            `Источник: Бот Макс Купер\n` +
            `Вакансия: ${jobTitle}\n` +
            `ФИО: ${data.fio}\n` +
            `Город: ${data.city}\n` +
            `Возраст: ${data.age}\n` +
            `Гражданство: ${data.citizenship}`,
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fields}),
    });
    const result = await res.json();
    if (result.error) {
        console.error('Bitrix error:', result.error, result.error_description);
    } else {
        console.log('Bitrix лид создан, ID:', result.result);
    }
    return result;
}

// Главное меню
async function showMenu(ctx) {
    const userId = ctx.user.user_id;
    trackUser(userId);
    setState(userId, {step: 'idle'});
    await ctx.reply(
        'Мы очень рады, что ты хочешь сотрудничать! 🤝\n\n' +
        '🎯 Давай выберем подходящую вакансию и начнём вместе зарабатывать:\n\n' +
        '👇 Выбирай, кем хочешь работать:',
        {attachments: [getJobKeyboard(userId)]}
    );
}

// /start
bot.command('start', async (ctx) => {
    await showMenu(ctx);
});

// Кнопка "Меню"
bot.action('menu', async (ctx) => {
    await showMenu(ctx);
});

// Админ-панель
bot.action('admin_panel', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, {step: 'idle'});
    await ctx.reply(
        'Добро пожаловать в админ-панель!\n\nВы можете посмотреть всех пользователей или сделать рассылку, **что выберете?**',
        {attachments: [adminKeyboard]}
    );
});

// Статистика
bot.action('admin_stats', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    const total = users.size;
    await ctx.reply(
        `📊 Статистика\n\n👥 Всего пользователей: ${total}`,
        {attachments: [adminKeyboard]}
    );
});

// Рассылка — выбор типа
bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    await ctx.reply(
        'Выберите, какую именно рассылку вы хотите запустить:',
        {attachments: [broadcastTypeKeyboard]}
    );
});

// Рассылка — текст
bot.action('broadcast_text', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, {step: 'admin_broadcast_text'});
    await ctx.reply('Введите текст для рассылки 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

// Рассылка — фото + текст
bot.action('broadcast_photo', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, {step: 'admin_broadcast_photo'});
    await ctx.reply('Отправьте фото с подписью (или без) 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

// Рассылка — видео + текст
bot.action('broadcast_video', async (ctx) => {
    const userId = ctx.user.user_id;
    if (userId !== ADMIN_ID) return;
    setState(userId, {step: 'admin_broadcast_video'});
    await ctx.reply('Отправьте видео с подписью (или без) 👇', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('◀ Назад', 'admin_broadcast')]])],
    });
});

// Выбор вакансии
for (const [jobKey, job] of Object.entries(JOBS)) {
    bot.action(`job_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, {step: 'viewing', selectedJob: jobKey});
        await ctx.reply(job.description, {attachments: [jobConfirmKeyboard(jobKey)]});
    });

    bot.action(`confirm_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, {step: 'consent', selectedJob: jobKey});
        await ctx.reply(
            '🔒 Ваши данные под защитой\n\n' +
            'Мы обрабатываем ваши персональные данные в соответствии с Федеральным законом №152-ФЗ «О персональных данных».\n\n' +
            'Перед началом, пожалуйста, ознакомьтесь с нашими документами:\n\n' +
            '📄 [Политика конфиденциальности](https://disk.yandex.ru/d/k4c4N8dtZSYhBQ)\n' +
            '✍️ [Согласие на обработку данных](https://disk.yandex.ru/d/k4c4N8dtZSYhBQ)\n\n' +
            'Мы используем ваши данные только для указанных целей и обеспечиваем их безопасность. Вы можете запросить удаление или изменение своих данных в любой момент.',
            {
                attachments: [
                    Keyboard.inlineKeyboard([
                        [Keyboard.button.callback('Ознакомлен и согласен!', `consent_ok_${jobKey}`)],
                        [Keyboard.button.callback('◀ Назад', 'menu')],
                    ]),
                ],
            }
        );
    });

    bot.action(`consent_ok_${jobKey}`, async (ctx) => {
        const userId = ctx.user.user_id;
        setState(userId, {step: 'fio', selectedJob: jobKey});
        await ctx.reply('Введите ваши Фамилию, Имя и Отчество 👇', {
            attachments: [menuKeyboard],
        });
    });
}

bot.on('bot_started', async (ctx) => {
    console.log('bot_started');
    console.log('Your ID:', ctx.user.user_id);
    await showMenu(ctx);
});

// Обработка сообщений — шаги анкеты
bot.on('message_created', async (ctx) => {
    const userId = ctx.user.user_id;
    trackUser(userId);
    const text = ctx.message?.body?.text;
    const state = getState(userId);

    // Рассылка: текст
    if (state.step === 'admin_broadcast_text') {
        if (!text) {
            await ctx.reply('Пожалуйста, отправьте текстовое сообщение.');
            return;
        }
        setState(userId, {step: 'idle'});

        // Ссылкаро аз матн мегирем
        const urlMatch = text.match(/https?:\/\/[^\s)]+/);
        const cleanText = text.replace(/\(https?:\/\/[^\s)]+\)/g, '').replace(/https?:\/\/[^\s)]+/g, '').trim();

        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                await bot.api.sendMessageToUser(uid, cleanText);
                if (urlMatch) {
                    await bot.api.sendMessage({
                        recipient: {userId: uid},
                        body: {type: 'text', text: '👉 Перейти по ссылке'},
                        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.link('👉 Перейти по ссылке', urlMatch[0])]])],
                    });
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
    if (state.step === 'admin_broadcast_photo') {
        const attachments = ctx.message?.body?.attachments || [];
        const photo = attachments.find(a => a.type === 'image');
        if (!photo) {
            await ctx.reply('Пожалуйста, отправьте фото.');
            return;
        }
        setState(userId, {step: 'idle'});
        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                await bot.api.sendMessageToUser(uid, text || '', {
                    attachments: [{type: 'image', payload: {token: photo.payload.token}}],
                });
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
    if (state.step === 'admin_broadcast_video') {
        const attachments = ctx.message?.body?.attachments || [];
        const video = attachments.find(a => a.type === 'video');
        if (!video) {
            await ctx.reply('Пожалуйста, отправьте видео.');
            return;
        }
        setState(userId, {step: 'idle'});
        let sent = 0, failed = 0;
        for (const uid of users) {
            if (uid === ADMIN_ID) continue;
            try {
                await bot.api.sendMessageToUser(uid, text || '', {
                    attachments: [{type: 'video', payload: {token: video.payload.token}}],
                });
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
            setState(userId, {...state, step: 'city', fio: text});
            await ctx.reply('Введите город, в котором вы ищете работу 👇', {
                attachments: [menuKeyboard],
            });
            break;

        case 'city':
            setState(userId, {...state, step: 'phone', city: text});
            await ctx.reply(
                'Введите ваш номер телефона 👇\n\nВы можете ввести его вручную',
                {attachments: [menuKeyboard]}
            );
            break;

        case 'phone':
            setState(userId, {...state, step: 'age', phone: text});
            await ctx.reply('Введите ваш возраст 👇', {
                attachments: [menuKeyboard],
            });
            break;

        case 'age':
            setState(userId, {...state, step: 'citizenship', age: text});
            await ctx.reply('Какое у вас Гражданство 👇', {
                attachments: [menuKeyboard],
            });
            break;

        case 'citizenship': {
            const data = {...state, citizenship: text, step: 'done'};
            setState(userId, data);

            // Илова кардан ба Bitrix
            const job = JOBS[data.selectedJob];
            console.log('job', job);
            try {
                await sendToBitrix(data, job);
                console.log('Заявка отправлена в Bitrix24');
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
                            [Keyboard.button.link('Вступить в группу', 'https://max.ru/prostorabotaru')],
                        ]),
                    ],
                }
            );

            // Сообщение о необходимости подписки на канал
            await ctx.reply(
                '🥲 Вы не подписались на канал!\n\n' +
                '☺️ Для доступа к боту нужно подписаться на канал ПРОСТО РАБОТА',
                {
                    attachments: [
                        Keyboard.inlineKeyboard([
                            [Keyboard.button.link('✅ Подписаться', 'https://max.ru/prostorabotaru')],
                            [Keyboard.button.callback('👀 Проверить подписку', 'check_subscription')],
                        ]),
                    ],
                }
            );

            // Уведомление админу
            if (ADMIN_ID) {
                const job = JOBS[data.selectedJob];
                const summary =
                    `📋 Новая заявка!\n\n` +
                    `👤 Пользователь: ${ctx.user.name} (ID: ${userId})\n` +
                    `💼 Вакансия: ${job?.title || data.selectedJob}\n` +
                    `👨‍💼 ФИО: ${data.fio}\n` +
                    `🏙️ Город: ${data.city}\n` +
                    `📱 Телефон: ${data.phone}\n` +
                    `🎂 Возраст: ${data.age}\n` +
                    `🌍 Гражданство: ${data.citizenship}`;

                try {
                    await bot.api.sendMessage({
                        recipient: {userId: ADMIN_ID},
                        body: {type: 'text', text: summary},
                    });
                } catch (e) {
                    console.error('Ошибка отправки админу:', e.message);
                }
            }
            break;
        }

        default:
            await showMenu(ctx);
    }
});


bot.start();
