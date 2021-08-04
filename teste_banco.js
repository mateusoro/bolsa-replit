const sqlite = require("aa-sqlite");

  (async () => {
    console.log(await sqlite.open('sqlite.db'))   
    
    var docs = await db.all('select * from status')
    console.log(docs);     
})()