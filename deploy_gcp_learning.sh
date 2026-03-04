#!/usr/bin/env bash
set -euo pipefail

# =============================
# Edit only these 4 variables
# =============================
PROJECT_ID="qr-ordering-489204"
REGION="asia-east1"
BACKEND_SERVICE="qr-backend"
FRONTEND_SERVICE="qr-frontend"

# Fixed learning repo name in Artifact Registry
REPO="qr-ordering"

if [[ "$PROJECT_ID" == "your-gcp-project-id" ]]; then
  echo "Please edit PROJECT_ID in deploy_gcp_learning.sh first."
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud is not installed."; exit 1; }

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "backend/ or frontend/ directory not found. Run this script from project root."
  exit 1
fi

echo "==> Set gcloud project and region"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null

echo "==> Enable required APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com >/dev/null

echo "==> Ensure Artifact Registry exists"
if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION"
fi

BACKEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$BACKEND_SERVICE:latest"
FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$FRONTEND_SERVICE:latest"

if [[ ! -f "$BACKEND_DIR/Dockerfile" ]]; then
  echo "==> Creating backend Dockerfile"
  cat > "$BACKEND_DIR/Dockerfile" <<'EOF'
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
EOF
fi

if [[ ! -f "$FRONTEND_DIR/Dockerfile" ]]; then
  echo "==> Creating frontend Dockerfile"
  cat > "$FRONTEND_DIR/Dockerfile" <<'EOF'
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["sh", "-c", "cat > /etc/nginx/conf.d/default.conf <<'EOF'\nserver {\n    listen       8080;\n    server_name  localhost;\n\n    location / {\n        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n        try_files $uri $uri/ /index.html;\n    }\n\n    error_page   500 502 503 504  /50x.html;\n    location = /50x.html {\n        root   /usr/share/nginx/html;\n    }\n}\nEOF\nnginx -g 'daemon off;'"]
EOF
fi

echo "==> Build backend image"
gcloud builds submit "$BACKEND_DIR" --tag "$BACKEND_IMAGE"

echo "==> Deploy backend service"
gcloud run deploy "$BACKEND_SERVICE" \
  --image "$BACKEND_IMAGE" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --format='value(status.url)')"
echo "Backend URL: $BACKEND_URL"

echo "==> Create temporary Cloud Build config for frontend"
TMP_FRONTEND_CB="$ROOT_DIR/.cloudbuild.frontend.yaml"
cat > "$TMP_FRONTEND_CB" <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '$FRONTEND_IMAGE'
      - '--build-arg'
      - 'VITE_API_URL=$BACKEND_URL'
      - '.'
images:
  - '$FRONTEND_IMAGE'
EOF

echo "==> Build frontend image"
gcloud builds submit "$FRONTEND_DIR" --config "$TMP_FRONTEND_CB"
rm -f "$TMP_FRONTEND_CB"

echo "==> Deploy frontend service"
gcloud run deploy "$FRONTEND_SERVICE" \
  --image "$FRONTEND_IMAGE" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --format='value(status.url)')"
echo "Frontend URL: $FRONTEND_URL"

echo "==> Optional: update backend FRONTEND_URL env"
gcloud run services update "$BACKEND_SERVICE" --update-env-vars="FRONTEND_URL=$FRONTEND_URL" >/dev/null

echo ""
echo "Done. Open your app:"
echo "$FRONTEND_URL"
echo ""
echo "Note (learning mode): SQLite on Cloud Run is not persistent across instance restarts."
