# -*- coding: utf-8 -*-
from requests_html import HTMLSession
from bson.json_util import dumps
import pymongo
import dns
from imdbparser import IMDb
from pymongo import MongoClient
from guessit import guessit
import logging
import threading
import os

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
#pkill -f servico.py

session = HTMLSession()

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

client = MongoClient("mongodb+srv://root:root@cluster0-0rj95.mongodb.net/test?retryWrites=true")
db = client.registros

#db.registros.delete_many({'titulo' : "Mulan"})
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

hash_rodando = []

def carregar_torrent_download(link, imdb):
    r=[]
    print('Adicionado',link, imdb)
    handle = lt.add_magnet_uri(ses, "magnet:?xt=urn:btih:"+link, params)
    handle.set_sequential_download(1)
    handle.resume()
    
    contador = 0
    while (not handle.has_metadata()):
        print("Esperando "+str(contador),link, imdb, 'Ativos', len(hash_rodando)) 
        contador += 1
        time.sleep(5)

    if handle.has_metadata():
        torinfo = handle.get_torrent_info()

        for x in range(torinfo.files().num_files()):
            r.append(torinfo.files().file_path(x))
            print(torinfo.files().file_path(x))

        ses.remove_torrent(handle)   
    db.retorno_servico.insert_one({'hash':link, 'imdb':imdb,'arquivos':r}) 
    db.servico.delete_many({'hash':link})
    hash_rodando.remove(link)    
    
        
def inicia_servico():
    print('inicia_servico')
    for link in db.retorno_servico.distinct('hash'):
        db.servico.delete_many({'hash':link})
        
    for l in db.servico.aggregate( 
            [
                {"$group": { "_id": { 'hash': "$hash", 'imdb': "$imdb" } } }
            ]
        ):
        #print(l)
        t = l['_id']
        
        if t['hash'] not in hash_rodando:
            hash_rodando.append(t['hash'])
            threading.Thread(target=carregar_torrent_download, args=(t['hash'], t['imdb'])).start()
        

        
while (True):
    inicia_servico()
    time.sleep(30)













