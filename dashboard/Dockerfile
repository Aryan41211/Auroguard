# syntax=docker/dockerfile:1

# ---- build stage: typecheck + production bundle ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# The dashboard links out to the browser simulator, so its public URL is baked
# into the bundle at build time.
ARG VITE_SIMULATOR_URL=http://localhost:5173
ENV VITE_SIMULATOR_URL=$VITE_SIMULATOR_URL

RUN npm run build

# ---- runtime stage: static files behind nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
