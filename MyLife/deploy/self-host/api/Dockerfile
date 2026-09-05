FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

RUN addgroup -S app && adduser -S app -G app
USER app

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm", "run", "start"]
