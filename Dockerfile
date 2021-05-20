# Start from the code-server Debian base image
FROM codercom/code-server:latest 

USER coder

# Apply VS Code settings
COPY deploy-container/settings.json .local/share/code-server/User/settings.json

# Use bash shell
ENV SHELL=/bin/bash

# Install unzip + rclone (support for remote filesystem)
RUN sudo apt-get update && sudo apt-get install unzip -y
RUN curl https://rclone.org/install.sh | sudo bash

# You can add custom software and dependencies for your environment here. Some examples:

# RUN code-server --install-extension esbenp.prettier-vscode
RUN sudo apt-get install -y build-essential
# RUN COPY myTool /home/coder/myTool

# Install NodeJS
RUN sudo curl -fsSL https://deb.nodesource.com/setup_15.x | sudo bash -
RUN sudo apt-get install -y nodejs

# Fix permissions for code-server
RUN sudo chown -R coder:coder /home/coder/.local

# Port
ENV PORT=8080

# Use our custom entrypoint script first
COPY deploy-container/entrypoint.sh /usr/bin/deploy-container-entrypoint.sh

RUN mkdir -p /home/coder/.config/rclone/
COPY deploy-container/rclone.conf /home/coder/.config/rclone/rclone.conf
RUN rclone sync rclone: /home/coder/ -vv
RUN npm install -g tulind csv-load-sync async-get-file async-get-file express path localtunnel cron shelljs

ENTRYPOINT ["/usr/bin/deploy-container-entrypoint.sh"]
