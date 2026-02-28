const { User } = require('../models');
const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name;

  // Поиск или создание пользователя
  const [user, created] = await User.findOrCreate({
    where: { telegramId },
    defaults: { username, firstName, lastName },
  });

  // 🔹 Инлайн-клавиатура главного меню (без reply-кнопок)
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Задания', 'menu_tasks')],
    [Markup.button.callback('📈 Сигналы BetusX', 'menu_signals')],
    [Markup.button.callback('👤 Мой профиль', 'menu_profile')],
    [Markup.button.callback('🤝 BetusX', 'menu_betusx')]
  ]);

  // Приветствие для новых пользователей
  if (created) {
    const welcomeMessage = `👋 Добро пожаловать, ${firstName}!\n\n` +
      `Этот бот поможет тебе получать сигналы BetusX за подписку на каналы. Выполняй задания и зарабатывай сигналы! Используй кнопки ниже.`;
    await ctx.reply(welcomeMessage, mainMenuKeyboard);
  } else {
    // Для существующих пользователей просто показываем меню
    await ctx.reply('📋 Главное меню:', mainMenuKeyboard);
  }
};