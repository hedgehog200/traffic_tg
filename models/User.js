const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Уникальный идентификатор пользователя',
    },
    telegramId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
      comment: 'Telegram ID пользователя',
    },
    username: {
      type: DataTypes.STRING,
      comment: 'Username пользователя в Telegram (без @)',
    },
    firstName: {
      type: DataTypes.STRING,
      comment: 'Имя пользователя',
    },
    lastName: {
      type: DataTypes.STRING,
      comment: 'Фамилия пользователя',
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['telegramId'],
        unique: true,
        name: 'user_telegram_id_idx',
      },
    ],
  });

  return User;
};