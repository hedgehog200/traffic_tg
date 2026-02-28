// utils/db.js
const { Sequelize } = require('sequelize');
const config = require('../config');

// Создание экземпляра Sequelize для подключения к MySQL
const sequelize = new Sequelize(
  config.DB.database,
  config.DB.user,
  config.DB.password,
  {
    host: config.DB.host,
    dialect: 'mysql',
    logging: false, // отключаем вывод SQL-запросов в консоль (для продакшена)
    pool: {
      max: 10,              // максимальное количество соединений в пуле
      min: 0,               // минимальное количество соединений
      acquire: 30000,       // максимальное время (в мс) для получения соединения
      idle: 10000           // время простоя соединения (в мс) после которого оно освобождается
    },
    define: {
      timestamps: true,     // автоматически добавлять поля createdAt и updatedAt
      underscored: false    // использовать camelCase для имен полей (по умолчанию)
    },
    retry: {
      max: 3                // количество повторных попыток при неудачном подключении
    }
  }
);

// Экспортируем экземпляр sequelize для использования в моделях
module.exports = sequelize;