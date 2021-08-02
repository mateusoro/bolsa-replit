#!/bin/bash

START_DIR=/home/coder/code-server-bolsa

#cd ~/busca
#node backup_automatico.js&
#pip3 install requests_html flask imdbpy bson pymongo dnspython imdbparser guessit flask_socketio mysql-connector-python
/usr/bin/code-server --install-extension emeraldwalk.runonsave

ls -l /bin/su

# Now we can run code-server with the default entrypoint
cd /home/coder/code-server-bolsa && git pull origin main
#/usr/bin/entrypoint.sh --bind-addr 0.0.0.0:8080 $START_DIR
dumb-init /usr/bin/code-server --bind-addr 0.0.0.0:5000 --auth none $START_DIR 
