import { Request } from 'express';
import { TokenDataType } from './token';

declare module 'express' {
  export interface Request {
    user?: TokenDataType;
  }
}