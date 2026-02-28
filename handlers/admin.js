const { Markup } = require('telegraf');
const { Task, Signal, User, CompletedTask, Purchase } = require('../models');
const config = require('../config');
const { isAdmin } = require('../middleware/auth');

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

/**
 * Извлекает username канала из ссылки или текста
 */
function extractUsername(input) {
  const match = input.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)/);
  if (match) return '@' + match[1];
  if (input.startsWith('@')) return input;
  return '@' + input;
}

// ====================== АДМИН-МЕНЮ ======================

async function showAdminMenu(ctx) {
  if (!isAdmin(ctx)) return;
  const buttons = [
    [Markup.button.callback('📋 Управление заданиями', 'admin_menu_tasks')],
    [Markup.button.callback('📈 Управление сигналами', 'admin_menu_signals')],
    [Markup.button.callback('📊 Статистика', 'admin_menu_stats')],
    [Markup.button.callback('🚫 Отмена', 'admin_menu_cancel')],
  ];
  await ctx.reply('🔧 Панель администратора\nВыберите действие:', {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAdminBack(ctx) {
  await ctx.deleteMessage().catch(() => {});
  await showAdminMenu(ctx);
}

// ====================== УПРАВЛЕНИЕ ЗАДАНИЯМИ ======================

const taskCreation = new Map(); // key: chatId, value: { step, data }

async function addTaskCommand(ctx) {
  if (!isAdmin(ctx)) return;
  const chatId = ctx.chat.id;
  taskCreation.set(chatId, { step: 1, data: {} });
  await ctx.reply('📝 Шаг 1 из 4: Отправьте ссылку на канал или его username (например, @channel или https://t.me/channel):');
}

async function listTasksCommand(ctx) {
  if (!isAdmin(ctx)) return;
  const tasks = await Task.findAll({ 
    order: [['createdAt', 'DESC']],
    include: [{ model: Signal, as: 'signal', attributes: ['id', 'text'] }]
  });

  if (tasks.length === 0) {
    const buttons = [[Markup.button.callback('➕ Добавить задание', 'admin_addtask')]];
    return ctx.reply('Нет созданных заданий.', {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  for (const task of tasks) {
    const signalInfo = task.signal ? `Сигнал: #${task.signal.id}` : 'Сигнал: не привязан';
    const betusxStatus = task.showInBetusX ? '✅' : '❌';
    const text = `*ID:* ${task.id}\n` +
      `*Канал:* ${task.channelUsername}\n` +
      `*Активно:* ${task.active ? '✅' : '❌'}\n` +
      `*BetusX:* ${betusxStatus}\n` +
      `*${signalInfo}*`;

    const buttons = [
      [
        Markup.button.callback('✅ Активировать', `task_activate_${task.id}`),
        Markup.button.callback('❌ Деактивировать', `task_deactivate_${task.id}`)
      ],
      [
        Markup.button.callback(`🔄 BetusX (сейчас ${task.showInBetusX ? '✅' : '❌'})`, `task_toggle_betusx_${task.id}`)
      ]
    ];

    await ctx.replyWithMarkdown(text, {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // Кнопка для создания нового задания и возврата
  const finalButtons = [
    [Markup.button.callback('➕ Добавить задание', 'admin_addtask')],
    [Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]
  ];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: finalButtons },
  });
}

async function handleAddTaskInput(ctx) {
  const chatId = ctx.chat.id;
  if (!taskCreation.has(chatId)) return false;

  const state = taskCreation.get(chatId);
  const text = ctx.message.text;

  if (state.step === 1) {
    state.data.channelLink = text;
    state.data.channelUsername = extractUsername(text);
    state.step = 2;
    await ctx.reply('📝 Шаг 2 из 4: Введите описание задания (или отправьте пустое сообщение, чтобы пропустить):');
    return true;
  }

  if (state.step === 2) {
    state.data.description = text.trim() || null;
    state.step = 3;
    const signals = await Signal.findAll({ order: [['createdAt', 'DESC']] });
    if (signals.length === 0) {
      const noSignalButtons = [
        [Markup.button.callback('🚫 Без сигнала', 'select_signal_none')],
        [Markup.button.callback('➕ Создать сигнал', 'create_signal_first')]
      ];
      await ctx.reply('Нет доступных сигналов. Выберите действие:', {
        reply_markup: { inline_keyboard: noSignalButtons },
      });
      return true;
    }
    const buttons = signals.map(s => 
      Markup.button.callback(`${s.text.substring(0, 30)}...`, `select_signal_${s.id}`)
    );
    buttons.push(Markup.button.callback('🚫 Без сигнала', 'select_signal_none'));
    
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }
    await ctx.reply('📝 Шаг 3 из 4: Выберите сигнал, который получит пользователь за выполнение (или пропустите):', {
      reply_markup: { inline_keyboard: keyboard },
    });
    return true;
  }

  // Шаг 4 – ответ на вопрос о показе в BetusX
  if (state.step === 4) {
    const answer = text.toLowerCase();
    let showInBetusX;
    if (answer === 'да' || answer === 'yes' || answer === 'д') {
      showInBetusX = true;
    } else if (answer === 'нет' || answer === 'no' || answer === 'н') {
      showInBetusX = false;
    } else {
      await ctx.reply('❌ Пожалуйста, ответьте "Да" или "Нет".');
      return true;
    }

    try {
      const task = await Task.create({
        channelUsername: state.data.channelUsername,
        channelLink: state.data.channelLink,
        description: state.data.description,
        signalId: state.data.signalId,
        active: true,
        showInBetusX: showInBetusX,
      });
      await ctx.reply(`✅ Задание #${task.id} успешно создано!`);
      const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
      await ctx.reply('Что делаем дальше?', {
        reply_markup: { inline_keyboard: backButtons },
      });
    } catch (error) {
      console.error('Ошибка создания задания:', error);
      await ctx.reply('❌ Ошибка при сохранении задания.');
    } finally {
      taskCreation.delete(chatId);
    }
    return true;
  }

  return false;
}

async function handleSignalSelection(ctx) {
  const chatId = ctx.chat.id;
  if (!taskCreation.has(chatId)) {
    await ctx.answerCbQuery('Сессия создания задания не найдена. Начните заново.');
    return;
  }

  const state = taskCreation.get(chatId);
  const action = ctx.callbackQuery.data;

  if (action === 'select_signal_none') {
    state.data.signalId = null;
  } else if (action === 'create_signal_first') {
    // Очищаем состояние задания и запускаем создание сигнала
    taskCreation.delete(chatId);
    await ctx.answerCbQuery('Переходим к созданию сигнала');
    await addSignalCommand(ctx);
    return;
  } else {
    const match = action.match(/^select_signal_(\d+)$/);
    if (match) {
      state.data.signalId = parseInt(match[1]);
    } else {
      await ctx.answerCbQuery('Неверный выбор');
      return;
    }
  }

  // Переходим к шагу 4
  state.step = 4;
  await ctx.editMessageText('📝 Шаг 4 из 4: Показывать этот канал в разделе BetusX? (Ответьте "Да" или "Нет")');
}

// Обработчики для кнопок управления заданием
async function handleTaskActivate(ctx, taskId) {
  const task = await Task.findByPk(taskId);
  if (!task) {
    await ctx.answerCbQuery('❌ Задание не найдено');
    return;
  }
  task.active = true;
  await task.save();
  await ctx.answerCbQuery('✅ Задание активировано');
  await updateTaskMessage(ctx, task);
}

async function handleTaskDeactivate(ctx, taskId) {
  const task = await Task.findByPk(taskId);
  if (!task) {
    await ctx.answerCbQuery('❌ Задание не найдено');
    return;
  }
  task.active = false;
  await task.save();
  await ctx.answerCbQuery('✅ Задание деактивировано');
  await updateTaskMessage(ctx, task);
}

async function handleTaskToggleBetusX(ctx, taskId) {
  const task = await Task.findByPk(taskId);
  if (!task) {
    await ctx.answerCbQuery('❌ Задание не найдено');
    return;
  }
  task.showInBetusX = !task.showInBetusX;
  await task.save();
  await ctx.answerCbQuery(`🔄 Статус BetusX изменён на ${task.showInBetusX ? '✅' : '❌'}`);
  await updateTaskMessage(ctx, task);
}

async function updateTaskMessage(ctx, task) {
  // Обновляем сообщение с заданием
  const signalInfo = task.signal ? `Сигнал: #${task.signal.id}` : 'Сигнал: не привязан';
  const betusxStatus = task.showInBetusX ? '✅' : '❌';
  const text = `*ID:* ${task.id}\n` +
    `*Канал:* ${task.channelUsername}\n` +
    `*Активно:* ${task.active ? '✅' : '❌'}\n` +
    `*BetusX:* ${betusxStatus}\n` +
    `*${signalInfo}*`;

  const buttons = [
    [
      Markup.button.callback('✅ Активировать', `task_activate_${task.id}`),
      Markup.button.callback('❌ Деактивировать', `task_deactivate_${task.id}`)
    ],
    [
      Markup.button.callback(`🔄 BetusX (сейчас ${task.showInBetusX ? '✅' : '❌'})`, `task_toggle_betusx_${task.id}`)
    ]
  ];

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  }).catch(() => {}); // игнорируем ошибку, если сообщение не изменилось
}

// Деактивация задания (старая версия, может быть удалена)
async function deactivateTask(ctx) {
  if (!isAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.deactivatingTask = true;
  await ctx.reply('Введите ID задания для деактивации:');
}

async function handleDeactivateInput(ctx) {
  if (!ctx.session || !ctx.session.deactivatingTask) return false;
  const taskId = parseInt(ctx.message.text);
  if (isNaN(taskId)) {
    await ctx.reply('❌ Введите число.');
    return true;
  }
  const task = await Task.findByPk(taskId);
  if (!task) {
    await ctx.reply('❌ Задание не найдено.');
    delete ctx.session.deactivatingTask;
    return true;
  }
  task.active = false;
  await task.save();
  await ctx.reply(`✅ Задание #${taskId} деактивировано.`);
  const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: backButtons },
  });
  delete ctx.session.deactivatingTask;
  return true;
}

// Активация задания (старая версия)
async function activateTask(ctx) {
  if (!isAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.activatingTask = true;
  await ctx.reply('Введите ID задания для активации:');
}

async function handleActivateInput(ctx) {
  if (!ctx.session || !ctx.session.activatingTask) return false;
  const taskId = parseInt(ctx.message.text);
  if (isNaN(taskId)) {
    await ctx.reply('❌ Введите число.');
    return true;
  }
  const task = await Task.findByPk(taskId);
  if (!task) {
    await ctx.reply('❌ Задание не найдено.');
    delete ctx.session.activatingTask;
    return true;
  }
  task.active = true;
  await task.save();
  await ctx.reply(`✅ Задание #${taskId} активировано.`);
  const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: backButtons },
  });
  delete ctx.session.activatingTask;
  return true;
}

