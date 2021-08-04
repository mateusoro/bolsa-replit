const aaSqlite = require("aa-sqlite");

  (async () => {
    console.log(await sqlite.open('./users.db'))
    
    // Adds a table
    
    var r = await sqlite.run('CREATE TABLE users(ID integer NOT NULL PRIMARY KEY, name text, city text)')
    if(r) console.log("Table created")

    var docs = await db.all('select * from status')
    console.log(docs);     
})()