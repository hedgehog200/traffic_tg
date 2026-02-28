// utils/telegramHelpers.js
const { Markup } = require('telegraf');

/**
 * Проверяет, подписан ли пользователь на указанный канал
 * @param {import('telegraf').Telegraf} bot - экземпляр бота
 * @param {string} channelUsername - username канала (с @ или без)
 * @param {number} userId - Telegram ID пользователя
 * @returns {Promise<boolean>}
 */
async function isUserSubscribed(bot, channelUsername, userId) {
  try {
    const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    const chatMember = await bot.telegram.getChatMember(chatId, userId);
    const status = chatMember.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    return false;
  }
}

/**
 * Отправляет сообщение с подтверждением действия и кнопкой "Назад"
 * @param {import('telegraf').Context} ctx - контекст Telegraf
 * @param {string} text - текст сообщения
 * @param {string} backAction - название callback_data для кнопки "Назад"
 */
async function replyWithBackButton(ctx, text, backAction) {
  await ctx.reply(text, {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Назад', backAction)]
    ]),
  });
}

/**
 * Отправляет или редактирует сообщение с учётом наличия фото
 * @param {import('telegraf').Context} ctx - контекст Telegraf
 * @param {Object} options - параметры: text, photoFileId, parseMode, keyboard
 * @param {boolean} edit - редактировать ли существующее сообщение
 */
async function sendOrEditMessage(ctx, { text, photoFileId, parseMode = 'Markdown', keyboard = null }, edit = false) {
  const replyMarkup = keyboard ? { reply_markup: keyboard } : undefined;

  if (edit) {
    if (photoFileId && ctx.callbackQuery?.message?.photo) {
      await ctx.editMessageCaption({
        caption: text,
        parse_mode: parseMode,
        ...replyMarkup,
      });
    } else {
      await ctx.editMessageText(text, {
        parse_mode: parseMode,
        ...replyMarkup,
      });
    }
  } else {
    if (photoFileId) {
      await ctx.replyWithPhoto(photoFileId, {
        caption: text,
        parse_mode: parseMode,
        ...replyMarkup,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: parseMode,
        ...replyMarkup,
      });
    }
  }
}

/**
 * Удаляет клавиатуру из сообщения (заменяет на пустую)
 * @param {import('telegraf').Context} ctx
 * @param {string} text - новый текст (если не указан, оставляет старый)
 */
async function removeKeyboard(ctx, text) {
  const message = ctx.callbackQuery?.message;
  if (!message) return;

  const newText = text || message.text || message.caption;
  if (message.photo) {
    await ctx.editMessageCaption({
      caption: newText,
      reply_markup: { inline_keyboard: [] },
    });
  } else {
    await ctx.editMessageText(newText, {
      reply_markup: { inline_keyboard: [] },
    });
  }
}

/**
 * Безопасно отправляет сообщение с обработкой ошибок
 * @param {import('telegraf').Telegraf} bot
 * @param {number} chatId
 * @param {string} text
 * @param {Object} extra - дополнительные параметры
 * @returns {Promise<boolean>}
 */
async function safeSendMessage(bot, chatId, text, extra = {}) {
  try {
    await bot.telegram.sendMessage(chatId, text, extra);
    return true;
  } catch (error) {
    console.error(`Ошибка отправки сообщения ${chatId}:`, error.message);
    return false;
  }
}

module.exports = {
  isUserSubscribed,
  replyWithBackButton,
  sendOrEditMessage,
  removeKeyboard,
  safeSendMessage,
};