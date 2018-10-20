const apiql = require('apiql-express');
const express = require('express');

const app = express();
const port = 3000;

app.use(apiql());

app.listen(port, () => console.log(`Example proxy listening on port ${port}!`));
