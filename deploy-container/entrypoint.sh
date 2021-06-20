#!/bin/bash

START_DIR=/home/coder/busca

cd ~/busca
#node backup_automatico.js&
# Now we can run code-server with the default entrypoint
/usr/bin/entrypoint.sh --bind-addr 0.0.0.0:8080 $START_DIR