// ====================== УПРАВЛЕНИЕ СИГНАЛАМИ ======================

const signalCreation = new Map(); // key: chatId, value: { step, data }
const signalEditing = new Map(); // key: chatId, value: { signalId, step, data }

async function addSignalCommand(ctx) {
  if (!isAdmin(ctx)) return;
  const chatId = ctx.chat.id;
  signalCreation.set(chatId, { step: 'text', data: {} });
  await ctx.reply('📝 Введите текст сигнала (можно использовать Markdown):');
}

async function listSignalsCommand(ctx) {
  if (!isAdmin(ctx)) return;
  const signals = await Signal.findAll({ order: [['createdAt', 'DESC']] });
  if (signals.length === 0) {
    const buttons = [
      [Markup.button.callback('➕ Создать сигнал', 'admin_addsignal')],
      [Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]
    ];
    return ctx.reply('Нет созданных сигналов.', {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  for (const signal of signals) {
    const status = signal.scheduledTime
      ? (signal.sent ? '✅ Отправлен' : '⏳ Ожидает ' + new Date(signal.scheduledTime).toLocaleString())
      : '📝 Ручной';
    const shortText = signal.text.length > 50 ? signal.text.substring(0, 50) + '…' : signal.text;
    const buttons = [
      [
        Markup.button.callback('📤 Отправить', `signal_send_${signal.id}`),
        Markup.button.callback('✏️ Ред.', `signal_edit_${signal.id}`),
        Markup.button.callback('❌ Удалить', `signal_delete_${signal.id}`)
      ]
    ];
    await ctx.replyWithMarkdown(
      `*ID:* ${signal.id}\n*Статус:* ${status}\n*Текст:* ${shortText}`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }

  const finalButtons = [
    [Markup.button.callback('➕ Создать новый сигнал', 'admin_addsignal')],
    [Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]
  ];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: finalButtons },
  });
}

async function handleSignalActions(ctx) {
  if (!isAdmin(ctx)) return;
  const action = ctx.callbackQuery.data;
  const matchSend = action.match(/^signal_send_(\d+)$/);
  const matchEdit = action.match(/^signal_edit_(\d+)$/);
  const matchDelete = action.match(/^signal_delete_(\d+)$/);

  if (matchSend) {
    const signalId = parseInt(matchSend[1]);
    await sendSignalNow(ctx, signalId);
  } else if (matchEdit) {
    const signalId = parseInt(matchEdit[1]);
    await startEditSignal(ctx, signalId);
  } else if (matchDelete) {
    const signalId = parseInt(matchDelete[1]);
    await deleteSignal(ctx, signalId);
  }
}

async function sendSignalNow(ctx, signalId) {
  const signal = await Signal.findByPk(signalId);
  if (!signal) {
    await ctx.answerCbQuery('Сигнал не найден');
    return;
  }
  await ctx.answerCbQuery('⏳ Начинаю рассылку...');

  const users = await User.findAll();
  let success = 0;
  for (const user of users) {
    try {
      await sendSignalToUser(ctx.telegram, user.telegramId, signal);
      success++;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      console.error(`Ошибка отправки сигнала пользователю ${user.telegramId}:`, err);
    }
  }

  if (signal.scheduledTime) {
    signal.sent = true;
    await signal.save();
  }

  await ctx.reply(`✅ Рассылка сигнала #${signalId} завершена. Отправлено ${success} пользователям.`);
  const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: backButtons },
  });
}

