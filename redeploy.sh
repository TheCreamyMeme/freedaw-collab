#/usr/bin/env bash
git pull origin &&

docker stop freedaw-api
docker rm freedaw-api
docker rmi freedaw-api

docker stop freedaw
docker rm freedaw
docker rmi freedaw


docker system prune -a -f --volumes


docker build --no-cache --progress=plain -t freedaw-api:latest -f /etc/dockercompose/daw_webapp/backend/dockerfile /etc/dockercompose/daw_webapp/backend &&
docker run -d --name freedaw-api -p 3010:3000 -v /etc/dockercompose/daw_webapp/backend/webdaw-projects:/app/projects -v /etc/dockercompose/daw_webapp/backend/webdaw-samples:/app/samples --restart unless-stopped freedaw-api:latest

docker build --no-cache --progress=plain -t freedaw:latest -f /etc/dockercompose/daw_webapp/frontend/dockerfile /etc/dockercompose/daw_webapp/frontend &&
docker run -d --name freedaw -p 3009:3000 -v /etc/dockercompose/daw_webapp/frontend:/app/webdaw --restart unless-stopped freedaw:latest