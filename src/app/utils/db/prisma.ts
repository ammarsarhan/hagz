import { PrismaClient } from '@prisma/client';

let Prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  Prisma = new PrismaClient();
} else {
  // In development, make sure to avoid exhausting your database connections
  // by creating a new instance for every hot reload.
  if (!global.Prisma) {
    global.Prisma = new PrismaClient();
  }
  Prisma = global.Prisma;
}

export default Prisma;