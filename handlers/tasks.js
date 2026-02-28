const { Task, CompletedTask, User, Purchase, Signal } = require('../models');
const logger = require('../utils/logger').getContextLogger('tasks'); // 👈 Импортируем логгер с контекстом 'tasks'

/**
 * Возвращает список доступных заданий для пользователя (активные и невыполненные)
 */
async function getAvailableTasks(userId) {
  const allTasks = await Task.findAll({ where: { active: true } });
  const completed = await CompletedTask.findAll({
    where: { userId },
    attributes: ['taskId'],
  });
  const completedTaskIds = completed.map(c => c.taskId);
  return allTasks.filter(task => !completedTaskIds.includes(task.id));
}

/**
 * Безопасное формирование текста кнопки из channelUsername
 */
function safeButtonText(task) {
  let text = task.channelUsername || '';
  text = text.replace(/[^\w\s@_.-]/g, '').trim();
  if (text.length === 0) {
    text = `Задание #${task.id}`;
  }
  if (text.length > 30) {
    text = text.substring(0, 27) + '…';
  }
  return text;
}

/**
 * Показывает пользователю список доступных заданий
 */
async function showTasks(ctx) {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) {
    logger.warn('Пользователь не найден', null, ctx.from.id);
    return ctx.reply('❌ Пользователь не найден. Введите /start для регистрации.');
  }

  const available = await getAvailableTasks(user.id);
  logger.debug(`Найдено доступных заданий: ${available.length}`, null, ctx.from.id);

  if (available.length === 0) {
    logger.info('У пользователя нет доступных заданий', null, ctx.from.id);
    return ctx.reply('✅ У вас нет доступных заданий. Все выполнены или новых пока нет.');
  }

  const validTasks = available.filter(task => task.channelUsername && task.channelUsername.trim() !== '');
  logger.debug(`Заданий с заполненным channelUsername: ${validTasks.length}`, null, ctx.from.id);

  if (validTasks.length === 0) {
    logger.error('Нет заданий с заполненным channelUsername', null, ctx.from.id);
    return ctx.reply('⚠️ Ошибка: у доступных заданий отсутствует название канала. Сообщите администратору.');
  }

  const buttons = validTasks.map(task => [
    { text: safeButtonText(task), callback_data: `task_${task.id}` }
  ]);

  logger.debug(`Создано рядов кнопок: ${buttons.length}`, null, ctx.from.id);

  try {
    await ctx.reply('📋 *Доступные задания*\nВыберите задание, чтобы получить сигнал:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err) {
    logger.error('Ошибка отправки сообщения с кнопками:', err, ctx.from.id);
    await ctx.reply('⚠️ Не удалось отобразить список заданий. Попробуйте позже.');
  }
}

/**
 * Обработчик нажатия на конкретное задание (колбэк task_*)
 */
async function handleTaskCallback(ctx) {
  const callbackData = ctx.callbackQuery.data;
  const taskId = parseInt(callbackData.split('_')[1]);

  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) {
    logger.warn('Пользователь не найден при обработке task_*', null, ctx.from.id);
    return ctx.answerCbQuery('Ошибка: пользователь не найден');
  }

  const task = await Task.findByPk(taskId, {
    include: [{ model: Signal, as: 'signal' }]
  });
  if (!task || !task.active) {
    logger.warn(`Задание #${taskId} не найдено или неактивно`, null, ctx.from.id);
    return ctx.editMessageText('❌ Это задание больше недоступно.');
  }

  const completed = await CompletedTask.findOne({
    where: { userId: user.id, taskId: task.id },
  });
  if (completed) {
    logger.info(`Пользователь уже выполнил задание #${taskId}`, null, ctx.from.id);
    return ctx.editMessageText('✅ Вы уже выполнили это задание.');
  }

  // Формируем ссылку на канал, если не задана
  let channelLink = task.channelLink;
  if (!channelLink && task.channelUsername) {
    const username = task.channelUsername.replace('@', '');
    channelLink = `https://t.me/${username}`;
  }

  const displayName = safeButtonText(task);
  const signalInfo = task.signal ? 'За выполнение вы получите сигнал.' : 'За выполнение вы получите подтверждение.';
  const message = `*Задание:* Подпишитесь на канал ${displayName}\n` +
    (task.description ? `*Описание:* ${task.description}\n` : '') +
    `\n${signalInfo}\nПосле подписки нажмите кнопку "Проверить".`;

  const inlineKeyboard = [
    [{ text: '📢 Перейти на канал', url: channelLink }],
    [{ text: '🔍 Проверить подписку', callback_data: `check_${task.id}` }],
    [{ text: '◀️ Назад к списку', callback_data: 'tasks_back' }]
  ];

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (err) {
    logger.error('Ошибка в handleTaskCallback:', err, ctx.from.id);
    await ctx.answerCbQuery('⚠️ Не удалось показать задание');
  }
}

