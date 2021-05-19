#!/bin/bash

START_DIR=/home/coder/project

echo "Copying rclone config..."
mkdir -p /home/coder/.config/rclone/
touch /home/coder/.config/rclone/rclone.conf
echo $RCLONE_DATA | base64 -d > /home/coder/.config/rclone/rclone.conf

rclone sync rclone: /home/coder/ -vv

# Now we can run code-server with the default entrypoint
/usr/bin/entrypoint.sh --bind-addr 0.0.0.0:8080 $START_DIR
