const { User, CompletedTask, Task } = require('../models');
const config = require('../config');
const { Markup } = require('telegraf');
const tasksHandler = require('./tasks');
const signalsHandler = require('./signals');
const logger = require('../utils/logger').getContextLogger('menu'); // если используете логгер

// Вспомогательная функция для получения пользователя
async function getUser(ctx) {
  const telegramId = ctx.from.id;
  const user = await User.findOne({ where: { telegramId } });
  if (!user) {
    await ctx.reply('Пожалуйста, введите /start для регистрации.');
    return null;
  }
  return user;
}

// ==================== Обработчики инлайн-кнопок ====================

async function showTasks(ctx) {
  await ctx.answerCbQuery();
  const user = await getUser(ctx);
  if (!user) return;
  await tasksHandler.showTasks(ctx);
}

async function showSignals(ctx) {
  await ctx.answerCbQuery();
  const user = await getUser(ctx);
  if (!user) return;
  await signalsHandler.showSignals(ctx);
}

async function showProfile(ctx) {
  await ctx.answerCbQuery();
  const user = await getUser(ctx);
  if (!user) return;

  const completedCount = await CompletedTask.count({ where: { userId: user.id } });
  const profileText = `👤 *Ваш профиль*\n\n` +
    `🆔 Telegram ID: \`${user.telegramId}\`\n` +
    `👤 Имя: ${user.firstName || '—'} ${user.lastName || ''}\n` +
    `🔗 Username: @${user.username || 'не указан'}\n` +
    `📅 Зарегистрирован: ${user.createdAt.toLocaleDateString()}\n` +
    `✅ Выполнено заданий: ${completedCount}`;

  await ctx.replyWithMarkdown(profileText);
}

/**
 * Показывает список каналов для подписки и кнопку проверки
 */
async function showBetusX(ctx) {
  await ctx.answerCbQuery();
  const user = await getUser(ctx);
  if (!user) return;

  // Получаем уникальные каналы из конфига и активных заданий
  const configChannels = config.BETUSX_CHANNELS || [];
  const taskChannels = await Task.findAll({
    where: { active: true, showInBetusX: true },
    attributes: ['channelUsername', 'channelLink']
  });

  const taskChannelsFormatted = taskChannels
    .filter(task => task.channelUsername)
    .map(task => {
      let url = task.channelLink;
      if (!url && task.channelUsername) {
        const username = task.channelUsername.replace('@', '');
        url = `https://t.me/${username}`;
      }
      return { name: task.channelUsername, url };
    })
    .filter(ch => ch.url);

  const allChannelsMap = new Map();
  [...configChannels, ...taskChannelsFormatted].forEach(ch => {
    if (ch.url && !allChannelsMap.has(ch.url)) {
      allChannelsMap.set(ch.url, ch);
    }
  });
  const uniqueChannels = Array.from(allChannelsMap.values());

  if (uniqueChannels.length === 0) {
    return ctx.reply('Нет доступных каналов для подписки.');
  }

  const message = `💰 *Зарабатывай с BetusX!*\n\n` +
    `Для получения промокода подпишись на все каналы ниже и нажми кнопку проверки.`;

  const inlineKeyboard = [];

  // Кнопки для перехода на каналы
  uniqueChannels.forEach(ch => {
    inlineKeyboard.push([Markup.button.url(ch.name, ch.url)]);
  });

  // Кнопка проверки подписки
  inlineKeyboard.push([Markup.button.callback('✅ Проверить подписку', 'check_betusx_subscription')]);

  // Кнопка назад в главное меню
  inlineKeyboard.push([Markup.button.callback('◀️ Назад в меню', 'menu_back')]);

  await ctx.replyWithMarkdown(message, {
    reply_markup: { inline_keyboard: inlineKeyboard }
  });
}

/**
 * Проверяет подписку на все каналы и показывает промокод, если успешно
 */
/**
 * Проверяет подписку на все каналы и показывает промокод, если успешно
 */
