var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('sqlite.db');

async function teste() {
    try {
        console.log(1);
        var docs = await db.run('insert into status values()')
        console.log(docs);        
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();