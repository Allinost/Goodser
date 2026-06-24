FROM rust:slim-bookworm

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    inotify-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
