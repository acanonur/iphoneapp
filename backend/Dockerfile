# The Yaver server, for running on a hosting service with a fixed address.
# From the project folder (the one that holds "backend"):
#   docker build -t yaver backend
#   docker run -p 8787:8787 -v yaver-data:/data --env-file backend/.env \
#     -e DB_PATH=/data/calls.db -e HOST=0.0.0.0 -e PORT=8787 yaver
# The three -e settings come last on purpose: a .env may still carry its own
# DB_PATH, and the data must end up on the volume.
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# The database lives in /data: attach a volume (a lasting disk) there, so
# tasks and the access key survive a restart. (Not declared with VOLUME: some
# hosting services refuse a Dockerfile that does, and attach theirs anyway.)
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DB_PATH=/data/calls.db \
    ADVERTISE=false
RUN mkdir -p /data
EXPOSE 8787

CMD ["npx", "tsx", "--disable-warning=ExperimentalWarning", "src/index.ts"]
