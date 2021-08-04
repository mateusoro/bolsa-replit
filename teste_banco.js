const sqlite = require("aa-sqlite");
var Datastore = require('nedb-promise');
var db = {};
db.predefinido = new Datastore({ filename: 'requisicoes/predefinodo.json', autoload: true });
(async () => {
  console.log(await sqlite.open('sqlite.db'))
  var docs = await sqlite.all('select * from status')
  console.log(docs);

})()