#!/bin/bash

START_DIR=/home/mateusoro/bolsa-replit

#cd ~/busca
#node backup_automatico.js&
#pip3 install requests_html flask imdbpy bson pymongo dnspython imdbparser guessit flask_socketio mysql-connector-python
code-server --install-extension emeraldwalk.runonsave



# Now we can run code-server with the default entrypoint
cd /home/mateusoro/bolsa-replit && git pull origin main

#/usr/bin/entrypoint.sh --bind-addr 0.0.0.0:8080 $START_DIR
code-server --bind-addr 0.0.0.0:3000 --auth none $START_DIR 
