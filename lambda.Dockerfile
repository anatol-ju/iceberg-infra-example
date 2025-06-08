# syntax=docker/dockerfile:1.7

ARG BUILDER_IMAGE="public.ecr.aws/lambda/python:3.9"
ARG FINAL_IMAGE="public.ecr.aws/lambda/python:3.9"

# ---------- Stage 1: builder ----------
# Use the Amazon Linux 2 image as the base image for Python 3.9.
# When going to later versions of Python, you may need to update the base image.
# Also, later amazonlinux images support installing Python dependencies as 64bit.
# FROM amazonlinux:2023 AS builder
FROM ${BUILDER_IMAGE} AS builder

ARG PYTHON_VERSION=3.12

RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    make \
    wget \
    zlib-devel \
    readline-devel \
    sqlite-devel \
    openssl-devel \
    libffi-devel \
    xz-devel \
    git \
    zip \
    which \
    tar \
    findutils \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-pip \
    python${PYTHON_VERSION}-devel && \
    yum clean all && \
    rm -rf /var/cache/yum

WORKDIR /opt/app

SHELL ["/bin/bash", "-c"]

# Setup SSH forwarding for private packages, if required
RUN mkdir -m 700 -p ~/.ssh
RUN --mount=type=ssh ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN chmod 644 ~/.ssh/known_hosts

# This will fail if SSH forwarding doesn't work, but ignore success message
RUN --mount=type=ssh ssh -T git@github.com 2>&1 | tee /tmp/ssh_output.log && \
    grep -q "successfully authenticated" /tmp/ssh_output.log || { echo "SSH connection failed"; cat /tmp/ssh_output.log; exit 1; }

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/etc/poetry python3 -
ENV PATH="/etc/poetry/bin:$PATH"

# Configure Poetry
RUN poetry config virtualenvs.in-project true && \
    poetry config virtualenvs.create true && \
    poetry config system-git-client true

# Only copy the files needed for poetry install
COPY pyproject.toml poetry.lock ./

RUN --mount=type=ssh poetry env use ${PYTHON_VERSION} && poetry install -v --no-root

# Copy Python packages from .venv to the python directory
# Preserve structure: python/lib/python3.x/site-packages/...
RUN mkdir -p -m 700 python && \
    cp -r .venv/lib python/ && \
    cp -r .venv/lib64 python/ || true

# Now copy all files into the image
COPY *.py .

# ---------- Stage 2: final lambda image ----------
FROM ${FINAL_IMAGE}

# Only use Python files and dependencies in the production image
COPY --from=builder /opt/app/python ${LAMBDA_TASK_ROOT}/python
COPY --from=builder /opt/app/*.py ${LAMBDA_TASK_ROOT}/

WORKDIR ${LAMBDA_TASK_ROOT}

ARG HANDLER=lambda.handler
ENV HANDLER=${HANDLER}

ENTRYPOINT ["/bin/bash", "-c", "/lambda-entrypoint.sh \"$HANDLER\""]
