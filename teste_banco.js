var sqlite3 = require('sqlite');
var db = new sqlite3({
    filename: 'sqlite.db',
    driver: sqlite3.Database
  })

async function teste() {
    try {
        console.log(1);
        // var docs = await db.run('insert into status values(null, "teste")')
        var docs = await db.all('select * from status')
        console.log(docs);        
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();