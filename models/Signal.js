const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Signal = sequelize.define('Signal', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Уникальный идентификатор сигнала',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Текст сигнала (прогноза)',
    },
    imageFileId: {
      type: DataTypes.STRING,
      comment: 'File_id изображения из Telegram (опционально)',
    },
    price: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: 'Цена сигнала в рублях (0 – бесплатный)',
    },
    scheduledTime: {
      type: DataTypes.DATE,
      comment: 'Время автоматической отправки сигнала (если задано)',
    },
    sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Флаг, что сигнал уже отправлен по расписанию',
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['scheduledTime'],
        name: 'signal_scheduled_time_idx',
      },
      {
        fields: ['sent'],
        name: 'signal_sent_idx',
      },
      {
        fields: ['price'],
        name: 'signal_price_idx',
      },
    ],
  });

  return Signal;
};