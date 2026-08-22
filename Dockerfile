FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates curl bash unzip python3 py3-pip

# Download official PocketBase binary
ARG PB_VERSION=0.39.11
RUN curl -sL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o pb.zip && \
    unzip -o pb.zip pocketbase && \
    chmod +x pocketbase && \
    rm pb.zip

COPY pb_hooks /app/pb_hooks
COPY pb_public /app/pb_public
COPY scripts /app/scripts

EXPOSE 8120

VOLUME ["/app/pb_data"]

CMD ["/app/pocketbase", "serve", "--dir", "/app/pb_data", "--publicDir", "/app/pb_public", "--hooksDir", "/app/pb_hooks", "--http", "0.0.0.0:8120"]
