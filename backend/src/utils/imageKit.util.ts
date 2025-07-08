import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import fs from 'fs';
import logger from './logger.util';
import ApiError from './apiError.util';

dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY as any,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY as any,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as any,
});

// console.log(imagekit);

// Upload to ImageKit from local file
const uploadToImageKit = async (
  localFilePath: string,
  originalName: string,
) => {
  try {
    const fileBuffer = fs.readFileSync(localFilePath);

    const result = await imagekit.upload({
      file: fileBuffer,
      fileName: originalName,
      useUniqueFileName: true,
    });

    logger.info(`Uploaded to ImageKit: ${result.url}`);
    return result;
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(`ImageKit Upload Error: ${err.message}`);
      throw new ApiError(404, 'Imagekit Upload error');
    }
  }
};

// Delete local file after upload
const deleteLocalFile = (filePath: string) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(`Failed to delete local file ${filePath}: ${err.message}`);
    } else {
      logger.info(`Deleted local file: ${filePath}`);
    }
  });
};

export { uploadToImageKit, deleteLocalFile };
