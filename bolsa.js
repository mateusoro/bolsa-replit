const fs = require('fs');
var tulind = require('tulind');
const { load } = require('csv-load-sync');
const get = require("async-get-file");
var express = require('express');
var app = express();
const path = require('path');
const localtunnel = require('localtunnel');



function carregar_acao(acao_nome) {
    var open = [];
    var high = [];
    var low = [];
    var close = [];
    var volume = [];
    var data = [];

    const csv = load(acao_nome);

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
    return result;
}
async function ema(acao, tamanho) {
    var result = await tulind.indicators.ema.indicator([acao.close], [tamanho]);
    return result;
}
async function adx(acao, tamanho) {
    var result = await tulind.indicators.adx.indicator([acao.high, acao.low, acao.close], [tamanho]);
    return result;
}
async function aroonosc(acao, tamanho) {
    var result = await tulind.indicators.aroonosc.indicator([acao.high, acao.low], [tamanho]);
    return result;
}

function sinal(acao, lista, parametro) {

    var tamanho = acao.close.length;
    var t = lista.length;
    var temp = [];
    var p_temp = lista[0];
    for (var a = 0; a < (tamanho - t); a++) {
        temp.push(p_temp);
    }
    lista = temp.concat(lista);

    var lista_retorno = [];
    for (var a in lista) {

        if (lista[a] > parametro) { lista_retorno.push("Comprar") }
        if (lista[a] < parametro) { lista_retorno.push("Vender") }
        if (lista[a] == parametro) { lista_retorno.push("Lateralizado") }

    }
    return lista_retorno;


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
function crosser(acao, medias, sinais, stop, quadrante) {

    /*
    var sinais = {

        'sinais_compra': sinais_compra,
        'sinais_venda': sinais_venda,
        'indicador_compra': indicador_compra,
        'indicador_venda': indicador_venda,
        'tamanho_indicador_compra': tamanho_indicador_compra,
        'tamanho_indicador_venda': tamanho_indicador_venda,
        'descricao_ind_compra': 'aroonosc',
        'descricao_ind_venda': 'aroonosc',

    }

    var medias = {
        'curta': curta[0],
        'longa': longa[0],
        'tamanho_curta': t_c,
        'tamanho_longa': t_l

    } */


    if (!medias.tamanho_longa){
        
        console.log(medias.tamanho_longa);
        console.log(sinais.tamanho_indicador_compra);
        
    }


    var d1 = new Date(acao.data[0]);
    var d2 = new Date(acao.data[acao.data.length - 1]);
    var diff = parseInt((d2 - d1) / (1000 * 60 * 60 * 24));

    //console.log(acao.data.length, diff,d1,d2);

    var posicao = [];
    var tamanho = acao.close.length;


    var curta = corrige_tamanho(tamanho, medias.curta);
    var longa = corrige_tamanho(tamanho, medias.longa);
    sinais.indicador_compra = corrige_tamanho(tamanho, sinais.indicador_compra);


    var chart_serie_curta = "";
    var chart_serie_longa = "";
    var chart_serie_acao = "";

    for (var n in medias.curta) {

        var c = medias.curta[n];
        var l = medias.longa[n];
        var ac = acao.close[n];


        chart_serie_curta += Math.round(c * 100) / 100 + ","
        chart_serie_longa += Math.round(l * 100) / 100 + ","
        chart_serie_acao += Math.round(ac * 100) / 100 + ","

        var r = "Acima";

        if (c < l) {
            r = "Abaixo"
        }
        if (medias.curta[n - 1])
            if (medias.longa[n - 1]) {
                c = medias.curta[n - 1];
                l = medias.longa[n - 1];
                if (c < l) {
                    if (r == "Acima") { r = "Cruzou Acima" }
                }
                if (c > l) {
                    if (r == "Abaixo") { r = "Cruzou Abaixo" }
                }
            }

        posicao.push(r);
    }

    var operacoes = [];
    var total = 0;
    var dias_comprados = 0;
    var preco_compra = 0;
    var posicao_compra = 0;
    var autoriza_compra = false;
    var quant_stops = 0;

    for (var a in acao.close) {

        var p = posicao[a];

        var sinal_compra = "Comprar";
        var sinal_venda = "Vender";

        if (sinais.sinais_compra) {
            sinal_compra = sinais.sinais_compra[a];
        }
        if (sinais.sinais_venda) {
            sinal_venda = sinais.sinais_venda[a];
        }

       // console.log(autoriza_compra, p, a, medias.tamanho_curta, medias.tamanho_longa)
        if (!autoriza_compra && (p == "Abaixo" || p == "Cruzou Abaixo") && a > medias.tamanho_curta && a > medias.tamanho_longa) {
            autoriza_compra = true;
        }

        //console.log(p, autoriza_compra , preco_compra, sinal_compra );
        if ((p == "Acima" || p == "Cruzou Acima") && autoriza_compra && preco_compra == 0 && sinal_compra == "Comprar") {
            preco_compra = acao.close[a];
            posicao_compra = a;
            //console.log("Comprou", sinal_compra)
        }


        var parar = false;
        var resultado = 0;
        if (preco_compra > 0) {
            resultado = (acao.close[a] - preco_compra) / preco_compra * 100;
            if (resultado < stop) {
                parar = true;
                quant_stops++;
                resultado = stop;
            }
        }
        //console.log(parar, p, sinal, preco_compra);
        if ((parar || ((p == "Cruzou Abaixo" || p == "Abaixo"))) && preco_compra > 0) {

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
                "curta_compra": medias.curta[posicao_compra],
                "longa_compra": medias.longa[posicao_compra],
                "stop": stop,
                "d_inicial": acao.data[0],
                "d_final": acao.data[acao.data.length - 1],
                "sinal": sinais.sinais_compra[posicao_compra],
                "t_curta": medias.tamanho_curta,
                "t_longa": medias.tamanho_longa,
                "quadrante": quadrante,
                "Resultado": resultado,
                "ResultadoDia": resultado / diffDays
            }
           // console.log("Vendido: ", operacao);

            operacoes.push(operacao);
            preco_compra = 0;

        }

    }

    var estrategia = {
        "Acao": acao,
        "Curta": medias.curta,
        "Longa": medias.longa,
        "serie_curta": chart_serie_curta,
        "serie_longa": chart_serie_longa,
        "serie_acao": chart_serie_acao,
        "lista_sinal": sinais.indicador_compra,
        "Posicao": posicao,
        "Operacoes": operacoes,
        "Resultado": total,
        "quant_stops": quant_stops,
        "tamanho_sinal": sinais.tamanho_indicador_compra,
        "Dias": dias_comprados,
        "ResultadoDia": total / dias_comprados
    }
    return estrategia;

}
async function iniciar() {

    var petr4 = carregar_acao(nome_acao[1]);

    var tempo_curto = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    var tempo_longo = [10, 11, 12, 13, 14, 15, 18, 20, 25];

    var tempo_sinal_compra = [10, 12, 14, 16, 18, 22, 24, 28];
    var tempo_sinal_venda = [10, 12, 14, 16, 18, 22, 24, 28];

    var stops = [-1, -2, -3, -4, -5];

    var tamanho_quadrante = 100;
    var maior = -100;
    var melhor;
    var parar_processo = false;
    var id = 0;

    for (var si in tempo_sinal_venda) {
        process.stdout.write('.');

        var tamanho_indicador_venda = tempo_sinal_venda[si];

        for (var st in stops) {

            var stop = stops[st];

            for (var ad in tempo_sinal_compra) {

                var tamanho_indicador_compra = tempo_sinal_compra[ad];

                for (var t in tempo_curto) {

                    var t_c = tempo_curto[t];

                    for (var t2 in tempo_longo) {

                        if (!parar_processo) {
                            var res = 0;
                            var dias = 0;
                            var ests = [];
                            var operacoes = 0;

                            //parcial
                            for (var temp = 0; temp < 600; temp += tamanho_quadrante) {

                                //console.log(petr4.data_original.length);
                                petr4.cortar(petr4.close_original.length - tamanho_quadrante - temp, tamanho_quadrante);
                                var t_l = tempo_longo[t2];

                                var curta = await sma(petr4, t_c);
                                var longa = await sma(petr4, t_l);

                                var indicador_compra = await aroonosc(petr4, tamanho_indicador_compra);
                                var indicador_venda = await aroonosc(petr4, tamanho_indicador_venda);

                                var sinais_compra = sinal(petr4, indicador_compra[0], 0);
                                var sinais_venda = sinal(petr4, indicador_venda[0], 0);

                                var sinais = {

                                    'sinais_compra': sinais_compra,
                                    'sinais_venda': sinais_venda,
                                    'indicador_compra': indicador_compra,
                                    'indicador_venda': indicador_venda,
                                    'tamanho_indicador_compra': tamanho_indicador_compra,
                                    'tamanho_indicador_venda': tamanho_indicador_venda,
                                    'descricao_ind_compra': 'aroonosc',
                                    'descricao_ind_venda': 'aroonosc',

                                }

                                var medias = {
                                    'curta': curta[0],
                                    'longa': longa[0],
                                    'tamanho_curta': t_c,
                                    'tamanho_longa': t_l

                                }
                                var estrategia = crosser(petr4, medias, sinais, stop, temp);

                                res += estrategia.Resultado;
                                dias += estrategia.Dias;
                                operacoes += estrategia.Operacoes.length
                                ests.push(estrategia);

                            }
                            //total
                            petr4.cortar(petr4.close_original.length - 600, 600);
                            var t_l = tempo_longo[t2];
                            var indicador_compra = await aroonosc(petr4, tamanho_indicador_compra);
                            var indicador_venda = await aroonosc(petr4, tamanho_indicador_venda);

                            var sinais_compra = sinal(petr4, indicador_compra[0], 0);
                            var sinais_venda = sinal(petr4, indicador_venda[0], 0);

                            var sinais = {

                                'sinais_compra': sinais_compra,
                                'sinais_venda': sinais_venda,
                                'indicador_compra': indicador_compra,
                                'indicador_venda': indicador_venda,
                                'tamanho_indicador_compra': tamanho_indicador_compra,
                                'tamanho_indicador_venda': tamanho_indicador_venda,
                                'descricao_ind_compra': 'aroonosc',
                                'descricao_ind_venda': 'aroonosc',

                            }

                            var medias = {
                                'curta': curta[0],
                                'longa': longa[0],
                                'tamanho_curta': t_c,
                                'tamanho_longa': t_l

                            }
                            //console.log(t_l);
                            var estrategia = crosser(petr4, medias, sinais, stop, 600);

                            ests.push(estrategia);
                            //console.log(estrategia.Operacoes);

                            if ((res + estrategia.Resultado) / (dias + estrategia.Dias) > maior && estrategia.Dias > 50 && estrategia.Operacoes.length > 2 && estrategia.quant_stops < 3) {
                                console.log("Curta:" + t_c, "Longa:" + t_l, "ADX:" + tamanho_indicador_compra, "Stop:" + stop, "Sinal ADX:" + tamanho_indicador_venda, "Res total:", res, "Dias:", dias, "Res Quadrante:" + res / dias, "Op Q:" + operacoes, "Res Geral:" + (estrategia.Resultado) / (estrategia.Dias), "Op G:" + estrategia.Operacoes.length);

                                maior = (res + estrategia.Resultado) / (dias + estrategia.Dias);
                                melhor = ests;
                                grafico(estrategia, id);
                                //parar_processo = true;
                            }
                            id++;

                        }
                    }
                }
            }
        }
    }

    if (melhor) {
        for (var a in melhor) {
            //console.log(melhor[a].Operacoes);

        }
    }
    console.log("Pronto");


}

