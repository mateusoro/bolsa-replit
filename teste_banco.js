var sqlite3 = require('sqlite3').verbose();


var db = {}
db = new sqlite3.Database('sqlite.db');

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
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();