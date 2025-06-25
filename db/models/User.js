import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db/userdata.sqlite',
  logging: false
});

const User = sequelize.define('User', {
  userId: { type: DataTypes.STRING, unique: true },
  beli: { type: DataTypes.INTEGER, defaultValue: 0 },
  saga: { type: DataTypes.STRING, defaultValue: "East Blue" },
  team: { type: DataTypes.JSON, defaultValue: [] },
  wins: { type: DataTypes.INTEGER, defaultValue: 0 }
});

export default User;
export { sequelize };