# 🏴‍☠️ One Piece Gacha Discord Bot

A Discord RPG bot themed around One Piece, featuring a gacha-style card system, PvE/PvP battles, progression, economy, and deep evolution/leveling mechanics.

## Features

- Card collection, leveling, and evolution
- PvE/PvP battle system (turn-based)
- Beli economy and player market
- Progression through One Piece sagas
- Slash & prefix command support
- SQLite for user/card data, lowdb for market/drops

## Setup

1. `npm install`
2. Fill in `.env` with your bot token.
3. Run with `npm start`

## File Structure

- `commands/` – All command handlers (prefix + slash)
- `data/cards.json` – Card definitions
- `db/models/` – Sequelize models (User, CardInstance, MarketListing)
- `events/` – Discord event handlers
- `utils/` – Helper systems (level, evolution, sagas)
- `index.js` – Entrypoint
