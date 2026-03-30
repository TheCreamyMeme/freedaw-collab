#/usr/bin/env bash
git pull origin &&

docker stop freedaw-api
docker rm freedaw-api
docker rmi freedaw-api

docker stop freedaw
docker rm freedaw
docker rmi freedaw


docker system prune -a -f --volumes


docker build --no-cache --progress=plain -t freedaw-api:latest -f ./backend/dockerfile ./backend &&
docker run -d --name freedaw-api -p 3010:3000 -v ./backend/webdaw-projects:/app/projects -v ./backend/webdaw-samples:/app/samples -v ./backend/webdaw-users:/app/users -v ./backend/webdaw-plugins:/app/plugins --restart unless-stopped freedaw-api:latest

docker build --no-cache --progress=plain -t freedaw:latest -f ./frontend/dockerfile ./frontend &&
docker run -d --name freedaw -p 3009:3000 -v ./frontend/data:/app --restart unless-stopped freedaw:latest