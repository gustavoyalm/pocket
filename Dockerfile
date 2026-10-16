# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-pocket-config.sh /docker-entrypoint.d/40-pocket-config.sh
RUN chmod +x /docker-entrypoint.d/40-pocket-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