async function checkBetusXSubscription(ctx) {
  await ctx.answerCbQuery();
  const user = await getUser(ctx);
  if (!user) return;

  // Получаем те же каналы, что и в showBetusX
  const configChannels = config.BETUSX_CHANNELS || [];
  const taskChannels = await Task.findAll({
    where: { active: true, showInBetusX: true },
    attributes: ['channelUsername', 'channelLink']
  });

  const taskChannelsFormatted = taskChannels
    .filter(task => task.channelUsername)
    .map(task => {
      let url = task.channelLink;
      if (!url && task.channelUsername) {
        const username = task.channelUsername.replace('@', '');
        url = `https://t.me/${username}`;
      }
      return { name: task.channelUsername, url };
    })
    .filter(ch => ch.url);

  const allChannelsMap = new Map();
  [...configChannels, ...taskChannelsFormatted].forEach(ch => {
    if (ch.url && !allChannelsMap.has(ch.url)) {
      allChannelsMap.set(ch.url, ch);
    }
  });
  const uniqueChannels = Array.from(allChannelsMap.values());

  if (uniqueChannels.length === 0) {
    return ctx.reply('Нет каналов для проверки.');
  }

  // Проверяем подписку на каждый канал
  const notSubscribed = [];

  for (const ch of uniqueChannels) {
    try {
      // Извлекаем username из имени или ссылки
      let username = ch.name;
      if (!username.startsWith('@')) {
        const match = ch.url.match(/t\.me\/([^/]+)/);
        if (match) {
          username = '@' + match[1];
        } else {
          username = '@' + username; // запасной вариант
        }
      }
      const chatId = username.startsWith('@') ? username : `@${username}`;

      const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
      const status = chatMember.status;
      const isMember = ['member', 'administrator', 'creator'].includes(status);

      if (!isMember) {
        notSubscribed.push(ch.name);
      }
    } catch (error) {
      console.error(`Ошибка проверки канала ${ch.name}:`, error);
      notSubscribed.push(`${ch.name} (ошибка проверки)`);
    }
  }

  if (notSubscribed.length === 0) {
    // Все подписаны – показываем промокод
    let link = config.BETUSX_PARTNER_LINK; // ВАЖНО: let, не const
    if (config.ADD_UTM) {
      const separator = link.includes('?') ? '&' : '?';
      link += `${separator}utm_source=tg_bot&utm_medium=referral&utm_campaign=promo`;
    }

    const promo = config.BETUSX_PROMOCODE || 'PROMO2025';
    const message = `💰 *Зарабатывай с BetusX!*\n\n` +
      `🎁 Твой промокод: \`${promo}\`\n\n` +
      `Переходи по ссылке и активируй его!`;

    const inlineKeyboard = [
      [Markup.button.callback('📋 Скопировать промокод', 'copy_promo')],
      [Markup.button.url('🔗 Перейти на BetusX', link)],
      [Markup.button.callback('◀️ Назад в меню', 'menu_back')]
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } else {
    // Есть неподписанные каналы
    const list = notSubscribed.map(n => `• ${n}`).join('\n');
    const message = `❌ Вы не подписаны на следующие каналы:\n${list}\n\nПодпишитесь и нажмите "Проверить" снова.`;

    const inlineKeyboard = [
      [Markup.button.callback('🔄 Проверить снова', 'check_betusx_subscription')],
      [Markup.button.callback('◀️ Назад в меню', 'menu_back')]
    ];

    await ctx.editMessageText(message, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }
}

async function backToMainMenu(ctx) {
  await ctx.answerCbQuery();
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Задания', 'menu_tasks')],
    [Markup.button.callback('📈 Сигналы BetusX', 'menu_signals')],
    [Markup.button.callback('👤 Мой профиль', 'menu_profile')],
    [Markup.button.callback('🤝 BetusX', 'menu_betusx')]
  ]);
  await ctx.reply('📋 Главное меню:', mainMenuKeyboard);
}

module.exports = {
  showTasks,
  showSignals,
  showProfile,
  showBetusX,
  checkBetusXSubscription, // новый экспорт
  backToMainMenu
};