const sagas = [
  "East Blue",
  "Alabasta",
  "Water 7",
  "Enies Lobby",
  "Thriller Bark",
  "Sabaody",
  "Marineford",
  "Dressrosa",
  "Whole Cake",
  "Wano"
];

function getNextSaga(currentSaga) {
  const idx = sagas.indexOf(currentSaga);
  return sagas[idx + 1] || null;
}

module.exports = { sagas, getNextSaga };
