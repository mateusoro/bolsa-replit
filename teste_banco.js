var sqlite3 = require('sqlite3');
var {open} = require('sqlite');
var db;

  (async () => {
    db = await open({
      filename: 'sqlite.db',
      driver: sqlite3.cached.Database
    })
    var docs = await db.all('select * from status')
    console.log(docs);     
})()