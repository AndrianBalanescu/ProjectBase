FROM alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce

WORKDIR /app

RUN apk add --no-cache ca-certificates curl bash unzip python3 py3-pip

# Download official PocketBase binary
ARG PB_VERSION=0.39.11
ARG PB_SHA256=08b9fcda0d5fd42cb315dc15a36dfa121c993855bd635f01d347c31b4328ec34
RUN curl -sL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o pb.zip && \
    echo "${PB_SHA256}  pb.zip" | sha256sum -c - && \
    unzip -o pb.zip pocketbase && \
    chmod +x pocketbase && \
    rm pb.zip

COPY app /app/app
COPY scripts /app/scripts

# First-boot wrapper: on a fresh data dir, run migrations once, then restart
# the server so records are visible immediately (PB 0.39.x quirk where the
# first boot's records API is blind to migration-created collections).
RUN chmod +x /app/scripts/serve-firstboot.sh && \
    ln -sf /app/pocketbase /app/pb

EXPOSE 8120

VOLUME ["/app/app/pb_data"]

ENTRYPOINT ["/app/scripts/serve-firstboot.sh", "/app/app/pb_data", "/app/pb"]
CMD ["serve", "--dir", "/app/app/pb_data", "--publicDir", "/app/app/pb_public", "--hooksDir", "/app/app/pb_hooks", "--migrationsDir", "/app/app/pb_migrations", "--http", "0.0.0.0:8120"]
