const CronJob = require('cron').CronJob;
var shell = require('shelljs');
console.log('inciando')
//shell.exec('bash push.sh');
const job = new CronJob('0 */5 * * * *', function() {
	const d = new Date();
	console.log(d);
    shell.exec('bash push.sh');
});
job.start();


