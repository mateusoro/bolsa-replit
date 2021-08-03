var LinvoDB = require("linvodb3");
var Promise = require("bluebird");

var db = {}
db.requisicao = new Datastore({ filename: 'requisicoes/requisicao.json', autoload: true });
db.retorno = new Datastore({ filename: 'requisicoes/retorno.json', autoload: true });
db.grafico = new Datastore({ filename: 'requisicoes/grafico.json', autoload: true });
db.predefinido = new Datastore({ filename: 'requisicoes/predefinodo.json', autoload: true });
db.status = new Datastore({ filename: 'requisicoes/status.json', autoload: true });
db.parar = new Datastore({ filename: 'requisicoes/parar.json', autoload: true });

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