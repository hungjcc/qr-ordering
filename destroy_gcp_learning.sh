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

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ "$PROJECT_ID" == "your-gcp-project-id" ]]; then
  echo "Please edit PROJECT_ID in destroy_gcp_learning.sh first."
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || { echo "gcloud is not installed."; exit 1; }

gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Deleting Cloud Run services (if they exist)"
if gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] Would delete Cloud Run service: $BACKEND_SERVICE"
  else
    gcloud run services delete "$BACKEND_SERVICE" --region="$REGION" --quiet
  fi
else
  echo "Backend service '$BACKEND_SERVICE' not found, skip."
fi

if gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] Would delete Cloud Run service: $FRONTEND_SERVICE"
  else
    gcloud run services delete "$FRONTEND_SERVICE" --region="$REGION" --quiet
  fi
else
  echo "Frontend service '$FRONTEND_SERVICE' not found, skip."
fi

echo "==> Cleaning Artifact Registry images"
BACKEND_IMAGE_PATH="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$BACKEND_SERVICE"
FRONTEND_IMAGE_PATH="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$FRONTEND_SERVICE"

# Delete all digests under backend image path (if any)
if gcloud artifacts docker images list "$BACKEND_IMAGE_PATH" --include-tags --format='value(version)' >/dev/null 2>&1; then
  while IFS= read -r version; do
    [[ -z "$version" ]] && continue
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] Would delete backend image digest: $BACKEND_IMAGE_PATH@$version"
    else
      gcloud artifacts docker images delete "$BACKEND_IMAGE_PATH@$version" --quiet --delete-tags || true
    fi
  done < <(gcloud artifacts docker images list "$BACKEND_IMAGE_PATH" --include-tags --format='value(version)')
else
  echo "No backend images found, skip."
fi

# Delete all digests under frontend image path (if any)
if gcloud artifacts docker images list "$FRONTEND_IMAGE_PATH" --include-tags --format='value(version)' >/dev/null 2>&1; then
  while IFS= read -r version; do
    [[ -z "$version" ]] && continue
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] Would delete frontend image digest: $FRONTEND_IMAGE_PATH@$version"
    else
      gcloud artifacts docker images delete "$FRONTEND_IMAGE_PATH@$version" --quiet --delete-tags || true
    fi
  done < <(gcloud artifacts docker images list "$FRONTEND_IMAGE_PATH" --include-tags --format='value(version)')
else
  echo "No frontend images found, skip."
fi

echo ""
echo "Done. Learning resources cleaned:"
echo "- Cloud Run: $BACKEND_SERVICE, $FRONTEND_SERVICE"
echo "- Artifact Registry images under repo: $REPO"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "- Mode: dry-run (no resources were deleted)"
fi
