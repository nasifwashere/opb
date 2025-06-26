export const data = { name: 'help', description: 'Show all commands and usage.' };

export async function execute(message) {
  const helpMsg = `
**One Piece Gacha Bot Commands**
op start – Begin your pirate adventure!
op pull – Pull a random card every 8h
op collection [rank/up/down] – View your collection
op info "card" – Card details
op lock "card" – Lock a card
op sell "card" "price" – List a card for sale
op buy "id" – Buy from market
op market – View market
op balance – Your Beli
op leaderboard [beli/wins] – Leaderboard
op evolve "card" – Evolve a card
op level "card" "amount" – Level up a card
op quest – Complete a quest
op explore – Unlock new saga
op progress – Your saga
op map – Saga map
op team – View your team
op team add "card" – Add card to team
op team remove "card" – Remove from team
op battle – PvE battle
op duel @user – PvP duel
op set/disallow "channel" – Server setup
`;
  message.reply(helpMsg);
}