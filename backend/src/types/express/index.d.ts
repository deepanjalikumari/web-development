import 'express';
import { UserDocument } from '../../models/user.models';
import { ListingDocument } from '../../models/listing.models';
declare module 'express' {
  export interface Request {
    user?: UserDocument;
    file?: Express.Multer.File;
    files?:
      | { [fieldname: string]: Express.Multer.File[] }
      | Express.Multer.File[];
  }
}
declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;

    MONGO_DB_URL: string;
    DATABASE_NAME: string;

    IMAGEKIT_PUBLIC_KEY: string;
    IMAGEKIT_PRIVATE_KEY: string;
    IMAGEKIT_URL_ENDPOINT: string;

    JWT_SECRET: string;
    JWT_REFRESH_TOKEN_EXPIRES: string | number | undefined;
    JWT_ACCESS_TOKEN_EXPIRES: string | number | undefined;

    SENDGRID_API_KEY: string;

    IP_INFO_TOKEN: string;
    LOCATIONIQ_API_KEY: string;
  }
}
