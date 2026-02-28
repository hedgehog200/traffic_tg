const rateLimit = require('telegraf-ratelimit');

// Простая реализация без внешней библиотеки (опционально)
const rateLimitMap = new Map(); // chatId -> { count, lastReset }

/**
 * Самодельный rate limit middleware (ограничение: не более limit сообщений за interval мс)
 * @param {number} limit - максимальное количество сообщений
 * @param {number} interval - интервал в миллисекундах
 */
function createRateLimit(limit = 5, interval = 1000) {
  return (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return next();

    const now = Date.now();
    const record = rateLimitMap.get(chatId) || { count: 0, lastReset: now };

    if (now - record.lastReset > interval) {
      record.count = 1;
      record.lastReset = now;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(chatId, record);

    if (record.count > limit) {
      return ctx.reply('⏳ Слишком много запросов. Пожалуйста, подождите.');
    }

    return next();
  };
}

// Для использования готовой библиотеки telegraf-ratelimit (предпочтительно)
const telegrafRateLimit = rateLimit({
  window: 1000, // 1 секунда
  limit: 5,
  onLimitExceeded: (ctx, next) => {
    ctx.reply('⏳ Слишком много запросов. Пожалуйста, подождите.');
  },
});

module.exports = {
  createRateLimit,
  telegrafRateLimit, // готовый экземпляр
};