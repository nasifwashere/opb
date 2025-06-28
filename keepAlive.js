// keepAlive.js
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

function keepAlive() {
  app.listen(port, () => {
    console.log(`[SERVER] Keep-alive server is running on port ${port}`);
  });
}

module.exports = { keepAlive };
