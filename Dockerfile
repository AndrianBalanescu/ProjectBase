FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates curl bash unzip python3 py3-pip

# Download official PocketBase binary
ARG PB_VERSION=0.39.11
RUN curl -sL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o pb.zip && \
    unzip -o pb.zip pocketbase && \
    chmod +x pocketbase && \
    rm pb.zip

COPY app /app/app
COPY scripts /app/scripts

EXPOSE 8120

VOLUME ["/app/app/pb_data"]

CMD ["/app/pocketbase", "serve", "--dir", "/app/app/pb_data", "--publicDir", "/app/app/pb_public", "--hooksDir", "/app/app/pb_hooks", "--migrationsDir", "/app/app/pb_migrations", "--http", "0.0.0.0:8120"]
