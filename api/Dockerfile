FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

USER node

EXPOSE 8080

# Change to npm run build at production
CMD ["npm", "run", "dev"]