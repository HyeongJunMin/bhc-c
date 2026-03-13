#!/bin/bash
set -e

IMAGE="hjmin0218/bhc"
TAG="${1:-latest}"
CONTAINER="bhc-game-server"
PORT="9211"

echo "==> Deploying $IMAGE:$TAG"

# Stop and remove existing container
if sudo docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "==> Stopping and removing existing container: $CONTAINER"
  sudo docker stop "$CONTAINER"
  sudo docker rm "$CONTAINER"
fi

# Pull image
echo "==> Pulling $IMAGE:$TAG"
sudo docker pull "$IMAGE:$TAG"

# Start container
echo "==> Starting container: $CONTAINER"
sudo docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:9900" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DEPLOY_SECRET="${DEPLOY_SECRET}" \
  --restart unless-stopped \
  "$IMAGE:$TAG"

echo "==> Done. Running at http://localhost:$PORT"
