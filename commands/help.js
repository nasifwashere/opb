export const data = { name: 'help', description: 'Show all commands.' };

export async function execute(message, args, client) {
  message.reply(`
🏴‍☠️ **One Piece Gacha Bot** – Commands
• op pull – Pull a random card every 8h
• op collection – View your collection
• op info "card" – Card stats, evolutions
• op evolve "card" – Evolve a card
• op level "card" *"amount" – Level up card
• op battle – PvE boss fight
• op duel @user – PvP
• op team – View/manage team
• op balance – View Beli
• op market – Player market
• op buy "card" "id" – Buy from market
• op sell "card" "price" – Sell a card
• op explore – Unlock new saga
• op quest – Complete quests
• op progress – Show your saga
• op map – Saga map
• op leaderboard "beli"/"wins"
• op help – Show commands
  `);
}