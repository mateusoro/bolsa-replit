var LinvoDB = require("linvodb3");
var Promise = require("bluebird");

var db = {}
db.status = new LinvoDB('status', {});
db.requisicao =  new LinvoDB('requisicao', {});
db.retorno =  new LinvoDB('retorno', {});
db.grafico =  new LinvoDB('grafico', {});
db.predefinido2 =  new LinvoDB('predefinido', {});
db.parar =  new LinvoDB('parar', {});

Promise.promisifyAll(db.status.find().__proto__);
Promise.promisifyAll(db.requisicao.find().__proto__);
Promise.promisifyAll(db.retorno.find().__proto__);
Promise.promisifyAll(db.grafico.find().__proto__);
Promise.promisifyAll(db.predefinido2.find().__proto__);
Promise.promisifyAll(db.parar.find().__proto__);

async function teste() {
    try {
        console.log(1);
        var docs = await db.status.find({}).limit(10).execAsync();
        console.log(docs);
        var docs2 = await db.status.save({t:'1'}).execAsync();
        console.log(docs);
        console.log(2);
    } catch (err) {
       console.log(err);
    }
}
teste();