const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Уникальный идентификатор задания',
    },
    channelUsername: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Username канала (например, @channel)',
    },
    channelLink: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Ссылка на канал для перехода',
    },
    description: {
      type: DataTypes.TEXT,
      comment: 'Описание задания (необязательно)',
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Активно ли задание (доступно для выполнения)',
    },
    signalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Signals',
        key: 'id',
      },
      comment: 'ID сигнала, выдаваемого за выполнение задания',
    },
    showInBetusX: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Показывать ли этот канал в разделе BetusX',
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['active'],
        name: 'task_active_idx',
      },
      {
        fields: ['channelUsername'],
        name: 'task_channel_username_idx',
      },
      {
        fields: ['signalId'],
        name: 'task_signal_idx',
      },
      {
        fields: ['showInBetusX'],
        name: 'task_showInBetusX_idx',
      },
    ],
  });

  return Task;
};