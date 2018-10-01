process.env.NODE_ENV = 'test';
const { connection } = require('../src');

after(() => {
  setTimeout(connection.close, 2000);
});