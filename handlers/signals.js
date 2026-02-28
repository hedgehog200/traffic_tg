const { Markup } = require('telegraf');
const { Signal } = require('../models');

/**
 * Показывает список доступных сигналов (только для просмотра)
 * @param {import('telegraf').Context} ctx
 */
async function showSignals(ctx) {
  try {
    const signals = await Signal.findAll({
      order: [['createdAt', 'DESC']],
    });

    if (!signals.length) {
      return ctx.reply('📭 Пока нет доступных сигналов. Загляните позже.');
    }

    const buttons = signals.map(signal => {
      let title = signal.text.replace(/\*|_|`|\[.*?\]/g, '').substring(0, 35);
      if (title.length < signal.text.length) title += '…';
      // Добавляем иконку фото, если есть изображение
      const hasPhoto = signal.imageFileId ? ' 📸' : '';
      return [Markup.button.callback(title + hasPhoto, `signal_view_${signal.id}`)];
    });

    await ctx.reply('📈 *Доступные сигналы BetusX*\nВыберите сигнал для просмотра:', {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(buttons),
    });
  } catch (error) {
    console.error('Ошибка в showSignals:', error);
    await ctx.reply('❌ Произошла ошибка при загрузке сигналов.');
  }
}

/**
 * Показывает детальную информацию о выбранном сигнале
 * @param {import('telegraf').Context} ctx
 */
async function viewSignal(ctx) {
  try {
    const signalId = parseInt(ctx.callbackQuery.data.split('_')[2]);
    const signal = await Signal.findByPk(signalId);
    if (!signal) {
      await ctx.answerCbQuery('❌ Сигнал не найден');
      return;
    }

    await ctx.deleteMessage();

    const text = `📈 *Сигнал BetusX*\n\n${signal.text}`;
    const buttons = [[Markup.button.callback('◀️ Назад к списку', 'signals_list')]];

    if (signal.imageFileId) {
      await ctx.replyWithPhoto(signal.imageFileId, {
        caption: text,
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons),
      });
    } else {
      await ctx.replyWithMarkdown(text, {
        reply_markup: Markup.inlineKeyboard(buttons),
      });
    }
  } catch (error) {
    console.error('Ошибка в viewSignal:', error);
    await ctx.answerCbQuery('❌ Не удалось показать сигнал');
  }
}

module.exports = {
  showSignals,
  viewSignal,
};