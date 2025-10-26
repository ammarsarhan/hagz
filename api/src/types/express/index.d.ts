import { AccessTokenPayload } from "@/utils/token";
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    // This merges with the existing Express.Request type
    export interface Request {
      user?: AccessTokenPayload;
    }
  }
}
