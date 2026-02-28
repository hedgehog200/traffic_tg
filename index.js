const { Telegraf, session, Markup } = require('telegraf');
const config = require('./config');
const { sequelize } = require('./models');
const startHandler = require('./handlers/start');
const menuHandler = require('./handlers/menu');
const adminHandler = require('./handlers/admin');
const tasksHandler = require('./handlers/tasks');
const signalsHandler = require('./handlers/signals');
const { startScheduler } = require('./utils/scheduler');
const { adminMiddleware, telegrafRateLimit } = require('./middleware');
const logger = require('./utils/logger'); // 👈 Импортируем логгер

// Создание экземпляра бота
const bot = new Telegraf(config.BOT_TOKEN);

// Middleware
bot.use(session());
bot.use(telegrafRateLimit);

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  logger.error('Telegraf error:', err, ctx?.from?.id);
  ctx.reply('⚠️ Техническая ошибка. Попробуйте позже.').catch(() => {});
});

// ====================== РЕГИСТРАЦИЯ КОМАНД ======================
bot.start(startHandler);
bot.help((ctx) => ctx.reply('Справка в разработке.'));

// Админские команды
bot.command('admin', adminMiddleware, adminHandler.showAdminMenu);
bot.command('addtask', adminMiddleware, adminHandler.addTaskCommand);
bot.command('tasks', adminMiddleware, adminHandler.listTasksCommand);
bot.command('deactivatetask', adminMiddleware, adminHandler.deactivateTask);
bot.command('activetask', adminMiddleware, adminHandler.activateTask);
bot.command('addsignal', adminMiddleware, adminHandler.addSignalCommand);
bot.command('signals', adminMiddleware, adminHandler.listSignalsCommand);
bot.command('stats', adminMiddleware, adminHandler.statsCommand);
bot.command('cancel', adminMiddleware, adminHandler.cancelCommand);

// ====================== КОЛБЭКИ ======================

// Задания
bot.action(/task_(\d+)/, tasksHandler.handleTaskCallback);
bot.action(/check_(\d+)/, tasksHandler.checkSubscription);
bot.action('tasks_back', tasksHandler.backToTasks);

// Админские действия над заданиями
bot.action('admin_addtask', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.addTaskCommand(ctx);
});
bot.action('admin_deactivatetask', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.deactivateTask(ctx);
});
bot.action('admin_activatetask', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.activateTask(ctx);
});
bot.action('admin_menu_tasks', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.listTasksCommand(ctx);
});

bot.action('admin_menu_signals', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.listSignalsCommand(ctx);
});

bot.action('admin_menu_stats', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.statsCommand(ctx);
});

bot.action('admin_menu_cancel', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('🚫 Действие отменено.');
});
bot.action('admin_addsignal', async (ctx) => {
  await ctx.deleteMessage();
  await adminHandler.addSignalCommand(ctx);
});

// Управление заданиями через отдельные кнопки
bot.action(/task_activate_(\d+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  await adminHandler.handleTaskActivate(ctx, taskId);
});
bot.action(/task_deactivate_(\d+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  await adminHandler.handleTaskDeactivate(ctx, taskId);
});
bot.action(/task_toggle_betusx_(\d+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  await adminHandler.handleTaskToggleBetusX(ctx, taskId);
});
bot.action('copy_promo', async (ctx) => {
  const promo = config.BETUSX_PROMOCODE || 'PROMO2025';
  await ctx.answerCbQuery(`Промокод: ${promo}`, { show_alert: true });
});

// Кнопка "Назад в админ-меню"
bot.action('admin_back', adminHandler.handleAdminBack);

// Сигналы (пользовательские)
bot.action(/signal_view_(\d+)/, signalsHandler.viewSignal);
bot.action('signals_list', signalsHandler.showSignals);

// Админские действия над сигналами
bot.action(/signal_(send|edit|delete)_(\d+)/, adminHandler.handleSignalActions);

// Выбор сигнала при создании задания
bot.action(/select_signal_(\d+|none)/, adminHandler.handleSignalSelection);

// В разделе колбэков пользовательского меню
bot.action('check_betusx_subscription', menuHandler.checkBetusXSubscription);

// ====================== ПОЛЬЗОВАТЕЛЬСКОЕ МЕНЮ (INLINE) ======================
bot.action('menu_tasks', menuHandler.showTasks);
bot.action('menu_signals', menuHandler.showSignals);
bot.action('menu_profile', menuHandler.showProfile);
bot.action('menu_betusx', menuHandler.showBetusX);
bot.action('menu_back', menuHandler.backToMainMenu);
// ============================================================================

// ====================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ======================
bot.on('text', async (ctx) => {
  // Проверяем состояния ввода (админские)
  if (await adminHandler.handleAddTaskInput(ctx)) return;
  if (await adminHandler.handleDeactivateInput(ctx)) return;
  if (await adminHandler.handleActivateInput(ctx)) return;
  if (await adminHandler.handleAddSignalInput(ctx)) return;
  if (await adminHandler.handleEditSignalInput(ctx)) return;

  // Если ничего не сработало, предлагаем открыть меню
  await ctx.reply('Пожалуйста, используйте кнопки меню.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Открыть меню', callback_data: 'menu_back' }]
      ]
    }
  });
});

// ====================== ОБРАБОТКА ФОТО ======================
bot.on('photo', async (ctx) => {
  if (await adminHandler.handleAddSignalPhoto(ctx)) return;
  if (await adminHandler.handleEditSignalPhoto(ctx)) return;
});

// ====================== ЗАПУСК ПЛАНИРОВЩИКА ======================
startScheduler(bot);

// ====================== ЗАПУСК БОТА ======================
(async () => {
  try {
    await sequelize.authenticate();
    logger.info('Подключение к БД успешно.'); // 👈 Заменяем console.log

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' ? true : false });
    logger.info('Модели синхронизированы.');

    await bot.launch();
    logger.info('Бот запущен в режиме long polling');
  } catch (error) {
    logger.error('Ошибка при запуске:', error); // 👈 Заменяем console.error
    process.exit(1);
  }
})();

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Получен SIGINT, остановка бота');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('Получен SIGTERM, остановка бота');
  bot.stop('SIGTERM');
});