FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV PORT=38471
EXPOSE 38471
CMD ["npm", "start"]
