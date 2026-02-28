const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Уникальный идентификатор записи о получении сигнала',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      comment: 'ID пользователя, получившего сигнал',
    },
    signalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Signals',
        key: 'id',
      },
      comment: 'ID полученного сигнала',
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Цена сигнала (всегда 0 в текущей версии)',
    },
    purchasedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Дата и время получения',
    },
  }, {
    timestamps: false,
    indexes: [
      {
        fields: ['userId'],
        name: 'purchase_user_idx',
      },
      {
        fields: ['signalId'],
        name: 'purchase_signal_idx',
      },
    ],
  });

  return Purchase;
};