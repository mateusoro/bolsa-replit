var LinvoDB = require("linvodb3");
var Promise = require("bluebird");

var db = {}
db.status = new LinvoDB('status', {},{filename:"requisicoes/status.json"});

Promise.promisifyAll(db.status.find().__proto__);

try {
    console.log(1);
	var docs = await db.status.find({ }).limit(10).execAsync();
    console.log(docs);
	console.log(2);
} catch (err) {
	// handle errors
}