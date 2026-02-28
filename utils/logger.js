const fs = require('fs');
const path = require('path');

// Уровни логирования
const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Текущий уровень из переменной окружения (по умолчанию info)
const currentLevel = process.env.LOG_LEVEL ? levels[process.env.LOG_LEVEL.toLowerCase()] : levels.info;

// Директория для логов (по умолчанию ./logs)
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Возвращает путь к файлу лога на текущую дату (YYYY-MM-DD)
 */
function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10); // формат YYYY-MM-DD
  return path.join(logDir, `app-${date}.log`);
}

/**
 * Запись строки в файл лога (добавление в конец)
 */
function writeToFile(message) {
  const filePath = getLogFilePath();
  fs.appendFileSync(filePath, message + '\n', 'utf8');
}

/**
 * Форматирование метки времени [ЧЧ:ММ:СС.мс]
 */
function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('ru-RU', { hour12: false }) + '.' + now.getMilliseconds().toString().padStart(3, '0');
}

/**
 * Основная функция логирования
 * @param {number} level - уровень (0-3)
 * @param {string} message - текст сообщения
 * @param {any} data - дополнительные данные (ошибка, объект)
 * @param {string} context - контекст (например, модуль или chatId)
 */
function log(level, message, data = null, context = '') {
  if (level < currentLevel) return;

  const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const timestamp = getTimestamp();
  const contextPart = context ? ` [${context}]` : '';
  const logLine = `[${timestamp}] [${levelNames[level]}]${contextPart} ${message}`;

  // Цветной вывод в консоль
  switch (level) {
    case levels.error:
      console.error('\x1b[31m%s\x1b[0m', logLine);
      break;
    case levels.warn:
      console.warn('\x1b[33m%s\x1b[0m', logLine);
      break;
    case levels.info:
      console.info('\x1b[36m%s\x1b[0m', logLine);
      break;
    default:
      console.log('\x1b[90m%s\x1b[0m', logLine);
  }

  // Запись в файл (без цветов)
  writeToFile(logLine);

  // Дополнительные данные (если есть)
  if (data) {
    let dataStr;
    if (data instanceof Error) {
      dataStr = data.stack;
    } else if (typeof data === 'object') {
      dataStr = JSON.stringify(data, null, 2);
    } else {
      dataStr = String(data);
    }
    // В консоль с отступом
    console.log('\x1b[2m', dataStr, '\x1b[0m');
    // В файл построчно
    dataStr.split('\n').forEach(line => writeToFile('  ' + line));
  }
}

// Публичные методы
const logger = {
  debug: (message, data, context) => log(levels.debug, message, data, context),
  info: (message, data, context) => log(levels.info, message, data, context),
  warn: (message, data, context) => log(levels.warn, message, data, context),
  error: (message, data, context) => log(levels.error, message, data, context),

  /**
   * Создаёт логгер с фиксированным контекстом (удобно для модулей)
   * @param {string} context - имя контекста (например, 'tasks')
   * @returns {object} - объект с методами debug/info/warn/error
   */
  getContextLogger: (context) => ({
    debug: (msg, data) => log(levels.debug, msg, data, context),
    info: (msg, data) => log(levels.info, msg, data, context),
    warn: (msg, data) => log(levels.warn, msg, data, context),
    error: (msg, data) => log(levels.error, msg, data, context),
  }),
};

module.exports = logger;