var express = require('express');
var app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
var io = new Server(server);
var allClients = [];
const fs = require('fs');
const https = require('https');
var process = require('process');
const sqlite = require("aa-sqlite");

(async () => {
  console.log(await sqlite.open('sqlite.db'))
  await sqlite.run('delete from status')
  await sqlite.run('insert into status values (null, "Início", "S")')
  await sqlite.run('delete from parar')
  await sqlite.run('insert into parar values (null, "N", "S")')

})()

var Datastore = require('nedb-promise');
var db = {};
db.requisicao = new Datastore({ filename: 'requisicoes/requisicao.json', autoload: true });
db.retorno = new Datastore({ filename: 'requisicoes/retorno.json', autoload: true });
db.grafico = new Datastore({ filename: 'requisicoes/grafico.json', autoload: true });
db.predefinido = new Datastore({ filename: 'requisicoes/predefinodo.json', autoload: true });
db.status = new Datastore({ filename: 'requisicoes/status.json', autoload: true });
db.parar = new Datastore({ filename: 'requisicoes/parar.json', autoload: true });


const localtunnel = require('localtunnel');
var shell = require('shelljs');
/*
var rrr = shell.exec('pidof node');
if(rrr.stdout.split(' ').length>4){
	shell.exec('kill $(pidof node)');	
	shell.exec('node index.js & node servico_cruzamento.js');	
}*/


setInterval(async () => {
    try {
        db.retorno.loadDatabase();
        var docs = await db.retorno.find({});
        for (var x in docs) {
            //console.log('Emitindo', x)
            emitir([{ destino: 'resultado', mensagem: docs[x] }]);
            await db.grafico.insert(docs[x]);
            await db.retorno.remove({ _id: docs[x]._id })
        }
        if (docs.length > 0) console.log('Carregou retorno: ' + docs.length);

        //db.status.loadDatabase();
        //var docs = await db.status.find({});
        var docs = await sqlite.all('select * from status')
        if (docs) {
            emitir([{ destino: 'status', mensagem: docs[0].campo }]);
        }
    } catch (e) {
        console.log(e);
        await db.retorno.remove({ _id: docs[x]._id })
    }


}, 1000);


io.sockets.on('connection', (socket) => {

    console.log('Conectado');
    allClients.push(socket);

    socket.on('atualizar', (msg) => {

        console.log('atualizar');
        var acoes = msg.split(',');
        for (var a in acoes) {
            var nome_acao = [acoes[a], acoes[a].replace('.', '_')];
            atualizar_acao(nome_acao);
            

            //atualizar_acao(nome_acao);

        }


    })
    socket.on('carregar', async (msg) => {

        console.log('Carregando');
        //iniciar_cruzamente(msg);
        await sqlite.run('update parar set campo = "N"');
        await sqlite.run('insert into requisicao values (null, "'+JSON.stringify(msg)+'", "S")')
        await db.requisicao.insert(msg);

    });
    socket.on('parar', async () => {

        console.log('Parar');
        await sqlite.run('update parar set campo = "S"');

    });
    socket.on('salvar', async (msg) => {

        console.log('Salvando');
        //iniciar_cruzamente(msg);
        await db.predefinido.insert(msg);

    });
    socket.on('carregar_predefinidos', async (msg) => {

        // console.log('carregar_predefinidos');
        //iniciar_cruzamente(msg);
        var docs = await db.predefinido.find({});

        for (var x in docs) {
            io.emit('predefinidos', docs[x]);
        }
        if (docs.length > 0) console.log('Carregou predefinidos: ' + docs.length);


    });
    socket.on('remover_predefinidos', async (msg) => {

        console.log('remover_predefinidos');
        //iniciar_cruzamente(msg);
        await db.predefinido.remove({ _id: msg });

    });
    socket.on('rodar_predefinidos', async (msg) => {

        console.log('rodar_predefinidos');
        await sqlite.run('update parar set campo = "N"');
        db.predefinido.loadDatabase();
        var docs = await db.predefinido.find({ _id: msg });

        for (var x in docs) {
            //console.log({ grafico: docs[x].grafico, segundo_grafico: docs[x].segundo_grafico })
            db.requisicao.insert(docs[x].requisicao);
        }
        if (docs.length > 0) console.log('Rodando Predefinido: ' + docs.length);


    });
    socket.on('carregar_grafico', async (id) => {
        db.grafico.loadDatabase();
        // console.log(id);
        var docs = await db.grafico.find({ _id: id });
        //BVlaheOj38klNMAa
        for (var x in docs) {
            //console.log({ grafico: docs[x].grafico, segundo_grafico: docs[x].segundo_grafico })
            io.emit('grafico', { grafico: docs[x].grafico, segundo_grafico: docs[x].segundo_grafico });
        }
        if (docs.length > 0) console.log('Carregou graficos: ' + docs.length);


    });

    socket.on('disconnect', function () {
        console.log('Disconnect!');

        var i = allClients.indexOf(socket);
        allClients.splice(i, 1);
    });


});
var pacote_envio = []
function emitir(resultado) {

    //console.log(resultado.length, allClients.length)

    setTimeout(() => {
        if (allClients.length > 0) {
            for (var r in resultado) {
                var res = resultado[r];
                var destino = res.destino;
                var mensagem = res.mensagem;
                io.emit(destino, mensagem);
            }
        } else {
            //console.log('Esperando', resultado);

            if (resultado[0].destino == 'status' && resultado[0].mensagem == 'Fim') {

            } else {
                setTimeout(() => {
                    console.log(resultado);
                    emitir(resultado);
                }, 1000);
            }

        }
    }, 1000);

}
app.get('/grafico', function (req, res) {
    //res.sendFile('/home/runner/bolsa-replit/paginas/grafico.html');
    res.sendFile('/home/mateusoro/bolsa-replit/paginas/grafico.html');
});
app.get('/tabela', function (req, res) {
    //res.sendFile('/home/runner/bolsa-replit/paginas/tabela.html');
    res.sendFile('/home/mateusoro/bolsa-replit/paginas/tabela.html');
});
app.get('/predefinidos', function (req, res) {
    //res.sendFile( '/home/runner/bolsa-replit/paginas/predefinidos.html');
    res.sendFile( '/home/mateusoro/bolsa-replit/paginas/predefinidos.html');
});
app.get('/', function (req, res) {
    //res.sendFile('/home/runner/bolsa-replit/paginas/index.html');
    res.sendFile('/home/mateusoro/bolsa-replit/paginas/index.html');
});

