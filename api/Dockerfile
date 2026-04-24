FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system deps (needed for Prisma + native modules)
RUN apk add --no-cache openssl libc6-compat

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema first (important for caching + generate step)
COPY prisma ./prisma

# Generate Prisma Client (safe even before full copy)
RUN npx prisma generate

# Copy rest of the code
COPY . .

# Expose API port
EXPOSE 8080

# Start dev server (with Prisma safety)
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run dev"]
