var sqlite3 = require('sqlite3').verbose();


var db = {}
db = new sqlite3.Database('sqlite.db');

async function teste() {
    try {
        console.log(1);
        var docs = await db.status.find({}).limit(10).execAsync();
        console.log(docs);        
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();