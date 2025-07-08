import multer from 'multer';
import path from 'path';
import logger from '../utils/logger.util';
import fs from 'fs';
import { FileFilterCallback } from 'multer';
import { Request } from 'express';
const uploadDir = path.resolve('../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info(`Created upload directory at ${uploadDir}`);
}

const storage = multer.diskStorage({
  destination: (request, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (request, file, cb) => {
    cb(null, file.originalname);
  },
});

const fileFilter = (
  request: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',

    // PDFs
    'application/pdf',

    // Videos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/webm',
    'video/x-matroska',

    //Voice
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/m4a',
    'audio/webm',
    'audio/amr',
    'audio/3gpp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const errorMessage =
      'Unsupported file type. Only images, PDFs, and videos are allowed.';
    logger.error(errorMessage);
    cb(new Error(errorMessage) as unknown as null, false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter,
});

export default upload;
