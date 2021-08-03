var LinvoDB = require("linvodb3");
var Promise = require("bluebird");
var sqlite3 = require('sqlite3').verbose();
var db.status = new sqlite3.Database(':memory:');

db.status = new LinvoDB('status', {});
db.requisicao =  new LinvoDB('requisicao', {});
db.retorno =  new LinvoDB('retorno', {});
db.grafico =  new LinvoDB('grafico', {});
db.predefinido2 =  new LinvoDB('predefinido', {});
db.parar =  new LinvoDB('parar', {});

