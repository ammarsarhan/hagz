import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Use global variable in development to avoid creating new instances on hot reload
if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;

export const handlePrismaError = (error: Error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
        return `The provided value for field is too long for the field’s type. ${error.message}`;
      case 'P2001':
        return `The record to delete does not exist. ${error.message}`;
      case 'P2002':
        return `Unique constraint failed on the fields. ${error.message}`;
      case 'P2003':
        return `Attempting to create a record that references a non-existent record in another table. ${error.message}`;
      case 'P2004':
        return `The provided value for the field is not valid. ${error.message}`;
      case 'P2005':
        return `The provided value for a field is missing. ${error.message}`;
      case 'P2006':
        return `The database is not reachable (could be due to connection issues). ${error.message}`;
      case 'P2007':
        return `The query contains a validation error. ${error.message}`;
      case 'P2025':
        return `The record to update does not exist. ${error.message}`;
      default:
        return `An error occurred. ${error.message}`;
    }
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return `Unknown error occurred: ${error.message}`;
  } else {
    return `An unexpected error occurred: ${error.message}`;
  }
}
