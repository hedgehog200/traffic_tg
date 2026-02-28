require('dotenv').config();

// Функция для проверки обязательных переменных окружения
function checkRequiredEnv(vars) {
  const missing = vars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`❌ Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
  }
}

// Проверяем обязательные переменные для продакшена
if (process.env.NODE_ENV === 'production') {
  checkRequiredEnv([
    'BOT_TOKEN',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'BETUSX_PARTNER_LINK',
  ]);
}

module.exports = {
  // Основные настройки бота
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_IDS: process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) 
    : [],
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Настройки базы данных
  DB: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
  },

  // Партнёрская ссылка BetusX
  BETUSX_PARTNER_LINK: process.env.BETUSX_PARTNER_LINK,
  ADD_UTM: process.env.ADD_UTM === 'true', // добавлять ли UTM-метки

  // Промокод BetusX
  BETUSX_PROMOCODE: process.env.BETUSX_PROMOCODE || '',

  // Каналы BetusX для подписки (ожидается JSON-строка вида [{"name":"Название","url":"https://t.me/..."}])
  BETUSX_CHANNELS: process.env.BETUSX_CHANNELS 
    ? JSON.parse(process.env.BETUSX_CHANNELS) 
    : [],

  // Порт для сервера (например, для вебхуков)
  PORT: parseInt(process.env.PORT) || 8080,
};