FROM node:20-alpine

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Change to npm run build at production
CMD ["npm", "run", "dev"]