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
  echo "Please edit PROJECT_ID in resume_gcp_learning.sh first."
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud is not installed."; exit 1; }

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null

BACKEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$BACKEND_SERVICE:latest"
FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$FRONTEND_SERVICE:latest"

echo "==> Check if latest images exist"
gcloud artifacts docker images describe "$BACKEND_IMAGE" >/dev/null 2>&1 || {
  echo "Backend image not found: $BACKEND_IMAGE"
  echo "Please run ./deploy_gcp_learning.sh first."
  exit 1
}

gcloud artifacts docker images describe "$FRONTEND_IMAGE" >/dev/null 2>&1 || {
  echo "Frontend image not found: $FRONTEND_IMAGE"
  echo "Please run ./deploy_gcp_learning.sh first."
  exit 1
}

echo "==> Resume backend service from existing image"
gcloud run deploy "$BACKEND_SERVICE" \
  --image "$BACKEND_IMAGE" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --format='value(status.url)')"
echo "Backend URL: $BACKEND_URL"

echo "==> Resume frontend service from existing image"
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

echo
echo "Done. Services resumed from existing images:"
echo "- $BACKEND_SERVICE"
echo "- $FRONTEND_SERVICE"
echo
echo "Open app: $FRONTEND_URL"
