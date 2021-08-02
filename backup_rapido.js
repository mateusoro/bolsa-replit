const CronJob = require('cron').CronJob;
var shell = require('shelljs');

//shell.exec('bash push.sh');
const job2 = new CronJob('*/10 * * * * *', function() {
	const d = new Date();
	console.log(d);
    shell.exec('rclone sync /home/coder/busca/bolsa.js  rclone:/busca/ -vv');
});
job2.start();
