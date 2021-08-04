var tulind = require('tulind');
const { load } = require('csv-load-sync');
var Datastore = require('nedb-promise');
var moment = require('moment');
const sqlite = require("aa-sqlite");
(async () => {
    console.log(await sqlite.open('sqlite.db'))
    await sqlite.run('delete from status')
    await sqlite.run('insert into status values (null, "Início", "S")')
    
    await sqlite.run('delete from parar')
    await sqlite.run('insert into parar values (null, "N", "S")')
    //var docs = await sqlite.all('select * from status')
    //console.log(docs);
  
  })()

var db = {};
db.requisicao = new Datastore({ filename: 'requisicoes/requisicao2.json', autoload: true });
db.retorno = new Datastore({ filename: 'requisicoes/retorno2.json', autoload: true });
db.grafico = new Datastore({ filename: 'requisicoes/grafico2.json', autoload: true });
db.predefinido = new Datastore({ filename: 'requisicoes/predefinodo2.json', autoload: true });
db.status = new Datastore({ filename: 'requisicoes/status2.json', autoload: true });
db.parar = new Datastore({ filename: 'requisicoes/parar2.json', autoload: true });
var shell = require('shelljs');

//shell.exec('rclone sync /home/coder/busca/servico_cruzamento.js  rclone:/busca/ -vv');

setInterval(async () => {
    try {

        var docs = await sqlite.all('select * from requisicao');

        for (var x in docs) {
            //console.log(docs[x]);   
            await sqlite.run('delete from requisicao where id='+docs[x].id);         
            await db.requisicao.remove({ _id: docs[x]._id });
            await iniciar_cruzamente(JSON.parse(docs[x].campo));

        }
		//console.log('Rodando Servico');
        if (docs.length > 0) console.log('Carregou requisições: ' + docs.length);

    } catch (e) {
        console.log(e);
    }
}, 1000);


function carregar_acao(acao_nome) {
    var open = [];
    var high = [];
    var low = [];
    var close = [];
    var volume = [];
    var data = [];

    const csv = load("acoes/"+acao_nome);
    //console.log(csv);
    //console.log(row);
    for (var a in csv) {
        var row = csv[a]
        if (row.Close > 0) {
            open.push(row.Open)
            high.push(row.High)
            low.push(row.Low)
            close.push(Math.round(row.Close * 100) / 100)
            volume.push(row.Volume)
            data.push(row.Date)
        }
    }

    var acao = {
        "nome": acao_nome,
        "open": open,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
        "data": data,
        "open_original": open,
        "high_original": high,
        "low_original": low,
        "close_original": close,
        "volume_original": volume,
        "data_original": data,
        "cortar": function (inicio, tamanho) {

            this.open = this.open_original.slice(inicio, inicio + tamanho)
            this.high = this.high_original.slice(inicio, inicio + tamanho)
            this.low = this.low_original.slice(inicio, inicio + tamanho)
            this.close = this.close_original.slice(inicio, inicio + tamanho)
            this.volume = this.volume_original.slice(inicio, inicio + tamanho)
            this.data = this.data_original.slice(inicio, inicio + tamanho)


        }

    }
    return acao;

}

