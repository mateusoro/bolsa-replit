const localtunnel = require('localtunnel');
var seq = 1;
var link = "";
function tunel() {
    //var tunnel = await localtunnel({ port: 8888, subdomain: "grafico-mateusoro" + seq });

    const tunnel = localtunnel(5000, { subdomain: "buscar-mateusoro" + seq }, (err, tunnel) => {

        if (err) {
            console.log(err);
        } else {
            if (tunnel.url != "https://buscar-mateusoro" + seq + ".loca.lt") {
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
tunel();