var config = {};

function grafico(estrategia, id) {

    /* var estrategia = {
        "Acao": acao,
        "Curta": curta,
        "Longa": longa,
        "serie_curta": chart_serie_curta,
        "serie_longa": chart_serie_longa,
        "serie_acao": chart_serie_acao,
        "Posicao": posicao,
        "Operacoes": operacoes,
        "Resultado": total,
        "quant_stops": quant_stops,
        "Dias": dias_comprados,
        "ResultadoDia": total / dias_comprados
    }
    var operacao = {
                "Nome": acao.nome,
                "Compra": preco_compra,
                "Venda": acao.close[a],
                "d_compra": acao.data[posicao_compra],
                "d_venda": acao.data[a],
                "p_compra": posicao_compra,
                "p_venda": a,
                "dias": diffDays,
                "curta_compra": curta[posicao_compra],
                "longa_compra": longa[posicao_compra],
                "stop": stop,
                "d_inicial": acao.data[0],
                "d_final": acao.data[acao.data.length - 1],
                "sinal": lista_sinal[posicao_compra],
                "t_curta": tamanho_curta,
                "t_longa": tamanho_longa,
                "quadrante": quadrante,
                "Resultado": resultado,
                "ResultadoDia": resultado / diffDays
            }

    */

    var t_curta = estrategia.Operacoes[0].t_curta;
    var t_longa = estrategia.Operacoes[0].t_longa;
    var stop = estrategia.Operacoes[0].stop;

    var resultado = "ResT: " + Math.round(estrategia.Resultado * 100) / 100 + "% - ResD: " + Math.round(estrategia.ResultadoDia * 100) / 100 + "% - DiasC: " + estrategia.Dias + " - Op:" + estrategia.Operacoes.length;

    var curt = [];
    var longs = [];
    var adxs = [];
    var point_compra = {};
    for (var c in estrategia.Curta) {
        curt.push(Math.round(estrategia.Curta[c] * 100) / 100);
        longs.push(Math.round(estrategia.Longa[c] * 100) / 100);
        adxs.push(Math.round(estrategia.lista_sinal[c] * 100) / 100);
    }
    for (var o in estrategia.Operacoes) {

        var op = estrategia.Operacoes[o];
        point_compra['c_' + o] = {
            type: 'line',
            mode: 'vertical',
            value: op.d_compra,
            scaleID: "x",
            borderColor: 'green',
            borderWidth: 2,
            label: {
                enabled: true,
                position: "start",
                content: "C:" + op.Compra
            }
        }
        point_compra['v_' + o] = {
            type: 'line',
            mode: 'vertical',
            value: op.d_venda,
            scaleID: "x",
            borderColor: 'red',
            borderWidth: 2,
            label: {
                enabled: true,
                position: "start",
                content: "V:" + op.Venda + " R.D: " + Math.round(op.ResultadoDia * 100) / 100
            }
        }

    }
    config[id] = {
        type: 'line',
        data: {
            labels: estrategia.Acao.data,
            datasets: [
                {
                    label: 'Ação: ' + estrategia.Acao.nome,
                    borderColor: 'rgb(255, 99, 132)',
                    data: estrategia.Acao.close,
                    fill: false,
                    pointRadius: 2,
                },
                {
                    label: 'Média(' + t_curta + ")",
                    fill: false,
                    borderColor: 'rgb(54, 162, 235)',
                    data: curt,
                    pointRadius: 0,
                    borderDash: [4, 2],
                },
                {
                    label: 'Média(' + t_longa + ')',
                    fill: false,
                    borderColor: '#408d91',
                    data: longs,
                    pointRadius: 0,
                    borderDash: [12, 4],
                },
                {
                    label: 'ADX(' + estrategia.tamanho_sinal + ')    Resultado: ' + resultado + " STOP:" + stop,
                    fill: false,
                    borderColor: 'black',
                    data: adxs,
                    pointRadius: 0,
                    borderDash: [2, 2],
                },
            ],
        },
        options: {

            maintainAspectRatio: false,

            interaction: {
                intersect: true
            },

            plugins: {

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
            title: {
                display: true,
                text: 'Gráfico',
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
    console.log("https://grafico-mateusoro0.loca.lt/?id=" + id);
    //console.log(config);
}
app.get('/chartjs-chart-financial.js', function (req, res) {
    res.sendFile(path.join(__dirname, '/chartjs-chart-financial.js'));
});
app.get('/', function (req, res) {
    console.log(req.query.id);
    html = "<script src='https://cdn.jsdelivr.net/npm/chart.js@3.0.1/dist/chart.js'></script> " +
        "<script src='https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.min.js'></script> " +
        "<script src ='https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/1.0.1/chartjs-plugin-annotation.js'></script> " +
        "<script src='./chartjs-chart-financial.js' type='text/javascript'></script>" +
        "<script src='https://cdn.jsdelivr.net/npm/luxon@1.26.0'></script>" +
        "<script src='https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.0.0'></script>" +
        "<script src='https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js'></script>" +
        "<script src='https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/1.0.0-beta.2/chartjs-plugin-zoom.js'></script>" +
        "<div class='chart-container' width='1000' height='680'><canvas id='bar-chart' width='1000' height='680' ></canvas></div>" +
        "<script>" +
        "var logChart = new Chart(document.getElementById('bar-chart').getContext('2d'), " +
        JSON.stringify(config[req.query.id]) +
        "); " +
        "" +
        "</script>";

    res.send(html);
});

app.get('/iniciar', function (req, res) {
    res.send("Iniciando");
});

var seq = 0;
var link = "";
async function start() {
    var tunnel = await localtunnel({ port: 8888, subdomain: "grafico-mateusoro" + seq });

    if (tunnel.url != "https://grafico-mateusoro" + seq + ".loca.lt") {
        console.log("Diferente", tunnel.url);
        seq++;
        tunnel.close();
        start(seq);
    } else {
        console.log("Abriu", tunnel.url);
        link = tunnel.url;
    }

    tunnel.on('close', () => {
        console.log("Fechou", tunnel.url);
    });
    tunnel.on('error', (err) => {
        console.log("Erro", tunnel.url, err);
    });

}

var nome_acao = ["PETR4.SA", "PETR4"];
//var nome_acao = ["VALE3.SA", "VALE3"];   
async function download(acao, arquivo) {
    var hoje = Math.round(new Date().getTime() / 1000);
    var anterior = Math.round(new Date('2005-01-01').getTime() / 1000);
    var link = "https://query1.finance.yahoo.com/v7/finance/download/" + acao + "?period1=0&period2=" + hoje + "&interval=1d&events=history&includeAdjustedClose=true"
    var options = {
        filename: arquivo,
        timeout: 30000
    }
    await get(link, options);
    console.log("Baixado");
}

async function atualizar_acao() {
    try {
        const stats = fs.statSync(nome_acao[1]);
        if (stats.mtime.getDay() != new Date().getDay()) {
            console.log("Atualizado 0" + nome_acao[0])
            await download(nome_acao[0], nome_acao[1]);
        }
    } catch (e) {
        console.log("Atualizado 1" + nome_acao[0])
        await download(nome_acao[0], nome_acao[1]);
    }
}
atualizar_acao();

app.listen(8888, () => {
    start();
    iniciar();
})