async function sendSignalToUser(telegram, telegramId, signal) {
  const text = `📈 *Сигнал BetusX*\n\n${signal.text}`;
  if (signal.imageFileId) {
    await telegram.sendPhoto(telegramId, signal.imageFileId, { caption: text, parse_mode: 'Markdown' });
  } else {
    await telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
  }
}

async function deleteSignal(ctx, signalId) {
  const signal = await Signal.findByPk(signalId);
  if (!signal) {
    await ctx.answerCbQuery('Сигнал не найден');
    return;
  }
  await signal.destroy();
  await ctx.answerCbQuery('✅ Сигнал удалён');
  await ctx.editMessageText('Сигнал удалён.');
  const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
  await ctx.reply('Что делаем дальше?', {
    reply_markup: { inline_keyboard: backButtons },
  });
}

// ====================== РЕДАКТИРОВАНИЕ СИГНАЛА ======================

async function startEditSignal(ctx, signalId) {
  const signal = await Signal.findByPk(signalId);
  if (!signal) {
    await ctx.answerCbQuery('Сигнал не найден');
    return;
  }

  const chatId = ctx.chat.id;
  signalEditing.set(chatId, {
    signalId: signal.id,
    step: 'text',
    data: {
      text: signal.text,
      imageFileId: signal.imageFileId,
      scheduledTime: signal.scheduledTime,
      sent: signal.sent
    }
  });

  await ctx.answerCbQuery('🔄 Редактирование сигнала');
  await ctx.replyWithMarkdown(
    `*Текущий текст сигнала:*\n${signal.text}\n\n` +
    `Отправьте *новый текст* (или "-", чтобы оставить без изменений):`
  );
}

