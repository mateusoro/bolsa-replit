const sqlite = require("aa-sqlite");
var Datastore = require('nedb-promise');
var db = {};
db.predefinido = new Datastore({ filename: 'requisicoes/predefinodo.json', autoload: true });
(async () => {
  console.log(await sqlite.open('sqlite.db'))
  var docs = await sqlite.all('select * from status')
  console.log(docs);
  var docs = await db.predefinido.find({});

  for (var x in docs) {
    await sqlite.run("insert into requisicao values (null, '"+JSON.stringify(docs[x])+"', 'S')")
    io.emit('predefinidos', docs[x]);
  }


})()