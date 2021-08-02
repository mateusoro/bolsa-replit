# Start from the code-server Debian base image
FROM codercom/code-server:latest 

ENV SHELL=/bin/bash

USER root
#RUN echo -e "root\nroot" | passwd root 
RUN useradd -rm -d /home/coder -s /bin/bash -g root -G root -u 1001 mateus
RUN echo 'mateus:mateus' | chpasswd
RUN echo 'root:root' | chpasswd
RUN chmod 4755 /bin/su 
#RUN chmod u+s /bin/su
RUN chown root:root /usr/bin/sudo && chmod 4755 /usr/bin/sudo


USER coder


# Apply VS Code settings
COPY deploy-container/settings.json .local/share/code-server/User/settings.json

# Use bash shell





# Install unzip + rclone (support for remote filesystem)
RUN sudo apt-get update && sudo apt-get install unzip -y
#RUN curl https://rclone.org/install.sh | sudo bash

# You can add custom software and dependencies for your environment here. Some examples:


RUN sudo apt-get install -y build-essential

# RUN COPY myTool /home/coder/myTool

# Install NodeJS
RUN sudo curl -fsSL https://deb.nodesource.com/setup_16.x | sudo bash -
RUN sudo apt-get install -y nodejs
RUN sudo apt-get install -y python3
RUN sudo apt-get install -y python3-pip
RUN sudo apt-get install -y python-libtorrent
RUN sudo apt-get install -y python3-libtorrent
RUN sudo apt-get install -y net-tools 
RUN sudo apt-get install -y ffmpeg


# Fix permissions for code-server
RUN sudo chown -R coder:coder /home/coder/.local

# Port
ENV PORT=8080

# Use our custom entrypoint script first
COPY deploy-container/entrypoint.sh /usr/bin/deploy-container-entrypoint.sh


#RUN sudo mkdir -p /root/.config/rclone/
#COPY deploy-container/rclone.conf /home/coder/.config/rclone/rclone.conf
#COPY deploy-container/rclone.conf /root/.config/rclone/rclone.conf
#RUN cd /home/coder/ && sudo git clone https://github.com/mateusoro/code-server-busca.git
RUN mkdir -p /home/coder/code-server-bolsa/
RUN cd /home/coder/code-server-bolsa && git config --global user.name "mateusoro"
RUN cd /home/coder/code-server-bolsa && git config --global user.email "mateusoro@gmail.com"
RUN cd /home/coder/code-server-bolsa && git init
RUN cd /home/coder/code-server-bolsa && sudo git remote add origin https://mateusoro:Ss161514.@github.com/mateusoro/code-server-bolsa.git
RUN cd /home/coder/code-server-bolsa && git pull origin HEAD:main
RUN cd /home/coder/code-server-bolsa && git checkout main

#RUN mkdir -p /home/coder/busca/
#RUN cp -rf code-server-busca/* busca/

#RUN sudo rclone sync rclone:/baskup_buscar /home/coder/ -vv --exclude="**node_modules/**" --exclude="**\.npm/**" --exclude="**site-packages/**" --exclude="**\.cache/**" --exclude="**downloads/**"
#RUN cd /home/coder/.local/share/code-server/extensions && sudo npm install fs-cp fs-walk ftp lodash mkdirp scp2 ssh2 stat-mode upath vscode
RUN cd /home/coder/code-server-bolsa && sudo npm install tulind csv-load-sync async-get-file async-get-file express path localtunnel cron shelljs

#RUN sudo chown -R coder:coder /home/
RUN cd /home/coder/code-server-bolsa && pip3 install requests_html flask imdbpy bson pymongo dnspython imdbparser guessit flask_socketio mysql-connector-python
RUN sudo chown -R coder:coder /home/

ENTRYPOINT ["/usr/bin/deploy-container-entrypoint.sh"]