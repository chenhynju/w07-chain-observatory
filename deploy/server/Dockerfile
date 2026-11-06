FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ponder.config.ts ponder.schema.ts ponder-env.d.ts ./
COPY src ./src

EXPOSE 42069
CMD ["node_modules/.bin/ponder", "start", "--hostname", "0.0.0.0", "--port", "42069"]