async function handleEditSignalInput(ctx) {
  const chatId = ctx.chat.id;
  if (!signalEditing.has(chatId)) return false;

  const state = signalEditing.get(chatId);
  const text = ctx.message.text;

  if (state.step === 'text') {
    if (text !== '-') {
      state.data.text = text;
    }
    state.step = 'image';
    await ctx.reply('📷 Отправьте *новое изображение* для сигнала (или "-", чтобы оставить текущее, или "удалить", чтобы убрать фото):');
    return true;
  }

  if (state.step === 'image') {
    if (text.toLowerCase() === 'удалить') {
      state.data.imageFileId = null;
    } else if (text !== '-') {
      await ctx.reply('❌ Пожалуйста, отправьте изображение, "-" или "удалить".');
      return true;
    }
    state.step = 'scheduled';
    const currentTime = state.data.scheduledTime ? new Date(state.data.scheduledTime).toLocaleString() : 'не задано';
    await ctx.reply(
      `🕒 *Текущее время отправки:* ${currentTime}\n\n` +
      `Введите *новое время* в формате ГГГГ-ММ-ДД ЧЧ:ММ (или "-", чтобы оставить без изменений, или "удалить", чтобы убрать автоматическую отправку):`
    );
    return true;
  }

  if (state.step === 'scheduled') {
    if (text.toLowerCase() === 'удалить') {
      state.data.scheduledTime = null;
    } else if (text !== '-') {
      const scheduled = new Date(text);
      if (isNaN(scheduled.getTime())) {
        await ctx.reply('❌ Неверный формат. Используйте ГГГГ-ММ-ДД ЧЧ:ММ');
        return true;
      }
      if (scheduled <= new Date()) {
        await ctx.reply('❌ Время должно быть в будущем.');
        return true;
      }
      state.data.scheduledTime = scheduled;
      state.data.sent = false;
    }

    try {
      const signal = await Signal.findByPk(state.signalId);
      if (!signal) {
        await ctx.reply('❌ Сигнал не найден.');
        signalEditing.delete(chatId);
        return true;
      }

      signal.text = state.data.text;
      signal.imageFileId = state.data.imageFileId;
      signal.scheduledTime = state.data.scheduledTime;
      signal.sent = state.data.sent || false;
      await signal.save();

      await ctx.reply(`✅ Сигнал #${state.signalId} успешно обновлён!`);
      const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
      await ctx.reply('Что делаем дальше?', {
        reply_markup: { inline_keyboard: backButtons },
      });
    } catch (error) {
      console.error('Ошибка обновления сигнала:', error);
      await ctx.reply('❌ Ошибка при сохранении изменений.');
    } finally {
      signalEditing.delete(chatId);
    }
    return true;
  }

  return false;
}

