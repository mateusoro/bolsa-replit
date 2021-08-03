var LinvoDB = require("linvodb3");
var Promise = require("bluebird");

var db = {}
db.status = new LinvoDB('status', {});
db.requisicao =  new LinvoDB('status', {});
db.retorno =  new LinvoDB('status', {});
db.grafico =  new LinvoDB('status', {});
db.predefinido =  new LinvoDB('status', {});
db.status =  new LinvoDB('status', {});
db.parar =  new LinvoDB('status', {});

Promise.promisifyAll(db.status.find().__proto__);

async function teste() {
    try {
        console.log(1);
        var docs = await db.status.find({}).limit(10).execAsync();
        console.log(docs);
        console.log(2);
    } catch (err) {
        // handle errors
    }
}
teste();