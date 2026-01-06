import "express";

declare global {
  namespace Express {
    namespace Multer {
      interface File {}
    }
    interface Request {
      file?: Multer.File;
      files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
    }
  }
}

export {};

