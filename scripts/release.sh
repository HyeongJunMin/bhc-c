#!/bin/bash
set -e

IMAGE="hjmin0218/bhc"
TAG="${1:-latest}"
LIGHTSAIL_HOST="ec2-user@3.36.90.170"
LIGHTSAIL_KEY="$HOME/.ssh/lightsail.pem"

echo "==> [1/3] Building web..."
pnpm --filter @bhc/web build

echo "==> [2/3] Building & pushing Docker image ($IMAGE:$TAG)..."
docker build -f docker/Dockerfile -t "$IMAGE:$TAG" .
docker push "$IMAGE:$TAG"

echo "==> [3/3] Deploying to Lightsail..."
ssh -i "$LIGHTSAIL_KEY" -o StrictHostKeyChecking=no "$LIGHTSAIL_HOST" "bash /home/ec2-user/deploy.sh $TAG"

echo "==> Done!"
