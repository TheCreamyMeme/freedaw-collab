#/usr/bin/env bash
git pull origin
docker build --no-cache -t freedaw-api ./backend
docker stop freedaw-api
docker rm freedaw-api
docker run -d --name freedaw-api -p 3010:3000 -v ./backend/webdaw-projects:/app/projects -v ./backend/webdaw-samples:/app/samples --restart unless-stopped freedaw-api
docker build --no-cache -t freedaw ./frontend
docker stop freedaw
docker rm freedaw
docker run -d --name freedaw -p 3009:3000 --restart unless-stopped free-daw:latest