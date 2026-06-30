# Stage 1: builder
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    HUSKY=0 npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: production
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