async function handleEditSignalPhoto(ctx) {
  const chatId = ctx.chat.id;
  if (!signalEditing.has(chatId)) return false;
  const state = signalEditing.get(chatId);
  if (state.step === 'image' && ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    state.data.imageFileId = fileId;
    state.step = 'scheduled';
    const currentTime = state.data.scheduledTime ? new Date(state.data.scheduledTime).toLocaleString() : 'не задано';
    await ctx.reply(
      `✅ Изображение обновлено.\n\n` +
      `🕒 *Текущее время отправки:* ${currentTime}\n\n` +
      `Введите *новое время* в формате ГГГГ-ММ-ДД ЧЧ:ММ (или "-", чтобы оставить без изменений, или "удалить", чтобы убрать автоматическую отправку):`
    );
    return true;
  }
  return false;
}

// ====================== ОБРАБОТКА ТЕКСТА И ФОТО (ОСНОВНАЯ) ======================

async function handleAddSignalInput(ctx) {
  const chatId = ctx.chat.id;
  if (!signalCreation.has(chatId)) return false;
  const state = signalCreation.get(chatId);
  const text = ctx.message.text;

  if (state.step === 'text') {
    state.data.text = text;
    state.step = 'image';
    await ctx.reply('📝 Отправьте изображение для сигнала (или отправьте "пропустить"):');
    return true;
  }

  if (state.step === 'image') {
    if (text.toLowerCase() === 'пропустить' || text === '/skip') {
      state.data.imageFileId = null;
      state.step = 'scheduled';
      await ctx.reply('📝 Введите время автоматической отправки в формате ГГГГ-ММ-ДД ЧЧ:ММ (или "пропустить"):');
      return true;
    } else {
      await ctx.reply('❌ Ожидается изображение или команда "пропустить".');
      return true;
    }
  }

  if (state.step === 'scheduled') {
    if (text.toLowerCase() === 'пропустить') {
      state.data.scheduledTime = null;
    } else {
      const scheduled = new Date(text);
      if (isNaN(scheduled.getTime())) {
        await ctx.reply('❌ Неверный формат. Используйте ГГГГ-ММ-ДД ЧЧ:ММ');
        return true;
      }
      if (scheduled <= new Date()) {
        await ctx.reply('❌ Время должно быть в будущем.');
        return true;
      }
      state.data.scheduledTime = scheduled;
    }

    try {
      const signal = await Signal.create(state.data);
      await ctx.reply(`✅ Сигнал #${signal.id} успешно создан.`);
      const backButtons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
      await ctx.reply('Что делаем дальше?', {
        reply_markup: { inline_keyboard: backButtons },
      });
    } catch (error) {
      console.error(error);
      await ctx.reply('❌ Ошибка при сохранении сигнала.');
    } finally {
      signalCreation.delete(chatId);
    }
    return true;
  }

  return false;
}

