var LinvoDB = require("linvodb3");
var Promise = require("bluebird");

var db = {}
db.status = new LinvoDB('status', {},{filename = "requisicoes/status.json"});

Promise.promisifyAll(db.status.find().__proto__);

try {
    console.log(1);
	var docs = await db.status.find({ system: 'solar' }).limit(10).execAsync();
	// use docs somehow
} catch (err) {
	// handle errors
}