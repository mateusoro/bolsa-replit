const sqlite = require("aa-sqlite");

  (async () => {
    console.log(await sqlite.open('sqlite.db'))   
    var docs = await sqlite.all('select * from status')
    console.log(docs);     
})()