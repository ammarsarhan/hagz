FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl openssl-dev postgresql-client

COPY package*.json ./

RUN npm install

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

RUN chmod +x start.sh

EXPOSE 8080

CMD ["sh", "./start.sh"]