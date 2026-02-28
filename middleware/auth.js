const { User } = require('../models');
const config = require('../config');

/**
 * Проверяет, является ли пользователь администратором
 * @param {import('telegraf').Context} ctx
 * @returns {boolean}
 */
function isAdmin(ctx) {
  return config.ADMIN_IDS.includes(ctx.from?.id);
}

/**
 * Middleware для проверки прав администратора.
 * Если пользователь не админ, отправляет сообщение о запрете и прекращает выполнение.
 */
async function adminMiddleware(ctx, next) {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ У вас нет прав для выполнения этой команды.');
  }
  return next();
}

/**
 * Проверяет, зарегистрирован ли пользователь в базе данных
 * @param {import('telegraf').Context} ctx
 * @returns {Promise<boolean>}
 */
async function isUserRegistered(ctx) {
  if (!ctx.from) return false;
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  return !!user;
}

/**
 * Middleware для проверки регистрации пользователя.
 * Если пользователь не зарегистрирован, предлагает ввести /start.
 */
async function userMiddleware(ctx, next) {
  const registered = await isUserRegistered(ctx);
  if (!registered) {
    return ctx.reply('❌ Вы не зарегистрированы. Введите /start для начала работы.');
  }
  return next();
}

module.exports = {
  isAdmin,
  adminMiddleware,
  isUserRegistered,
  userMiddleware,
};