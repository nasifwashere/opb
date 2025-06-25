import { Sequelize, DataTypes } from 'sequelize';
import { sequelize } from './User.js';

const CardInstance = sequelize.define('CardInstance', {
  userId: DataTypes.STRING,
  cardName: DataTypes.STRING,
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  locked: { type: DataTypes.BOOLEAN, defaultValue: false }
});

export default CardInstance;