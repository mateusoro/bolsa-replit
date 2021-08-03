var LinvoDB = require("linvodb3");
var Promise = require("bluebird");
var sqlite3 = require('sqlite3').verbose();


var db = {}
db.status = new sqlite3.Database('requisicoes/requisicao.db');

db.requisicao =  new LinvoDB('requisicao', {});
db.retorno =  new LinvoDB('retorno', {});
db.grafico =  new LinvoDB('grafico', {});
db.predefinido2 =  new LinvoDB('predefinido', {});
db.parar =  new LinvoDB('parar', {});


async function teste() {
    try {
        console.log(1);
        var docs = await db.status.find({}).limit(10).execAsync();
        console.log(docs);
        var docs2 = await db.status.save({t:'1'}).execAsync();
        console.log(docs2);
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();