server.listen(8888, () => {
    console.log('8888');
});


var seq = 1;
var link = "";
function tunel() {
    //var tunnel = await localtunnel({ port: 8888, subdomain: "grafico-mateusoro" + seq });

    const tunnel = localtunnel(8888, { subdomain: "bolsa-mateusoro" + seq }, (err, tunnel) => {

        if (err) {
            console.log(err);
        } else {
            if (tunnel.url != "https://bolsa-mateusoro" + seq + ".loca.lt") {
                console.log("Diferente", tunnel.url);
                seq++;
                tunnel.close();
                tunel(seq);
            } else {
                console.log("Abriu", tunnel.url);
                console.log('Tunel Criado');
                link = tunnel.url + "/grafico";

            }
        }

    });
    tunnel.on('close', () => {
        console.log("Fechou", tunnel.url);
    });
    tunnel.on('error', (err) => {
        console.log("Erro", tunnel.url, err);
    });

}


async function atualizar_acao(nome_acao) {
    try {
		if(nome_acao[1].indexOf('acoes')==-1){
        	nome_acao[1] = "acoes/"+nome_acao[1]
		}
        if (fs.existsSync(nome_acao[1])) {
            const stats = fs.statSync(nome_acao[1]);
            if (stats.mtime.getDay() != new Date().getDay()) {
                console.log("Atualizado " + nome_acao[0])
                download(nome_acao);
            } else {
                console.log("Ação já atualizada "+ nome_acao[0]);
                await sqlite.run('update status set campo = "Ações atualizadas"');
                //await db.status.update({}, { status: 'Ações atualizadas' }, { upsert: true });

            }
        } else {
            console.log("Arquivo não existe " + nome_acao[0])
            download(nome_acao);
        }
    } catch (e) {
        console.log(e);
    }
}

async function download(acao) {

    var hoje = Math.round(new Date().getTime() / 1000);
    var anterior = Math.round(new Date('2005-01-01').getTime() / 1000);
    var link = "https://query1.finance.yahoo.com/v7/finance/download/" + acao[0] + "?period1=0&period2=" + hoje + "&interval=1d&events=history&includeAdjustedClose=true"

    console.log('Baixando');

    var file = fs.createWriteStream(acao[1]);
    var request = https.get(link, function (response) {
        response.pipe(file);
        file.on('finish', async function () {
            file.close();
            console.log('Ação Atualizada');
            await sqlite.run('update status set campo = "Ações atualizadas"');
            //await db.status.update({}, { status: 'Ações atualizadas' }, { upsert: true });

        });
    }).on('error', function (err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        console.log(err.message);
    });

}
//tunel();





