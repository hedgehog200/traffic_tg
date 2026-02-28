const sequelize = require('../utils/db');
const User = require('./User')(sequelize);
const Task = require('./Task')(sequelize);
const CompletedTask = require('./CompletedTask')(sequelize);
const Signal = require('./Signal')(sequelize);
const Purchase = require('./Purchase')(sequelize);

// ====================== СВЯЗИ МЕЖДУ МОДЕЛЯМИ ======================

// Задания и их выполнение
User.hasMany(CompletedTask, { foreignKey: 'userId' });
CompletedTask.belongsTo(User, { foreignKey: 'userId' });

Task.hasMany(CompletedTask, { foreignKey: 'taskId' });
CompletedTask.belongsTo(Task, { foreignKey: 'taskId' });

// Связь задания с сигналом (каждое задание может выдавать сигнал)
Task.belongsTo(Signal, { foreignKey: 'signalId', as: 'signal' });
Signal.hasMany(Task, { foreignKey: 'signalId', as: 'tasks' });

// Покупки/получения сигналов
User.hasMany(Purchase, { foreignKey: 'userId' });
Purchase.belongsTo(User, { foreignKey: 'userId' });

Signal.hasMany(Purchase, { foreignKey: 'signalId' });
Purchase.belongsTo(Signal, { foreignKey: 'signalId' });

// ====================== ЭКСПОРТ ======================
module.exports = {
  sequelize,
  User,
  Task,
  CompletedTask,
  Signal,
  Purchase,
};