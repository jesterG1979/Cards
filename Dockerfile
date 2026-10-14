FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build && chown -R node:node /app/.next

ENV NODE_ENV=production
ENV PORT=38471
# One OpenMP thread per Tesseract process.
ENV OMP_THREAD_LIMIT=1
EXPOSE 38471
# Uploaded photos are decoded by sharp and Tesseract; don't do that as root.
# uid 1000 is the "node" user in the official image.
USER 1000:1000
CMD ["npm", "start"]
