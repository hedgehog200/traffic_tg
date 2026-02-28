// utils/scheduler.js
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Signal, User } = require('../models');

/**
 * Отправляет сигнал конкретному пользователю через бота
 * @param {number} telegramId - Telegram ID пользователя
 * @param {Object} signal - объект сигнала (из модели Signal)
 * @param {import('telegraf').Telegraf} bot - экземпляр бота
 * @returns {Promise<boolean>} - успешность отправки
 */
async function sendSignalToUser(telegramId, signal, bot) {
  const text = `📈 *Сигнал BetusX (по расписанию)*\n\n${signal.text}`;
  try {
    if (signal.imageFileId) {
      await bot.telegram.sendPhoto(telegramId, signal.imageFileId, {
        caption: text,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
    }
    return true;
  } catch (error) {
    // Если пользователь заблокировал бота или другие ошибки – логируем, но не прерываем
    console.error(`Ошибка отправки сигнала пользователю ${telegramId}:`, error.message);
    return false;
  }
}

/**
 * Запускает планировщик для автоматической рассылки сигналов
 * @param {import('telegraf').Telegraf} bot - экземпляр бота
 */
function startScheduler(bot) {
  if (!bot) {
    throw new Error('Bot instance is required for scheduler');
  }

  // Запускаем задачу каждую минуту
  cron.schedule('* * * * *', async () => {
    console.log('🔍 Проверка запланированных сигналов...');
    const now = new Date();

    try {
      // Находим сигналы, которые должны быть отправлены, но ещё не отправлены
      const signals = await Signal.findAll({
        where: {
          scheduledTime: { [Op.lte]: now },
          sent: false,
        },
      });

      if (signals.length === 0) {
        return; // ничего не делаем
      }

      console.log(`📨 Найдено сигналов для отправки: ${signals.length}`);

      for (const signal of signals) {
        console.log(`⏳ Отправка сигнала #${signal.id} по расписанию`);
        const users = await User.findAll();

        let successCount = 0;
        for (const user of users) {
          const ok = await sendSignalToUser(user.telegramId, signal, bot);
          if (ok) successCount++;
          // Небольшая задержка между сообщениями, чтобы не превысить лимиты Telegram
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Помечаем сигнал как отправленный
        signal.sent = true;
        await signal.save();

        console.log(`✅ Сигнал #${signal.id} отправлен ${successCount} из ${users.length} пользователям`);
      }
    } catch (error) {
      console.error('❌ Ошибка в планировщике:', error);
    }
  });

  console.log('⏰ Планировщик запущен (проверка каждую минуту)');
}

module.exports = { startScheduler };