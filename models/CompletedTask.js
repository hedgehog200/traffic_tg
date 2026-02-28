const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompletedTask = sequelize.define('CompletedTask', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Уникальный идентификатор записи о выполнении',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      comment: 'ID пользователя, выполнившего задание',
    },
    taskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Tasks',
        key: 'id',
      },
      comment: 'ID выполненного задания',
    },
    completedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Дата и время выполнения',
    },
  }, {
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'taskId'],
        name: 'unique_user_task',
      },
    ],
  });

  return CompletedTask;
};