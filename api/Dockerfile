FROM node:20-alpine

WORKDIR /app

RUN chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./

RUN npm install

EXPOSE 8080

CMD sh -c "npm run dev"