/**
 * Проверяет подписку пользователя на канал и выдаёт сигнал (колбэк check_*)
 */
async function checkSubscription(ctx) {
  const callbackData = ctx.callbackQuery.data;
  const taskId = parseInt(callbackData.split('_')[1]);

  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) {
    logger.warn('Пользователь не найден при проверке подписки', null, ctx.from.id);
    return ctx.answerCbQuery('Ошибка: пользователь не найден');
  }

  const task = await Task.findByPk(taskId, {
    include: [{ model: Signal, as: 'signal' }]
  });
  if (!task || !task.active) {
    logger.warn(`Задание #${taskId} не найдено или неактивно при проверке`, null, ctx.from.id);
    return ctx.answerCbQuery('Задание не найдено или неактивно', { show_alert: true });
  }

  const completed = await CompletedTask.findOne({
    where: { userId: user.id, taskId: task.id },
  });
  if (completed) {
    logger.info(`Пользователь уже получил награду за задание #${taskId}`, null, ctx.from.id);
    return ctx.answerCbQuery('Вы уже получили награду за это задание!', { show_alert: true });
  }

  try {
    const chatId = task.channelUsername.startsWith('@') ? task.channelUsername : `@${task.channelUsername}`;
    const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    const status = chatMember.status;
    const isMember = ['member', 'administrator', 'creator'].includes(status);

    if (!isMember) {
      logger.debug(`Пользователь не подписан на канал ${task.channelUsername}`, null, ctx.from.id);
      return ctx.answerCbQuery(
        '❌ Вы ещё не подписались на канал. Подпишитесь и нажмите "Проверить" снова.',
        { show_alert: true }
      );
    }

    await CompletedTask.create({
      userId: user.id,
      taskId: task.id,
      reward: 0,
    });

    let responseMessage = '✅ Задание выполнено!';

    if (task.signal) {
      const signal = task.signal;
      const text = `📈 *Ваш сигнал за задание*\n\n${signal.text}`;
      try {
        if (signal.imageFileId) {
          await ctx.telegram.sendPhoto(ctx.from.id, signal.imageFileId, {
            caption: text,
            parse_mode: 'Markdown',
          });
        } else {
          await ctx.telegram.sendMessage(ctx.from.id, text, { parse_mode: 'Markdown' });
        }
        await Purchase.findOrCreate({
          where: { userId: user.id, signalId: signal.id },
          defaults: { amount: 0 },
        });
        responseMessage += ' Сигнал отправлен!';
        logger.info(`Сигнал #${signal.id} отправлен пользователю за задание #${taskId}`, null, ctx.from.id);
      } catch (sendError) {
        logger.error('Ошибка отправки сигнала:', sendError, ctx.from.id);
        responseMessage += ' Но не удалось отправить сигнал. Обратитесь к администратору.';
      }
    } else {
      responseMessage += ' (сигнал не привязан к заданию)';
    }

    const backButton = [[{ text: '📋 К списку заданий', callback_data: 'tasks_back' }]];
    await ctx.editMessageText(responseMessage, {
      reply_markup: { inline_keyboard: backButton },
    });
  } catch (error) {
    logger.error('Ошибка при проверке подписки:', error, ctx.from.id);
    if (error.code === 400 && error.description.includes('chat not found')) {
      await ctx.answerCbQuery(
        '❌ Канал не найден. Возможно, он удалён или бот не является его администратором.',
        { show_alert: true }
      );
    } else if (error.code === 403) {
      await ctx.answerCbQuery(
        '❌ Бот не имеет доступа к каналу. Сообщите администратору.',
        { show_alert: true }
      );
    } else {
      await ctx.answerCbQuery(
        '❌ Произошла ошибка при проверке. Попробуйте позже.',
        { show_alert: true }
      );
    }
  }
}

/**
 * Возвращает пользователя к списку доступных заданий (колбэк tasks_back)
 */
async function backToTasks(ctx) {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) {
    logger.warn('Пользователь не найден при возврате к списку', null, ctx.from.id);
    return ctx.answerCbQuery('Ошибка пользователя');
  }

  const available = await getAvailableTasks(user.id);
  const validTasks = available.filter(task => task.channelUsername && task.channelUsername.trim() !== '');
  const buttons = validTasks.map(task => [
    { text: safeButtonText(task), callback_data: `task_${task.id}` }
  ]);

  try {
    await ctx.editMessageText('📋 *Доступные задания*\nВыберите задание:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err) {
    logger.error('Ошибка в backToTasks:', err, ctx.from.id);
    await ctx.answerCbQuery('⚠️ Не удалось вернуться к списку');
  }
}

module.exports = {
  showTasks,
  handleTaskCallback,
  checkSubscription,
  backToTasks,
};