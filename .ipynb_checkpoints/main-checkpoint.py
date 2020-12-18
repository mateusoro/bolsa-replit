# -*- coding: utf-8 -*-
from requests_html import HTMLSession
from flask import Flask, request, render_template, redirect
import imdb
from bson.json_util import dumps
import pymongo
import dns
from imdbparser import IMDb
from pymongo import MongoClient
from guessit import guessit
from flask_socketio import SocketIO, emit
import logging
import threading
import os
import re

import libtorrent as lt
import time

ses = lt.session({
	 'upload_rate_limit': 0
	,'download_rate_limit': 0
	,'active_downloads': -1
	,'active_limit': -1
	,'alert_mask': 0
})

ses.listen_on(6881, 6891)
ses.add_extension('ut_metadata')
ses.add_extension('ut_pex')
ses.add_extension('smart_ban')
ses.add_extension('metadata_transfer')
ses.add_dht_router("router.utorrent.com", 6881)
ses.add_dht_router("router.bittorrent.com", 6881)
ses.add_dht_router("dht.transmissionbt.com", 6881)
ses.add_dht_router('127.0.0.1',6881)    
ses.add_dht_router("dht.aelitis.com", 6881)
ses.start_dht()
ses.start_lsd()
ses.start_natpmp()
ses.start_upnp()  

# https://www.btmulu.com/hash/
# ps -fA | grep main.py
# kill 509

session = HTMLSession()
app = Flask('app')
app.debug = False

ia = imdb.IMDb()
top = ia.get_top250_movies()

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

socketio = SocketIO(app, async_mode='threading',
                    cors_allowed_origins="*", logger=False, engineio_logger=False)

client = MongoClient("mongodb+srv://root:root@cluster0-0rj95.mongodb.net/test?retryWrites=true")
db = client.registros

#db.registros.delete_many({'titulo' : "Grey's Anatomy"})
#db.legendado.delete_many({})

import os, shutil
import time
import stat

folder = 'downloads/'
if not os.path.exists(folder):
    os.makedirs(folder)

params = {  'save_path': 'downloads/',
                'auto_managed': True,
                'file_priorities': [0]*5}

