export function canLevelUp(cardInstance, duplicates) {
  // Duplicates = number of duplicate pulls owned
  return duplicates > 0 && cardInstance.level < 100;
}

// Example: Level up logic
export function levelUp(cardInstance, duplicates, amount) {
  let leveled = 0;
  while (duplicates > 0 && cardInstance.level < 100 && leveled < amount) {
    cardInstance.level++;
    duplicates--;
    leveled++;
  }
  return leveled;
}