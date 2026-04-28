import 'dotenv/config';
import {Bot, Keyboard} from '@maxhub/max-bot-api';

const bot = new Bot("f9LHodD0cOJa50rkNYVUoRbk1E3EkgeNv74-GdNOCfUen93SNve85THJH3TIE2ciSilD29jQ9QDQOevo-d0i");
const ADMIN_ID = Number("12564804");

// Хранилище состояний пользователей
const states = new Map();

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
const jobKeyboard = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('🚶 Пеший курьер', 'job_foot_courier'),
        Keyboard.button.callback('🚴 Велокурьер', 'job_bike_courier'),
    ],
    [
        Keyboard.button.callback('🚗 Автокурьер', 'job_auto_courier'),
        Keyboard.button.callback('📦 Сборщик заказов', 'job_picker'),
    ],
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
    const fields = {
        TITLE: `${job?.title || data.selectedJob} — ${data.fio}`,
        NAME: data.fio,
        PHONE: [{VALUE: data.phone, VALUE_TYPE: 'WORK'}],
        SOURCE_ID: 'WEB',
        COMMENTS:
            `Вакансия: ${job?.title || data.selectedJob}\n` +
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
    return res.json();
}

// Главное меню
async function showMenu(ctx) {
    const userId = ctx.user.user_id;
    setState(userId, {step: 'idle'});
    await ctx.reply(
        'Мы очень рады, что ты хочешь сотрудничать! 🤝\n\n' +
        '🎯 Давай выберем подходящую вакансию и начнём вместе зарабатывать:\n\n' +
        '👇 Выбирай, кем хочешь работать:',
        {attachments: [jobKeyboard]}
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
    await showMenu(ctx);
});

// Обработка сообщений — шаги анкеты
bot.on('message_created', async (ctx) => {
    const userId = ctx.user.user_id;
    const text = ctx.message?.body?.text;
    if (!text) return;

    const state = getState(userId);

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
                            [Keyboard.button.callback('Вступить в группу', 'group_link')],
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
                            [Keyboard.button.callback('✅ Подписаться', 'group_link')],
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

// Обработчик для кнопки "Вступить в группу" и "Подписаться"
bot.action('group_link', async (ctx) => {
    await ctx.reply('Ссылка на группу: https://max.ru/prostorabotaru');
});

bot.start();
