import { Sequelize, DataTypes } from 'sequelize';
import { sequelize } from './User.js';

const MarketListing = sequelize.define('MarketListing', {
  sellerId: DataTypes.STRING,
  cardName: DataTypes.STRING,
  price: DataTypes.INTEGER,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

export default MarketListing;