async function sma(acao, tamanho) {
    var result = await tulind.indicators.sma.indicator([acao.close], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function ema(acao, tamanho) {
    var result = await tulind.indicators.ema.indicator([acao.close], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function rsi(acao, tamanho) {
    var result = await tulind.indicators.rsi.indicator([acao.close], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function stochrsi(acao, tamanho) {
    var result = await tulind.indicators.stochrsi.indicator([acao.close], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function adx(acao, tamanho) {
    var result = await tulind.indicators.adx.indicator([acao.high, acao.low, acao.close], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function aroonosc(acao, tamanho) {
    var result = await tulind.indicators.aroonosc.indicator([acao.high, acao.low], [tamanho]);
    var t = acao.close.length;
    result = corrige_tamanho(t, result[0]);
    return result;
}
async function escolher_estrategia_tipo(acao, estra, index, v1, v2, longa_maior_anterior) {

    v1 = v1 * 1;
    v2 = v2 * 1;

    //console.log(estra[index].tipo, index, v1, v2, longa_maior_anterior);
    if (!estra[index + 1]) {
        estra[index + 1] = { vs1: [false], vs2: [false] }
    }
    if (estra[index].tipo == 'Crosser')
        if (v1 + 3 >= v2) {
            //console.log('Menor', index, v1, v2, longa_maior_anterior);
            return false;

        }

    if (!longa_maior_anterior) {
        //console.log('Anterior Falso', v1, v2, longa_maior_anterior);
        return false;
    }
    if (estra[index]) {
        estra[index].v1 = v1;
        estra[index].v2 = v2;
        estra[index].operador = escolher_operador(estra[index].indicador);
        if (estra[index].tipo == 'Compra' || estra[index].tipo == 'Venda') {

            //console.log(estra[index].operador, estra[index].indicador)
            estra[index].indicador_valores = await escolher_indicador(acao, estra[index].indicador, v1);
            
            var sin = sinal(estra[index].indicador_valores, v2, null, estra[index].operador);
            estra[index].sinal = sin[0];
            estra[index].tendencia = sin[1];

        }
        if (estra[index].tipo == 'Crosser') {

            estra[index].indicador_valores_compra = await escolher_indicador(acao, estra[index].indicador_compra, v1);
            estra[index].indicador_valores_venda = await escolher_indicador(acao, estra[index].indicador_venda, v2);
            estra[index].sinal = sinal(estra[index].indicador_valores_compra, 0, estra[index].indicador_valores_venda, estra[index].operador)[0];

        }

    }

    return longa_maior_anterior;

}
async function escolher_indicador(acao, indicador, v) {

    var resultado = [];

    if (indicador == 'sma') {
        resultado = await sma(acao, v);
    }
    if (indicador == 'ema') {
        resultado = await ema(acao, v);
    }
    if (indicador == 'adx') {
        resultado = await adx(acao, v);
    }
    if (indicador == 'aroonosc') {
        resultado = await aroonosc(acao, v);
    }
    if (indicador == 'rsi') {
        resultado = await rsi(acao, v);
    }
    if (indicador == 'stochrsi') {
        resultado = await stochrsi(acao, v);
    }
    return resultado;

}
function escolher_operador(indicador) {


    if (indicador == 'rsi') {
        return 'invertido';
    }
    if (indicador == 'stochrsi') {
        return 'normal';
    }
    return 'normal';

}

function sinal(lista_curta, parametro_fixo, lista_longa, operador) {


    var lista_retorno = [];
    var lista_tendencia = [];
    for (var a in lista_curta) {
        var novo_parametro = parametro_fixo;
        if (lista_longa) {
            novo_parametro = lista_longa[a];
        }
       
        if(lista_curta[a-1]){
            if (lista_curta[a] > lista_curta[a-1]) { lista_tendencia.push("Cima") }
            if (lista_curta[a] < lista_curta[a-1]) { lista_tendencia.push("Baixo") }
            if (lista_curta[a] == lista_curta[a-1]) { lista_tendencia.push("Lateralizado") }
        }else{
            lista_tendencia.push("Lateralizado");
        }
        if (operador == 'normal') {
            if (lista_curta[a] > novo_parametro) { lista_retorno.push("Comprar") }
            if (lista_curta[a] < novo_parametro) { lista_retorno.push("Vender") }
            if (lista_curta[a] == novo_parametro) { lista_retorno.push("Lateralizado") }
        }
        if (operador == 'invertido') {
            if (lista_curta[a] < novo_parametro) { lista_retorno.push("Comprar") }
            if (lista_curta[a] > novo_parametro) { lista_retorno.push("Vender") }
            if (lista_curta[a] == novo_parametro) { lista_retorno.push("Lateralizado") }
        }

    }
    return [lista_retorno, lista_tendencia];


}
function corrige_tamanho(tamanho, curta) {

    var temp = [];
    var temp_curta = curta;
    var p_temp = temp_curta[0];
    var t_curta = temp_curta.length;

    for (var a = 0; a < (tamanho - t_curta); a++) {
        temp.push(p_temp);
    }
    temp_curta = temp.concat(temp_curta);
    return temp_curta;

}
function crosser(acao, estrategias, stop, tipo) {


    var operacoes = [];
    var total = 0;
    var dias_comprados = 0;
    var preco_compra = 0;
    var posicao_compra = 0;
    var quant_stops = 0;
    var quant_perdas = 0;
    var quant_vitorias = 0;

    var maior_indicador = 0;
    for (var e in estrategias) {
        var est = estrategias[e];
        if (est.v1 > maior_indicador) {
            maior_indicador = est.v1;
        }
        if (est.v2 > maior_indicador) {
            maior_indicador = est.v2;
        }


    }

    //console.log('tipo', tipo, maior_indicador);

    var sinal_compra = '';
    var sinal_venda = '';

    for (var a in acao.close) {

        //começa depois das medias
        if (a > maior_indicador) {


            if (tipo == 'e') { // todos sinais precisam ser comprar
                sinal_compra = 'Comprar';
                sinal_venda = 'Vender';

                for (var e in estrategias) {
                    var est = estrategias[e];
                    if (est.tipo == 'Compra') {
                        if (est.sinal[a] != 'Comprar') {
                            sinal_compra = '';
                        };
                    }
                    if (est.indicador == 'stochrsi') {
                        if (est.tendencia[a] != 'Cima') {
                            sinal_compra = '';
                        }
                    }
                    if (est.tipo == 'Venda') {
                        if (est.sinal[a] != 'Vender') {
                            sinal_venda = '';
                        };
                    }
                    
                    if (est.indicador == 'stochrsi') {
                        if (est.tendencia[a] != 'Baixo') {
                            sinal_venda = '';
                        }
                    }
                    if (est.tipo == 'Crosser') {
                        if (est.sinal[a] != 'Vender') {
                            sinal_venda = '';
                        };
                        if (est.sinal[a] != 'Comprar') {
                            sinal_compra = '';
                        };
                    }
                }
            }
            if (tipo == 'ou') { // apenas um sinal precisa ser comprar

                sinal_compra = 'Comprar';
                sinal_venda = 'Vender';
                var sinal_ou_compra = '';
                var quant_compra = 0;
                var sinal_ou_venda = '';
                var quant_venda = 0;

                for (var e in estrategias) {
                    var est = estrategias[e];

                    if (est.tipo == 'Crosser') {
                        if (est.sinal[a] != 'Vender') {
                            sinal_venda = '';
                        };
                        if (est.sinal[a] != 'Comprar') {
                            sinal_compra = '';
                        };
                    }
                }

                for (var e in estrategias) {
                    var est = estrategias[e];
                    if (est.tipo == 'Compra') {
                        quant_compra++;
                        if (est.sinal[a] == 'Comprar') {
                            sinal_ou_compra = 'Comprar';
                        };
                    }

                    if (est.tipo == 'Venda') {
                        quant_venda++;
                        if (est.sinal[a] == 'Vender') {
                            sinal_ou_venda = 'Vender';
                        };
                    }
                }
                if (sinal_compra == 'Comprar')//se crosser vier comprado
                    if (quant_compra > 0) //se tiver estrategia de compra
                        if (sinal_ou_compra != 'Comprar') {// se a estrategia de compra não tiver nenhum sinal de compra
                            sinal_compra = '';
                        }
                if (sinal_venda == 'Vender')//se crosser vier comprado
                    if (quant_venda > 0) //se tiver estrategia de compra
                        if (sinal_ou_venda != 'Vender') {// se a estrategia de compra não tiver nenhum sinal de compra
                            sinal_venda = '';
                        }
            }


            //Compra
            if (sinal_compra == "Comprar" && preco_compra == 0) {
                preco_compra = acao.close[a];
                posicao_compra = a;
                //console.log("Comprou", sinal_compra)
            }


            var ultrapassou_stop = false;
            var resultado = 0;
            //Calcula se ultrapassou limite do stop
            if (preco_compra > 0) {

                resultado = (acao.close[a] - preco_compra) / preco_compra * 100;
                resultado = resultado * 1;
                if (resultado < stop) {
                    ultrapassou_stop = true;
                    quant_stops++;
                    resultado = stop * 1;
                }

            }

            resultado = resultado * 1;
            //Venda
            if (ultrapassou_stop || (sinal_venda == "Vender" && preco_compra > 0)) {

                if (resultado < 0) {
                    quant_perdas++;
                }
                if (resultado > 0) {
                    quant_vitorias++;
                }

                total += resultado;

                var date1 = new Date(acao.data[posicao_compra]);
                var date2 = new Date(acao.data[a]);
                var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24));
                dias_comprados += diffDays;

                var operacao = {
                    "Nome": acao.nome,
                    "Compra": preco_compra,
                    "Venda": acao.close[a],
                    "d_compra": acao.data[posicao_compra],
                    "d_venda": acao.data[a],
                    "p_compra": posicao_compra,
                    "p_venda": a,
                    "dias": diffDays,
                    "stop": stop,
                    "ultrapassou_stop": ultrapassou_stop,
                    "d_inicial": acao.data[0],
                    "d_final": acao.data[acao.data.length - 1],
                    "Resultado": resultado,
                    "ResultadoDia": resultado / diffDays
                }
                //console.log("Vendido: ", operacao);

                operacoes.push(operacao);
                preco_compra = 0;
            }
        }

    }
    if (preco_compra > 0) {

        var operacao = {
            "Nome": acao.nome,
            "Compra": preco_compra,
            "d_compra": acao.data[posicao_compra],
            "p_compra": posicao_compra,
            "d_inicial": acao.data[0],
            "d_final": acao.data[acao.data.length - 1]
        }
        operacoes.push(operacao);

    }

    const estrategia = {
        "Acao": acao,
        "estrategias": estrategias,
        "Operacoes": operacoes,
        "Resultado": total,
        "quant_stops": quant_stops,
        "quant_perdas": quant_perdas,
        "quant_vitorias": quant_vitorias,
        "stop": stop,
        "Dias": dias_comprados,
        "ResultadoDia": total / dias_comprados
    }
    return estrategia;

}

//var nome_acao = ["VALE3.SA", "VALE3"];   


async function iniciar_cruzamente(msg) {

    var acoes = msg.acao.split(',');
    resultado = [];
    contagem = 0;
    for (var a in acoes) {
        var nome_acao = [acoes[a], acoes[a].replace('.', '_')];
        if (a == acoes.length - 1) {
            nome_acao = [acoes[a], acoes[a].replace('.', '_'), 'Sim'];
        }
        var solicitacao = JSON.parse(JSON.stringify(msg));
        console.log(nome_acao);
        await iniciar(nome_acao, solicitacao);

    }
    await sqlite.run('update status set campo = "Fim"');
    //await db.status.update({}, { status: 'Fim' }, { upsert: true });
    console.log('Fim');

    //emitir(resultado);

}



var id = 0;
async function iniciar(nome_acao, solicitacao) {

    stop = solicitacao.stop;
    quant_stop = solicitacao.quant_stop;
    quant_operacoes = solicitacao.quant_operacoes;
    quant_acertos = solicitacao.quant_acertos;
    quant_perdas = solicitacao.quant_perdas;
    estrategias = solicitacao.estrategias;


    solicitacao.acao = nome_acao[0];
    var petr4 = carregar_acao(nome_acao[1]);
    petr4.cortar(petr4.close_original.length - 600, 600);

    var stops = stop.split(',');
    var possibilidades = stops.length;

    for (var e in estrategias) {

        var est = estrategias[e];
        if (est.tipo == 'Compra' || est.tipo == 'Venda') {
            est.vs1 = est.teste.split(',');
            est.vs2 = est.parametro.split(',');
        }
        if (est.tipo == 'Crosser') {
            console.log(est.teste_compra, est.teste_venda);
            est.vs1 = est.teste_compra.split(',');
            est.vs2 = est.teste_venda.split(',');
        }
        possibilidades = possibilidades * est.vs1.length * est.vs2.length;
    }

    var variavel_stop = stops;

    var maior = -100;
    var melhor;

    var tempo1 = new Date();

    for (var vv1_1 of estrategias[0].vs1) {

        process.stdout.write(contagem + ' ');
        await sqlite.run('update status set campo = "Calculando ' + nome_acao[0] + ': ' + contagem + '/' + possibilidades +'"');
        //await db.status.update({}, { status: 'Calculando ' + nome_acao[0] + ': ' + contagem + "/" + possibilidades }, { upsert: true });


        
        var docs = await sqlite.all('select * from parar');
        var parar = false;
        if(docs){
            if(docs[0].campo=="S"){
                parar = true;
            }
        }
        
        if (!parar) {
            for (var vv1_2 of estrategias[0].vs2) {

                var longa_maior = await escolher_estrategia_tipo(petr4, estrategias, 0, vv1_1, vv1_2, true);

                for (var vv2_1 of estrategias[1].vs1) {


                    var tempo2 = new Date();                    
                    var timeDifference = tempo2.getTime() - tempo1.getTime();    
                    
                    var restantes = possibilidades - contagem;
                    restantes = restantes * timeDifference / contagem;
                    //console.log(timeDifference, new Date(restantes).getMinutes());
                    var dd = new Date(restantes);
                    await sqlite.run('update status set campo = "Calculando ' + nome_acao[0] + ': ' + contagem + '/' + possibilidades + ". Tempo restante: " + dd.getMinutes() + ":" +dd.getSeconds() +'"');
        
                    //await db.status.update({}, { status: 'Calculando ' + nome_acao[0] + ': ' + contagem + "/" + possibilidades + ". Tempo restante: " + dd.getMinutes() + ":" +dd.getSeconds() }, { upsert: true });

                    for (var vv2_2 of estrategias[1].vs2) {

                        var longa_maior2 = await escolher_estrategia_tipo(petr4, estrategias, 1, vv2_1, vv2_2, longa_maior);

                        for (var vv3_1 of estrategias[2].vs1) {

                            for (var vv3_2 of estrategias[2].vs2) {

                                var longa_maior3 = await escolher_estrategia_tipo(petr4, estrategias, 2, vv3_1, vv3_2, longa_maior2);

                                for (var vv4_1 of estrategias[3].vs1) {

                                    for (var vv4_2 of estrategias[3].vs2) {

                                        var longa_maior4 = await escolher_estrategia_tipo(petr4, estrategias, 3, vv4_1, vv4_2, longa_maior3);

                                        for (var vv5_1 of estrategias[4].vs1) {

                                            for (var vv5_2 of estrategias[4].vs2) {

                                                var longa_maior5 = await escolher_estrategia_tipo(petr4, estrategias, 4, vv5_1, vv5_2, longa_maior4);


                                                for (var vv_stop of variavel_stop) {

                                                    var sto = vv_stop * 1;

                                                    if (longa_maior5) {

                                                        const estrategia = crosser(petr4, estrategias, sto, solicitacao.tipo_cruzamento);
                                                        //console.log((estrategia.Resultado) / (estrategia.Dias) > maior, estrategia.Dias > 5, estrategia.Operacoes.length > quant_operacoes, estrategia.quant_stops < quant_stop, estrategia.quant_perdas < quant_perdas, estrategia.quant_vitorias > quant_acertos, estrategia.quant_perdas, quant_perdas, estrategia.quant_vitorias, quant_acertos);

                                                        if ((estrategia.Resultado) / (estrategia.Dias) > maior && estrategia.Dias > 5 && estrategia.Operacoes.length > quant_operacoes && estrategia.quant_stops < quant_stop && estrategia.quant_perdas < quant_perdas && estrategia.quant_vitorias > quant_acertos) {

                                                            maior = (estrategia.Resultado) / (estrategia.Dias);
                                                            estrategia.id = id;
                                                            melhor = JSON.parse(JSON.stringify(estrategia));

                                                        }
                                                        contagem++;
                                                        id++;
                                                    }

                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            console.log('Parando');
        }

    }

    if (melhor) {
        console.log(melhor.Resultado);
        var m = JSON.parse(JSON.stringify(melhor));
        grafico(m, m.id, solicitacao);
    }
    console.log("Pronto: " + id);

    //emitir('fim', "Fim: Testado " + id + " possibilidades");

}

function arre(valor) {
    return Math.round(valor * 100) / 100;
}
function arre_lista(lista) {
    for (var x in lista) {

        lista[x] = arre(lista[x]);

    }

}

async function grafico(estra, id, solicitacao) {


    let estrategia = estra;
    var point_compra = {};
    var point_segundo = {};


    var index = 1;

    var dataset_crosser = [];
    var dataset_compra_venda = [];

    dataset_crosser.push({
        label: 'Ação: ' + estrategia.Acao.nome,
        borderColor: 'rgb(255, 99, 132)',
        data: estrategia.Acao.close,
        fill: false,
        pointRadius: 2,
    });

    for (var e in estrategia.estrategias) {
        var est = estrategia.estrategias[e];

        if (est.tipo == 'Crosser') {
            arre_lista(est.indicador_valores_compra);
            arre_lista(est.indicador_valores_venda);
            dataset_crosser.push({

                label: est.indicador_compra.toUpperCase() + '(' + est.v1 + ")",
                fill: false,
                borderColor: 'rgb(54, 162, 235)',
                data: est.indicador_valores_compra,
                pointRadius: 0,
                borderDash: [4, 2],

            });

            dataset_crosser.push({
                label: est.indicador_venda.toUpperCase() + '(' + est.v2 + ')',
                fill: false,
                borderColor: '#408d91',
                data: est.indicador_valores_venda,
                pointRadius: 0,
                borderDash: [12, 4],
            });
        }
        if (est.tipo == 'Compra') {
            arre_lista(est.indicador_valores);
            dataset_compra_venda.push({
                label: est.indicador.toUpperCase() + ' Compra (' + est.v1 + ', ' + est.v2 + ')',
                fill: false,
                borderColor: 'blue',
                data: est.indicador_valores,
                pointRadius: 0,
                borderWidth: 1
            });

            var d = corrige_tamanho(est.indicador_valores.length, [est.v2]);
            dataset_compra_venda.push({
                label: est.indicador.toUpperCase() + ' P. C. (' + est.v2 + ')',
                fill: false,
                borderColor: 'blue',
                data: d,
                pointRadius: 0,
                borderWidth: 1
            });
            /*
                        point_segundo['l_' + index] = {
                            type: 'line',
                            yMin: est.v2,
                            yMax: est.v2,
                            borderColor: 'blue',
                            borderWidth: 2,
                        }
              */
            index++;

        }
        if (est.tipo == 'Venda') {
            arre_lista(est.indicador_valores);

            dataset_compra_venda.push({
                label: est.indicador.toUpperCase() + ' Venda (' + est.v1 + ', ' + est.v2 + ')',
                fill: false,
                borderColor: 'green',
                data: est.indicador_valores,
                pointRadius: 0,
                borderWidth: 1
            });
            var d = corrige_tamanho(est.indicador_valores.length, [est.v2]);
            dataset_compra_venda.push({
                label: est.indicador.toUpperCase() + ' P. V. (' + est.v2 + ')',
                fill: false,
                borderColor: 'green',
                data: d,
                pointRadius: 0,
                borderWidth: 1
            });
            /*
            point_segundo['l_' + index] = {
                type: 'line',
                yMin: est.v2,
                yMax: est.v2,
                borderColor: 'green',
                borderWidth: 2,
            }*/
            index++;
        }

    }


    var stop = estrategia.stop;

    var resultadoG = "ResT: " + arre(estrategia.Resultado) + "% - ResD: " + arre(estrategia.ResultadoDia) + "% - DiasC: " + estrategia.Dias + " - Op:" + estrategia.Operacoes.length;

    for (var o in estrategia.Operacoes) {

        var op = estrategia.Operacoes[o];
        var stopou = "";
        var color = 'green';
        if (op.ResultadoDia < 0) {
            color = 'red';
        }


        if (op.ultrapassou_stop) {
            stopou = "STOP ";
        }
        point_compra['c_' + o] = {
            type: 'line',
            mode: 'vertical',
            value: op.d_compra,
            scaleID: "x",
            borderColor: 'green',
            borderWidth: 1,
            label: {
                enabled: true,
                xPadding: 3,
                yPadding: 3,
                yAdjust: 25,
                position: "start",
                content: "C:" + op.Compra
            }
        }
        if (op.d_venda) {
            point_compra['v_' + o] = {
                type: 'line',
                mode: 'vertical',
                value: op.d_venda,
                scaleID: "x",
                borderColor: 'red',
                borderWidth: 1,
                label: {
                    enabled: true,
                    xPadding: 3,
                    yPadding: 3,
                    position: "start",
                    backgroundColor: color,
                    content: "V: " + op.Venda + " " + stopou + "R.D: " + Math.round(op.ResultadoDia * 100) / 100 + "%\n R.T: " + Math.round(op.Resultado * 100) / 100 + "%"
                }
            }
        }

    }


    var config = {
        type: 'line',
        data: {
            labels: estrategia.Acao.data,
            datasets: dataset_crosser,
        },
        options: {

            maintainAspectRatio: false,

            interaction: {
                intersect: true
            },

            plugins: {
                title: {
                    display: true,
                    text: 'Resultado: ' + resultadoG + " STOP:" + stop,
                },

                autocolors: false,
                annotation: {
                    annotations: point_compra
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        enabled: true,
                        mode: 'x',
                        drag: false,
                    },
                    limits: {
                        x: {
                            minDelay: 0,
                            maxDelay: 4000,
                            minDuration: 1000,
                            maxDuration: 20000
                        }
                    },

                }
            },

            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: 'day'
                    }
                }
            },

        }
    };

    var config_segundo_grafico = {
        type: 'line',
        data: {
            labels: estrategia.Acao.data,
            datasets: dataset_compra_venda,
        },
        options: {

            maintainAspectRatio: false,

            interaction: {
                intersect: true
            },


            plugins: {
                title: {
                    display: false,
                },
                annotation: {
                    annotations: point_segundo
                },
                autocolors: false,

                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        onPan: function () {
                            console.log("PAN");
                            updateChart(this);
                        }
                    },
                    zoom: {
                        enabled: true,
                        mode: 'x',
                        drag: false,
                    },
                    limits: {
                        x: {
                            minDelay: 0,
                            maxDelay: 4000,
                            minDuration: 1000,
                            maxDuration: 20000
                        }
                    },

                }
            },

            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: 'day'
                    },
                    display: false
                }
            },

        }
    };

    //var resultado = "ResT: " + Math.round(estrategia.Resultado * 100) / 100 + "% - ResD: " + Math.round(estrategia.ResultadoDia * 100) / 100 + "% - DiasC: " + estrategia.Dias + " - Op:" + estrategia.Operacoes.length;
    //  if ((estrategia.Resultado) / (estrategia.Dias) > maior && estrategia.Dias > 5 && estrategia.Operacoes.length > quant_operacoes && estrategia.quant_stops < quant_stop && estrategia.quant_perdas < quant_perdas && estrategia.quant_vitorias > quant_acertos) {

    solicitacao.resultado_total = Math.round(estrategia.Resultado * 100) / 100;
    solicitacao.resultado_dia = Math.round(estrategia.ResultadoDia * 100) / 100;
    solicitacao.dias_comprados = estrategia.Dias;
    solicitacao.quant_operacoes = estrategia.Operacoes.length;
    solicitacao.quant_stops = estrategia.quant_stops
    solicitacao.quant_perdas = estrategia.quant_perdas;
    solicitacao.quant_acertos = estrategia.quant_vitorias;
    solicitacao.stop = stop;
    solicitacao.estrategia_atual = '';

    for (var e in estrategia.estrategias) {
        var est = estrategia.estrategias[e];

        if (est.tipo == 'Crosser') {
            solicitacao.estrategia_atual += " " + est.tipo + ": ";
            solicitacao.estrategia_atual += est.indicador_compra.toUpperCase() + " " + est.v1 + " X " + est.indicador_venda.toUpperCase() + " " + est.v2 + " |"
        }

        if (est.tipo == 'Compra' || est.tipo == 'Venda') {
            solicitacao.estrategia_atual += " " + est.tipo + ": ";
            solicitacao.estrategia_atual += est.indicador.toUpperCase() + " " + est.v1 + " X " + est.v2 + " |"
        }

    }
    solicitacao.estrategia_atual = solicitacao.estrategia_atual.substring(0, solicitacao.estrategia_atual.length - 1);
    solicitacao.estrategias = estrategia.estrategias;
    //console.log(solicitacao.estrategias);   
    let sol_temp = JSON.parse(JSON.stringify(solicitacao));

    //console.log('Resultado: ' + resultadoG + " STOP:" + stop + " Curta:" + estrategia_crosser.v1 + " Longa:" + estrategia_crosser.v2 + " Compra:" + estrategia_compra.v1 + " Venda:" + estrategia_venda.v1);
    await db.retorno.insert({ resultado: sol_temp, grafico: config, segundo_grafico: config_segundo_grafico });
    //emitir('resultado', { descricao: solicitacao, url: link + "/?id=" + id })

}

console.log("Rodando Serviço");