def apagar_download():
    for filename in os.listdir(folder):
        file_path = os.path.join(folder, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
                #print('Apagado',file_path)
                socketio.emit('log', 'Apagado: '+file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
                #print('Apagado',file_path)
                socketio.emit('log', 'Apagado: '+file_path)
        except Exception as e:
            print('Failed to delete %s. Reason: %s' % (file_path, e))

apagar_download()

def getConfig(config, default):
    try:
        return int(db.config.find({'config':config})[0]['parametro'])
    except:
        return default


    
magnet_banco = []
imdb_filme_banco = []
imdb_serie_banco = []    

def iniciar_banco():
    try:
        current_day = int(time.strftime("%d", time.localtime()))
        mod_day = int(time.strftime("%d", time.gmtime ( os.stat('magnet_banco.txt') [ stat.ST_MTIME ] ) ))
        if current_day == mod_day:
            read_banco()
            print('banco local',current_day, mod_day)
        else:
            write_banco()
            print('banco web',current_day, mod_day)        
    except Exception as e:
        print('Erro Carregando Banco')
        write_banco()


def write_banco():
    magnet_banco = db.registros.distinct('magnet')
    with open('magnet_banco.txt', 'w') as filehandle:
        for listitem in magnet_banco:
            filehandle.write('%s\n' % listitem)
    
    imdb_filme_banco = db.registros.find({'Filme':'Sim'}).distinct('imdb')
    with open('imdb_filme_banco.txt', 'w') as filehandle:
        for listitem in imdb_filme_banco:
            filehandle.write('%s\n' % listitem)
    imdb_serie_banco = db.registros.aggregate([
                                                { '$match':{'Filme': 'Não'} },
                                                {
                                                    '$project': {        
                                                        "imdb": {            
                                                            '$arrayElemAt':[{'$split': ["$imdb" , " "]}, 0]                
                                                        },
                                                        'f':'$Filme'
                                                    }
                                                }, 
                                                {'$group': {'_id':'$imdb'}}

                                            ])
    with open('imdb_serie_banco.txt', 'w') as filehandle:
        for listitem in imdb_serie_banco:            
            filehandle.write('%s\n' % listitem['_id'])

def read_banco():
    with open('magnet_banco.txt', 'r') as filehandle:
        for line in filehandle:
            currentPlace = line[:-1]
            magnet_banco.append(currentPlace)
    with open('imdb_filme_banco.txt', 'r') as filehandle:
        for line in filehandle:
            currentPlace = line[:-1]
            imdb_filme_banco.append(currentPlace)
    with open('imdb_serie_banco.txt', 'r') as filehandle:
        for line in filehandle:
            currentPlace = line[:-1]
            imdb_serie_banco.append(currentPlace)







def carregar_sky(links):    
    print('Início: '+ str(len(links))+" links")   
    socketio.emit('log', 'Carregando Links: '+str(len(links)))
    socketio.emit('atualizar', 'Detalhes do Link')
    
    for l in links:       
        print(' ')
        li = l['link']
        try:
            ha = li[20:li.index('&')].lower()
        except:
            print("Erro Magnet: " + li)
            ha = li[20:].lower()

        nao_existe = l['link'] not in magnet_banco
        if nao_existe:
            nao_existe = db.registros.find({'magnet':l['link']}).count()==0
        
        imdb_encontrado = len(l['imdb']) > 0       
        
        if imdb_encontrado and nao_existe:
            
            arquivos = []                      
            arquivos = carregar_torrent_download(ha)
            
            ind = 0
            for a in arquivos:
                
                a = a.replace('[WWW.BLUDV.TV] ', '').replace(
                'Acesse o ORIGINAL WWW.BLUDV.TV ', '').replace(
                    '[ACESSE COMANDOTORRENTS.COM] ', '').replace(
                        'WWW.COMANDOTORRENTS.COM', '').replace(
                            'WWW.BLUDV.TV', '').replace(
                                '[WW.BLUDV.TV]', '').replace('WwW.LAPUMiAFiLMES.COM', '').replace('x264', '').replace('h264', '')
                try:

                    if (a[-3:] not in ['exe', 'txt', 'url', 'srt', 'peg', 'jpg','png','nfo', 'zip']) and (a[-10:] not in ['sample.mkv']) and (a not in ["COMANDOTORRENTS.COM.mp4", "slotsricos.com.mp4", "1XBET.COM_promo_SHREK_dinheiro_livre.mp4","BLUDV.TV.mp4", "BLUDV.mp4","LAPUMiA.mp4","File Name"]) and ("LEGENDADO" not in a)and ("1XBET.COM_promo_SHREK_dinheiro_livre.mp4" not in a):

                        convert = guessit(a)
                        confirma = isSerie(l['imdb'])
                        
                        if confirma == "Sim":                            
                            
                            if 'episode' in convert:
                                if not str(convert['episode']).isnumeric():                                                                       
                                    convert.pop('episode')                                                          
                            
                            if 'season' in convert:  
                                if not str(convert['season']).isnumeric():
                                    convert.pop('season')   
                            
                            
                            if 'season' not in convert:
                                se = busca_temporada(a)
                                if se:
                                    convert['season'] = se
                                else:
                                    print('Sessão não encontrado', a)
                                    
                            if 'episode' not in convert:
                                se = busca_episodeo(a)
                                if se:
                                    convert['episode'] = se
                                else:
                                    print('Episódio não encontrado', a)
                                    
                            
                                  
                            if 'season' in convert and 'episode' in convert :
                                
                                sessao = str(convert['season'])                                
                                episode = str(convert['episode'])
                                
                                im = l['imdb'] + " " + sessao + " " + episode

                                ins = {
                                    'id': 0,
                                    'imdb': im,
                                    'magnet': li,
                                    'mapa': ind,
                                    'nome': a,
                                    'Filme':'Não'
                                }
                                
                                db.registros.insert_one(ins)
                                print(im, ind, convert['title'], a)
                                if ('NOS4A2' in a) or ('nos4a2' in a):
                                    socketio.emit('atualizar', 'Adicionado:  NOS4A2 (' + im + ") "+ a)
                                else:
                                    socketio.emit('atualizar', dumps(ins))
                                    socketio.emit('log', 'Adicionado: '+im +" "+ convert['title'] +" "+a)
                            else:
                                                                                              
                                socketio.emit('log', "Sessão ou Episódio não identificado: "+a)

                        if confirma == "Não":
                            ins = {'id': 0,'imdb': l['imdb'],'magnet': li,'mapa': ind,'nome': a, 'Filme':'Sim'}
                            db.registros.insert_one(ins)
                            socketio.emit( 'atualizar', dumps(ins))
                            print(l['imdb'], ind, convert['title'], a)
                            socketio.emit('log', 'Adicionado: '+l['imdb'] +" "+ convert['title'] +" "+a)
                        
                        if confirma == "Erro":
                            print("Erro Identificando IMDB: ",l['imdb'])
                            socketio.emit('log', "Erro Identificando IMDB: "+l['imdb'])
                            

                except Exception as e:
                    print('Erro',e)
                    socketio.emit('log', 'Erro Carregando: '+ ha +" "+ a)

                ind = ind + 1
           
            if len(arquivos)==0:
                print('Metadado não encontrado: ' + ha)
                db.servico.insert_one({
                    'hash': ha,
                    'imdb': l['imdb']
                })
                socketio.emit('log', 'Metadado não encontrado: ' + ha)

        else:
            if not imdb_encontrado:
                socketio.emit('log', 'IMDB não Encontrado: ' + ha)
                print('IMDB não Encontrado: ' + ha)
            if not nao_existe:
                socketio.emit('log', 'Já Existe: ' + ha)
                print('Já Existe: ' + ha)
            

    socketio.emit('atualizar', 'Fim da Busca')
    socketio.emit('log', 'Fim da Busca')
    limpar()

def busca_temporada(nome):
    se = re.findall(' ([0-9])ª Tempo| ([0-9][0-9])ª Tempo| \.([0-9])ª Tempo| \.([0-9][0-9])ª Tempo', nome, re.IGNORECASE)
    if len(se) > 0:
        for r in se[0]:
            if len(r) > 0:            
                return r
    return ""

def busca_episodeo(nome):
    se = re.findall('/([0-9]) - |/([0-9][0-9]) - |/([0-9])-|/([0-9][0-9])-|/([0-9][0-9]) |[0-9]\.([0-9][0-9]) ', nome, re.IGNORECASE)
    if len(se) > 0:
        for r in se[0]:
            if len(r) > 0:            
                return r
    return ""

series_filme = {}  

def isSerie(imdb, seq=0):
    try:
        im = str(imdb).strip()[2:]
        if im in imdb_filme_banco:
            return "Não"
        if im in imdb_serie_banco:
            return "Sim"
        
        if series_filme.get(im) == None:        
            movie = ia.get_movie(im)
            if movie.get('title') != None:
                if movie.get('seasons') == None:
                    series_filme[im] = "Não"
                    return "Não"
                else:
                    series_filme[im] = "Sim"
                    return "Sim"
            else:
                return "Erro"
        else:
            return series_filme.get(im)
    except:
        if seq==1:
            print('Erro Tentativa isSerie 2', imdb)
            return "Erro"
        else:
            print('Erro Tentativa isSerie 1', imdb)
            return isSerie(imdb, 1)
            

    
def carregar_torrent_download(link, tempo=10):
    r=[]
    
    handle = lt.add_magnet_uri(ses, "magnet:?xt=urn:btih:"+link, params)
    handle.set_sequential_download(1)
    handle.resume()
    
    contador = 0    
    socketio.emit('log', 'Esperando Download do Torrent!')
    
    while (not handle.has_metadata() and contador < tempo):       
        contador += 1
        time.sleep(2)
       
    if handle.has_metadata():
        torinfo = handle.get_torrent_info()

        for x in range(torinfo.files().num_files()):
            r.append(torinfo.files().file_path(x))
            #print(torinfo.files().file_path(x))

        ses.remove_torrent(handle)
    else:
        for ret in db.retorno_servico.find({'hash':link}):
            print('Baixado pelo Serviço')
            r = ret['arquivos']
            
    apagar_download()
    return r

def limpar():
    for r in db.registros.find({"$or":[{"nome": {"$regex":"\.srt|\.url|\.exe|\.sub|\.txt|\.nfo|\.jpeg|\.jpg|\.png|\.zip|sample|1XBET.COM_promo_SHREK_dinheiro_livre.mp4|.*HDCAM.*|slotsricos.com.mp4"}}, {"nome": "BLUDV.TV.mp4"}, {"nome": "BLUDV.mp4"},{"nome": "LAPUMiA.mp4"}, {"nome": "COMANDOTORRENTS.COM.mp4"}]}).limit(1000):
        nome = str(r['nome']).strip()
        db.registros.delete_one({"_id": r['_id']})
        print('Apagado: ', nome)

    for r in db.registros.aggregate([{'$group': {'_id': {'mapa': "$mapa",'magnet': "$magnet"},'uniqueIds': {'$addToSet': "$_id"},'count': {'$sum': 1}}},{'$match': {'count': {"$gt": 1}}}]):
        for x in range(0, len(r['uniqueIds']) - 1):
            id = r['uniqueIds'][x]
            db.registros.delete_one({"_id": id})
            print('Duplicado: ', r['uniqueIds'])
    db.registros.delete_many({'ano': {'$lt': 1989}})
    db.registros.delete_many({"imdb": {"$regex":"tt0413573 2007 .*"}})
    db.registros.delete_many({"$or":[{'imdb':'tt0121955'},{'imdb':'tt0096697'},{'imdb':'tt0397306'},{'imdb':'tt0182576'},{'imdb':'tt0413573'},{'imdb':'tt2193021'},{'imdb':'tt6025022'},{'imdb':'tt4052886'},{'imdb':'tt0115200'},{'imdb':'tt0242213'},{'imdb':'tt0460681'},{'imdb':'tt10014308'}]})
    
    db.registros.delete_many({"mapa": {'$type': "string"}})
    limpar_profundo()
    corrigir_titulo_serie()
    corrigir_titulo_filme()

def limpar_profundo():
    linhas = db.registros.find({'imdb': {'$not': {'$regex': '.* .*'}},'Filme':None}).distinct('imdb')
    print('Carregando Filmes: ',len(linhas))
    for r in linhas:
        
        im = str(r).strip()[2:]
        movie = ia.get_movie(im)
        if movie.get('title') != None:
            if movie.get('seasons') == None:
                print('Filme: ', movie.get('title'))
                db.registros.update_many({'imdb': r}, {"$set": {"Filme": 'Sim'}})            
            else:
                db.registros.delete_many({'imdb': r})
                print('Apagado: ', movie.get('title'), movie.get('seasons'),r)
        else:
            print('Não Encontrado: ', r)


         
                

def corrigir_titulo_filme():
    print('corrigir_titulo_filme: Iniciado')
    repetir = False
    for r in db.registros.find({'titulo': {    '$exists': False},'imdb': {'$not': {'$regex': '.* .*'}}}).limit(20):
        # print(r)
        try:
            im = str(r['imdb']).strip()[2:]
            imdb = IMDb()
            print(int(im))
            movie = imdb.get_movie(int(im))
            movie.fetch()
            print(movie.__dict__['title'])
            print(movie.__dict__['year'])
            db.registros.update_one({"_id": r['_id']}, {"$set": {"titulo": movie.__dict__['title'],"ano": movie.__dict__['year']}})
            print('Sem Título: ', im, movie.__dict__['title'])
            repetir = True
        except:
            db.registros.update_one({"_id": r['_id']}, {"$set": {"titulo": 'Título não encontrado',"ano": 0}})
            repetir = True
            print('Erro Sem Título: ', im)

    for r in db.registros.find({'ano': None,'imdb': {'$not': {'$regex': '.* .*'}}}).limit(20):
        # print(r)
           
        try:
            im = str(r['imdb']).strip()[2:]
            movie = ia.get_movie(str(im))           
            print(movie.get('title'))
            if movie.get('year')==None:
                db.registros.update_one({"_id": r['_id']}, {"$set": {"ano": 2020}})
                print('Erro Sem Ano: ', im)
                repetir = True
            else:
                db.registros.update_one({"_id": r['_id']}, {"$set": {"ano": movie.get('year')}})
                repetir = True
                print('Sem Ano: ', im, movie.get('year'))
            print(' ')
                
        except:
            db.registros.update_one({"_id": r['_id']}, {"$set": {"ano": 2020}})
            print('Erro Sem Ano: ', im)
            repetir = True
            print(' ')
            
    if repetir:
        corrigir_titulo_filme()


def corrigir_titulo_serie():
    print('corrigir_titulo_serie Iniciado')
    repetir = False
    for r in db.registros.find({'titulo': {'$exists': False},'imdb': {'$regex': '.* .*'}}).limit(1):
        # print(r)
        try:
            im = str(r['imdb']).strip()[2:r['imdb'].index(" ")]
            imdb = IMDb()
            print(int(im))
            movie = imdb.get_movie(int(im))
            movie.fetch()
            print(movie.__dict__['title'])
            print(movie.__dict__['year'])
            print('.*' + str(im) + '.*')
            db.registros.update_many({'imdb': {'$regex': '.*' + str(im) + '.*'}}, {"$set": {"titulo": movie.__dict__['title'],"ano": movie.__dict__['year']}})
            print('Sem Título: ', im, movie.__dict__['title'])
            repetir = True
        except:
            im = str(r['imdb']).strip()[2:r['imdb'].index(" ")]
            db.registros.update_many({'imdb': {'$regex': '.*' + str(im) + '.*'}}, {"$set": {"titulo": 'Título não encontrado',"ano": 0}})
            repetir = True
            print('Erro Sem Título: ', im)

    for r in db.registros.find({'ano': None,'imdb': {'$regex': '.* .*'}}).limit(1):
        # print(r)
        try:
            im = str(r['imdb']).strip()[2:r['imdb'].index(" ")]           
            print(im)
            movie = ia.get_movie(str(im))           
            print(movie)
            if movie.get('year')==None:
                im = str(r['imdb']).strip()[2:r['imdb'].index(" ")]
                db.registros.update_many({'imdb': {'$regex': '.*' + str(im) + '.*'}}, {"$set": {"ano": 2020}})
                repetir = True
                print('Erro Sem Ano: ', im)
            else:   
                print(movie.get('year'))
                print('.*' + str(im) + '.*')
                db.registros.update_many({'imdb': {'$regex': '.*' + str(im) + '.*'}}, {"$set": {"ano": movie.get('year')}})
                print('Sem Ano: ', im, movie.get('title'))
                repetir = True
            print(' ')
        except Exception as e:
            im = str(r['imdb']).strip()[2:r['imdb'].index(" ")]
            db.registros.update_many({'imdb': {'$regex': '.*' + str(im) + '.*'}}, {"$set": {"ano": 2020}})
            repetir = True
            print('Erro Sem Ano: ', im,e)
            print(' ')
    if repetir:
        corrigir_titulo_serie()


@app.route('/link')
def link():
    q = request.args.get("q")
    i = request.args.get("i")
    print(q)
    if (q != None):
        socketio.start_background_task(thread_link, q, i)
    return redirect("/", code=302)


@app.route('/')
def hello_world():
    q = request.args.get("q")
    print(q)
    if (q != None):
        lin = "https://ondeeubaixo.net/index.php?campo1=" + q + "&nome_campo1=pesquisa&categoria=lista&"
        socketio.start_background_task(thread_lista, lin, 3)
    return render_template('busca.html')


def processa_pagina(link, id_imdb, ret, imdb_pref=""):
    r2 = session.get(link)
    if len(id_imdb) == 0:
        try:
            id_imdb = r2.html.find("a[href*='www.imdb.com']", first=True).attrs['href']
            id_imdb = id_imdb.replace("http://www.imdb.com/title/", "").replace("https://www.imdb.com/title/", "").replace("/", "").replace("/", "").replace("?ref_=nv_sr_", "").replace("?ref_=plg_rt_1", "").replace("http:www.imdb.com", "").replace("https:www.imdb.com", "").strip()
        except:
            print('Erro Convertendo IMDB', link)
            id_imdb = ""

    if len(imdb_pref) > 0:
        if id_imdb == imdb_pref:
            for html in r2.html.find('a[href^="magnet"]'):
                ret.append({'imdb': id_imdb, 'link': list(html.links)[0]})
        
    else:    
        for html in r2.html.find('a[href^="magnet"]'):
            ret.append({'imdb': id_imdb, 'link': list(html.links)[0]})
            
def thread_link(link, imdb):
   
    print(imdb, link)
    socketio.emit('atualizar', 'Carregando: ' + link)
    socketio.emit('log', 'Carregando: '+link)
    s = []
    processa_pagina(link, imdb, s)    
    carregar_sky(s)


def thread_lista(url, tamanho):
    s = []
    
    for x in range(1, tamanho):
        print(url + str(x))        
        r = session.get(url + str(x))
        titulos = r.html.find('.list-inline > li')
        for elem in titulos:           
            link = elem.find('a', first=True).attrs['href']
            dublado = elem.find('.idioma_lista', first=True).text.strip()            
            if dublado == "Dublado":
                print(link)
                socketio.emit('log', 'Carregando: '+link)
                socketio.emit('atualizar', 'Link: ' + link)
                processa_pagina(link, "", s)
                
    carregar_sky(s)

def thread_busca(url, tamanho):
    s = []    
    for x in range(1, tamanho):
        print(url + str(x))        
        r = session.get(url + str(x))
        titulos = r.html.find('.list-inline .semelhantes')
        for elem in titulos:            
            link = elem.find('a', first=True).attrs['href']
            print(link)
            socketio.emit('atualizar', 'Link: ' + link)
            socketio.emit('log', 'Carregando: '+link)
            processa_pagina(link, "", s)  
    
    carregar_sky(s)


def thread_lista_preferidos():
    s = []
    
    for pref in db.preferidos.find({}):
       
        r = session.get("https://ondeeubaixo.net/index.php?campo1=" + pref["nome"] + "&nome_campo1=pesquisa&categoria=lista&")
        titulos = r.html.find('.list-inline .semelhantes')
        for elem in titulos:            
            link = elem.find('a', first=True).attrs['href']
            print(link)
            socketio.emit('atualizar', 'Link: ' + link)
            socketio.emit('log', 'Carregando: '+link)
            processa_pagina(link, "", s, pref["imdb"])            
                    
    carregar_sky(s)


@socketio.on('preferido')
def preferido(im, nome):
    print("Preferido:" + im)
    print(db.preferidos.find({'imdb': im}).count())
    if db.preferidos.find({'imdb': im}).count() == 0:
        db.preferidos.insert_one({
            'imdb': im,
            'nome': nome
        })
    socketio.emit('resposta_funcoes', 'Adicionado ao Preferidos: ' + nome)
    socketio.emit('log', 'Adicionado ao Preferidos: ' + nome)


@socketio.on('remove_preferido')
def remove_preferido(im):
    print("Não Preferido:" + im)
    db.preferidos.delete_many({
        'imdb': im
    })
    socketio.emit('resposta_funcoes', 'Removido dos Preferidos: ' + im)
    socketio.emit('log', 'Removido dos Preferidos: ' + im)


@socketio.on('apagar')
def apagar(im):
    print("Apagado: " + im)
    db.registros.delete_many({'imdb': {'$regex': '.*' + im}})
    socketio.emit('resposta_funcoes', 'Apagado: ' + im)
    socketio.emit('log', 'Apagado: ' + im)

@socketio.on('config')
def config(c,parametro):
    print("Configurado: " + c,parametro)
    db.config.delete_many({'config': c})
    db.config.insert_one({'config': c,'parametro':parametro})    
    socketio.emit('log', 'Config Adicionada: ' + c +' '+parametro)


@socketio.on('carregar_lancamentos')
def sock_lancamento():    
    nav = sock_navegar()
    seq = 1
    for n in nav:
        im_n = n['link'][7:16]
        for b in db.registros.find({"$or":[{'imdb': {'$regex': '.*'+im_n+'.*','$options': 'i'}}]}).sort('imdb',-1).limit(1):
            socketio.emit('atualizar', dumps(b))    
        seq = seq + 1
    
def sock_navegar():
    s = []    
    r = session.get('https://www.imdb.com/chart/moviemeter?sort=us,desc&mode=simple&page=1')
    titulos = r.html.find('.lister-list tr .titleColumn')
    for elem in titulos:
        link = elem.find('a', first=True).attrs['href']
        ano = elem.find('span', first=True).text
        titulo =  elem.find('a', first=True).text.strip()
        s.append({'link':link, 'ano':ano, 'titulo':titulo+' (Filme)'})        
    
    r = session.get('https://www.imdb.com/chart/tvmeter?sort=us,desc&mode=simple&page=1')
    titulos = r.html.find('.lister-list tr .titleColumn')
    for elem in titulos:
        link = elem.find('a', first=True).attrs['href']
        ano = elem.find('span', first=True).text
        titulo =  elem.find('a', first=True).text.strip()
        s.append({'link':link, 'ano':ano, 'titulo':titulo+' (Série)'})        
    
    return s

@socketio.on('link')
def sock_link(message, im):
    socketio.emit('limpar')
    print(message+" "+im)
    socketio.start_background_task(thread_link, message, im)

@socketio.on('buscar')
def sock_buscar(message):
    socketio.emit('limpar')
    socketio.emit('atualizar', 'Buscando: ' + message)
    socketio.emit('log', 'Buscando: ' + message)
    
    lin = "https://ondeeubaixo.net/index.php?campo1=" + message + "&nome_campo1=pesquisa&categoria=lista&"
    socketio.start_background_task(thread_busca, lin, getConfig('tamanho', 3))


@socketio.on('lista')
def sock_lista(message):
    socketio.emit('limpar')
    socketio.emit('atualizar', 'Buscando: ')
    socketio.emit('log', 'Buscando: ')    
    socketio.start_background_task(thread_lista, message, getConfig('tamanho', 3))

@socketio.on('lista_preferidos')
def sock_lista_preferidos():
    socketio.emit('limpar')
    socketio.emit('atualizar', 'Buscando: ')
    socketio.emit('log', 'Carregando Preferidos: ')
    
    socketio.start_background_task(thread_lista_preferidos)

@socketio.on('inicio')
def sock_iniciado():
    print('inicio')
    # socketio.start_background_task(thread_lista, 'https://ondeeubaixo.net/lancamentos-', 3)

@socketio.on('parar')
def parar():
    print("Parando")
    

@socketio.on('carregar_preferidos')
def sock_preferidos():
    
    socketio.emit('limpar')
    socketio.emit('atualizar', 'Buscando: ')
    
    # socketio.emit('resposta_preferidos', dumps(db.preferidos.find()))
    for b in db.preferidos.find().sort('imdb',-1):
        socketio.emit('atualizar', dumps(b))
    socketio.emit('atualizar', 'Fim da Busca')

@socketio.on('buscar_im')
def buscar_im(nome):    
    socketio.emit('limpar')
    socketio.emit('atualizar', 'Buscando: '+nome)
    print("Buscando IMDB: " + nome)
    for b in db.registros.find({"$or":[{'nome': {'$regex': '.*'+nome+'.*','$options': 'i'}},{'titulo': {'$regex': '.*'+nome+'.*','$options': 'i'}},{'imdb': {'$regex': '.*'+nome+'.*','$options': 'i'}}]}).sort('imdb',-1):
        socketio.emit('atualizar', dumps(b))
    socketio.emit('atualizar', 'Fim da Busca')

@socketio.on('connect')
def test_connect():
    print('conectado')

@socketio.on('tabela')
def sock_tabela():
    print('tabela')
    socketio.emit('log', 'Carregando Tabela')
    socketio.emit('carregar_tabela', dumps(db.registros.find({})))

limpar()
iniciar_banco()
#db.registros.delete_many({'titulo' : "Grey's Anatomy"})
#socketio.start_background_task(thread_link, "https://ondeeubaixo.net/greys-anatomy-a-anatomia-de-grey-10-temporada-completa-torrent", "")
#db.registros.update_many({'imdb': {'$regex': '.* .*'}}, {"$set": {"Filme":'Não'}})
            
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(port)
    socketio.run(app,  debug=False,  host='0.0.0.0', port=port)



