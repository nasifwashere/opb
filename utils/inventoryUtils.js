// Normalize any inventory value to a flat array of strings
function normalizeInventory(inv) {
  if (!Array.isArray(inv)) {
    if (inv && typeof inv === 'object') {
      return Object.keys(inv).reduce((arr, key) => {
        for (let i = 0; i < inv[key]; i++) arr.push(key);
        return arr;
      }, []);
    } else {
      return [];
    }
  } else if (
    inv.length === 1 &&
    typeof inv[0] === 'object' &&
    !Array.isArray(inv[0])
  ) {
    // Handle [ { basicpotion: 12, ... } ]
    return Object.keys(inv[0]).reduce((arr, key) => {
      for (let i = 0; i < inv[0][key]; i++) arr.push(key);
      return arr;
    }, []);
  } else {
    return inv.flat().map(String);
  }
}

module.exports = { normalizeInventory };
