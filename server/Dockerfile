# Repository root: docker build -f server/Dockerfile .
FROM node:22-alpine
WORKDIR /repo

COPY keeperapi ./keeperapi
COPY KeeperSdk ./KeeperSdk
COPY server ./server

RUN cd keeperapi && npm ci && npm run build
RUN cd KeeperSdk && npm ci && npm run build

WORKDIR /repo/server
# No package-lock required in repo; use install then prune devDeps after compile
RUN npm install && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3042
ENV HOST=0.0.0.0

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3042
CMD ["node", "dist/server.js"]
