#!/usr/bin/env bash
set -u

PROJECT_ID="qr-ordering-489204"
REGION="asia-east1"
BACKEND_SERVICE="qr-backend"
FRONTEND_SERVICE="qr-frontend"
REPO="qr-ordering"

echo "===== GCP Health Check ====="
echo "Project: $PROJECT_ID | Region: $REGION"
echo

echo "1) gcloud auth + config"
gcloud auth list
echo "Active project: $(gcloud config get-value project 2>/dev/null)"
echo

echo "2) Cloud Run services"
gcloud run services list --region="$REGION"
echo
echo "Backend URL:  $(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || echo N/A)"
echo "Frontend URL: $(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || echo N/A)"
echo

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)"
FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)"

echo "3) Live endpoint checks"
if [[ -n "$BACKEND_URL" ]]; then
  echo -n "Backend /api/health HTTP: "
  curl -sS -o /tmp/backend_health.json -w '%{http_code}\n' "$BACKEND_URL/api/health" || echo "curl-failed"
  echo "Backend /api/health body:"
  cat /tmp/backend_health.json 2>/dev/null || true
  echo
  echo -n "Backend /api/menu HTTP:   "
  curl -sS -o /dev/null -w '%{http_code}\n' "$BACKEND_URL/api/menu" || echo "curl-failed"
else
  echo "Backend service URL not found."
fi

if [[ -n "$FRONTEND_URL" ]]; then
  echo -n "Frontend / HTTP:          "
  curl -sS -o /dev/null -w '%{http_code}\n' "$FRONTEND_URL/" || echo "curl-failed"
  echo -n "Frontend /admin HTTP:     "
  curl -sS -o /dev/null -w '%{http_code}\n' "$FRONTEND_URL/admin" || echo "curl-failed"
else
  echo "Frontend service URL not found."
fi
echo

echo "4) Artifact Registry"
gcloud artifacts repositories list --location="$REGION"
echo
gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO" --include-tags --format='table(IMAGE,TAGS,DIGEST,CREATE_TIME)' | head -n 20
echo

echo "5) Cloud Build (recent)"
gcloud builds list --limit=5 --format='table(id,status,createTime,images)'
echo

echo "6) Last frontend/backend logs (10 lines each)"
echo "--- frontend ---"
gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$FRONTEND_SERVICE\"" --limit=10 --format='value(textPayload)'
echo "--- backend ---"
gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$BACKEND_SERVICE\"" --limit=10 --format='value(textPayload)'

echo
echo "===== Health Check Complete ====="
