// utils/helpers.js
const config = require('../config');

/**
 * Извлекает username канала из ссылки или текста
 * @param {string} input - ссылка вида https://t.me/channel, t.me/channel, @channel или channel
 * @returns {string} - username с @
 */
function extractUsername(input) {
  if (!input) return '';
  const match = input.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)/);
  if (match) return '@' + match[1];
  if (input.startsWith('@')) return input;
  return '@' + input;
}

/**
 * Форматирует дату в локальную строку
 * @param {Date|string} date - дата
 * @returns {string} - отформатированная дата
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Генерирует случайную строку заданной длины
 * @param {number} length - длина строки
 * @returns {string} - случайная строка
 */
function randomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Проверяет, является ли пользователь администратором
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {boolean}
 */
function isAdmin(telegramId) {
  return config.ADMIN_IDS.includes(telegramId);
}

/**
 * Безопасное выполнение асинхронной функции с логированием ошибок
 * @param {Function} fn - асинхронная функция
 * @param {string} errorMessage - сообщение об ошибке для логирования
 * @returns {Promise<any>}
 */
async function safeAsync(fn, errorMessage = 'Ошибка выполнения') {
  try {
    return await fn();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return null;
  }
}

/**
 * Проверяет, подписан ли пользователь на канал
 * @param {import('telegraf').Telegraf} bot - экземпляр бота
 * @param {string} channelUsername - username канала (с @)
 * @param {number} userId - Telegram ID пользователя
 * @returns {Promise<boolean>} - true если подписан
 */
async function checkSubscription(bot, channelUsername, userId) {
  try {
    const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    const chatMember = await bot.telegram.getChatMember(chatId, userId);
    return ['member', 'administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    return false;
  }
}

/**
 * Задержка (sleep)
 * @param {number} ms - миллисекунды
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Экранирует Markdown-символы для безопасного использования в сообщениях
 * @param {string} text - исходный текст
 * @returns {string} - экранированный текст
 */
function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = {
  extractUsername,
  formatDate,
  randomString,
  isAdmin,
  safeAsync,
  checkSubscription,
  sleep,
  escapeMarkdown,
};