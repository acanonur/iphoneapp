# The Yaver server, for running on a hosting service with a fixed address.
#   docker build -t yaver backend && docker run -p 8787:8787 -v yaver-data:/data --env-file backend/.env yaver
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# The database lives on a volume, so tasks survive a restart.
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DB_PATH=/data/calls.db \
    ADVERTISE=false
VOLUME /data
EXPOSE 8787

CMD ["npx", "tsx", "src/index.ts"]
