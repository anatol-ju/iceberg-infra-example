#!/bin/bash
set -euo pipefail

STAGE="${1:-dev}"  # default to dev if not passed
REGION="${REGION:-eu-west-1}"
ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
PROFILE="${AWS_PROFILE:-mysense-dev}"
REPO_NAME="lambdas-iceberg-table-access-${STAGE}"
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

echo "[build_images] Stage: ${STAGE}, Region: ${REGION}, Account ID: ${ACCOUNT_ID}."

echo "[build_images] Starting SSH agent."
eval "$(ssh-agent -s)"
if [ -f ~/.ssh/id_rsa ]; then ssh-add ~/.ssh/id_rsa; fi
if [ -f ~/.ssh/id_ed25519 ]; then ssh-add ~/.ssh/id_ed25519; fi

echo "[build_images] Parsing Docker Compose file for lambda services."
LAMBDA_SERVICES=$(yq e '.services | keys | .[]' docker-compose.yaml | grep '^lambda_')
if [[ -z "$LAMBDA_SERVICES" ]]; then
  echo "[build_images] No lambda services found."
  exit 1
fi

echo "[build_images] Logging into AWS ECR."
aws ecr get-login-password --region "$REGION" --profile "$PROFILE" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

for SERVICE in $LAMBDA_SERVICES; do
  PROJECT_DIR=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]')
  IMAGE_NAME="${PROJECT_DIR}-${SERVICE}"
  CONTAINER_NAME=$(yq e ".services.${SERVICE}.container_name" docker-compose.yaml)

  echo "[build_images] Processing $SERVICE."
  echo "[build_images] Ensuring ECR repository $REPO_NAME exists..."
  if ! aws ecr describe-repositories --profile "$PROFILE" --repository-names "$REPO_NAME" > /dev/null 2>&1; then
    aws ecr create-repository --region "$REGION" --profile "$PROFILE" --repository-name "$REPO_NAME"
    # Set lifecycle policy to retain only the 10 most recent images
    aws ecr put-lifecycle-policy --region "$REGION" --profile "$PROFILE" --repository-name "$REPO_NAME" --lifecycle-policy-text "$(cat <<EOF
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Retain only the 10 most recent images",
      "selection": {
        "tagStatus": "any",
        "tagPrefixList": ["${CONTAINER_NAME}-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
EOF
)"
  fi

  echo "[build_images] Generating image tag based on combined checksum of code, Dockerfile and Poetry lock file."
  HANDLER=$(yq e ".services.${SERVICE}.build.args.HANDLER" docker-compose.yaml)
  HANDLER_FILE=$(echo "$HANDLER" | cut -d '.' -f1)
  BUILD_CONTEXT=$(yq e ".services.${SERVICE}.build.context" docker-compose.yaml)
  LAMBDA_FILE="${BUILD_CONTEXT}/${HANDLER_FILE}.py"
  DOCKERFILE="./lambda.Dockerfile"
  LOCK_FILE="${BUILD_CONTEXT}/poetry.lock"

  HANDLER_CHECKSUM=$(shasum -a 256 "$LAMBDA_FILE" | awk '{print $1}')
  DOCKERFILE_CHECKSUM=$(shasum -a 256 "$DOCKERFILE" | awk '{print $1}')
  LOCK_FILE_CHECKSUM=$(shasum -a 256 "$LOCK_FILE" | awk '{print $1}')
  COMBINED_CHECKSUM=$(echo "${HANDLER_CHECKSUM}${DOCKERFILE_CHECKSUM}${LOCK_FILE_CHECKSUM}" | shasum -a 256 | awk '{print $1}')
  IMAGE_TAG="${CONTAINER_NAME}-${COMBINED_CHECKSUM:0:12}"

  echo "[build_images] Checking if the image already exists in ECR."

  DIGEST_FILE="./build/${SERVICE}_digest.txt"
  if [[ -f "$DIGEST_FILE" ]]; then
    IMAGE_INFO=$(aws ecr describe-images \
      --repository-name "$REPO_NAME" \
      --image-ids imageTag="${IMAGE_TAG}" \
      --region "$REGION" \
      --profile "$PROFILE" 2>/dev/null || true)

    if [[ -n "$IMAGE_INFO" ]]; then
      PUSHED_AT=$(echo "$IMAGE_INFO" | jq -r '.imageDetails[0].imagePushedAt')
      echo "[build_images] Image ${IMAGE_TAG} already exists in ECR and digest file found. Pushed at: ${PUSHED_AT}"
    else
      IMAGE_INFO=""
    fi
  fi

  if [[ -z "$IMAGE_INFO" ]]; then
    echo "[build_images] Image ${IMAGE_TAG} or digest file not found. Building image."
    DOCKER_BUILDKIT=1 docker compose -f docker-compose.yaml build "$SERVICE"

    echo "[build_images] Tagging and pushing image."
    docker tag "${IMAGE_NAME}" "${ECR_URL}:${IMAGE_TAG}"
    docker push "${ECR_URL}:${IMAGE_TAG}"

    mkdir -p ./build
    echo "${IMAGE_TAG}" > "$DIGEST_FILE"

    echo "[build_images] Image for $SERVICE pushed to ${ECR_URL}:${IMAGE_TAG}."
  fi

  echo "[build_images] All lambda images have been pushed."

done