async function handleAddSignalPhoto(ctx) {
  const chatId = ctx.chat.id;
  if (!signalCreation.has(chatId)) return false;
  const state = signalCreation.get(chatId);
  if (state.step === 'image' && ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    state.data.imageFileId = fileId;
    state.step = 'scheduled';
    await ctx.reply('✅ Изображение получено. Введите время автоматической отправки в формате ГГГГ-ММ-ДД ЧЧ:ММ (или "пропустить"):');
    return true;
  }
  return false;
}

// ====================== КОМАНДА /cancel ======================

async function cancelCommand(ctx) {
  const chatId = ctx.chat.id;
  if (taskCreation.has(chatId)) {
    taskCreation.delete(chatId);
    await ctx.reply('🚫 Создание задания отменено.');
  } else if (signalCreation.has(chatId)) {
    signalCreation.delete(chatId);
    await ctx.reply('🚫 Создание сигнала отменено.');
  } else if (signalEditing.has(chatId)) {
    signalEditing.delete(chatId);
    await ctx.reply('🚫 Редактирование сигнала отменено.');
  } else if (ctx.session) {
    ctx.session = {};
    await ctx.reply('🚫 Действие отменено.');
  } else {
    await ctx.reply('Нет активного процесса для отмены.');
  }
}

// ====================== СТАТИСТИКА ======================

async function statsCommand(ctx) {
  if (!isAdmin(ctx)) return;
  const totalUsers = await User.count();
  const totalTasks = await Task.count();
  const completedTasks = await CompletedTask.count();

  const text = `📊 *Статистика бота*\n\n` +
    `👥 Пользователей: ${totalUsers}\n` +
    `📋 Заданий всего: ${totalTasks}\n` +
    `✅ Выполнено заданий: ${completedTasks}`;

  const buttons = [[Markup.button.callback('◀️ Назад в админ-меню', 'admin_back')]];
  await ctx.replyWithMarkdown(text, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ====================== ЭКСПОРТ ======================

module.exports = {
  // админ-меню
  showAdminMenu,
  handleAdminBack,
  // задания
  addTaskCommand,
  listTasksCommand,
  handleAddTaskInput,
  handleSignalSelection,
  deactivateTask,
  handleDeactivateInput,
  activateTask,
  handleActivateInput,
  // сигналы
  addSignalCommand,
  listSignalsCommand,
  handleSignalActions,
  handleAddSignalInput,
  handleAddSignalPhoto,
  handleEditSignalInput,
  handleEditSignalPhoto,
  // общее
  cancelCommand,
  statsCommand,
  // дополнительные обработчики для кнопок заданий (будут вызваны из index.js)
  handleTaskActivate,
  handleTaskDeactivate,
  handleTaskToggleBetusX,
};