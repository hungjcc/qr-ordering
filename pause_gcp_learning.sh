#!/usr/bin/env bash
set -euo pipefail

# =============================
# Edit only these 4 variables
# =============================
PROJECT_ID="qr-ordering-489204"
REGION="asia-east1"
BACKEND_SERVICE="qr-backend"
FRONTEND_SERVICE="qr-frontend"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ "$PROJECT_ID" == "your-gcp-project-id" ]]; then
  echo "Please edit PROJECT_ID in pause_gcp_learning.sh first."
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud is not installed."; exit 1; }

gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Pause mode: delete Cloud Run services only (keep images)"

for service in "$BACKEND_SERVICE" "$FRONTEND_SERVICE"; do
  if gcloud run services describe "$service" --region="$REGION" >/dev/null 2>&1; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] Would delete Cloud Run service: $service"
    else
      gcloud run services delete "$service" --region="$REGION" --quiet
      echo "Deleted Cloud Run service: $service"
    fi
  else
    echo "Service '$service' not found, skip."
  fi
done

echo
echo "Done. Pause mode summary:"
echo "- Cloud Run services targeted: $BACKEND_SERVICE, $FRONTEND_SERVICE"
echo "- Artifact Registry images: kept"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "- Mode: dry-run (no resources were deleted)"
fi
