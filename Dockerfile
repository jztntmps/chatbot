# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- run stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy everything built to a temp folder
COPY --from=build /app/dist /tmp/dist

# auto-detect where index.html is, then copy that folder to nginx html
RUN set -eux; \
    TARGET_DIR="$(find /tmp/dist -maxdepth 4 -type f -name index.html -print -quit | xargs -r dirname)"; \
    echo "Detected Angular build dir: ${TARGET_DIR}"; \
    test -n "${TARGET_DIR}"; \
    rm -rf /usr/share/nginx/html/*; \
    cp -r "${TARGET_DIR}/"* /usr/share/nginx/html/; \
    rm -rf /tmp/dist

EXPOSE 80