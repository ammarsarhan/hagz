FROM node:20-alpine

WORKDIR /app

RUN mkdir -p /app && chown -R node:node /app

COPY --chown=node:node package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 8080

CMD npx prisma generate && npx prisma db push && npm run dev
