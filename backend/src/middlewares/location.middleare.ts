import ipinfo, { IPinfoWrapper } from 'node-ipinfo';
import { Request } from 'express';
import axios from 'axios';
import logger from '../utils/logger.util';
import ApiError from '../utils/apiError.util';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const ipInfo = new IPinfoWrapper(process.env.IP_INFO_TOKEN!);
const locationDirectory = path.resolve('../locations');

const userGeoLocation = async (request: Request) => {
  if (!fs.existsSync(locationDirectory)) {
    fs.mkdirSync(locationDirectory, { recursive: true });
    logger.info(
      'info',
      `Location directory created successfully ${locationDirectory}`,
    );
  }
  try {
    const ip =
      (Array.isArray(request.headers['x-forwarded-for'])
        ? request.headers['x-forwarded-for'][0]
        : request.headers['x-forwarded-for']?.split(',')[0]) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip;

    if (!ip) {
      logger.error('Could not fetch user ip');
      throw new ApiError(404, 'Not able to fetch user ip');
    }

    const userIpInfo = await ipInfo.lookupIp(ip);

    const [lat, lon] = userIpInfo.loc
      ? userIpInfo.loc.split(',').map(Number)
      : [null, null];

    const responseData = {
      wholeIpInfo: userIpInfo,
      city: userIpInfo.city || '',
      coordinates: [lon, lat],
    };
    const coordinates = [lon, lat];

    const safeIp = ip.replace(/[:.]/g, '-');
    const fileName = `user-location-${safeIp}-${Date.now()}.json`;

    const filePath = path.join(locationDirectory, fileName);

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(responseData, null, 2),
    );

    logger.info('info', 'User location data uploaded successfully');

    console.log(responseData);
    return coordinates;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Ip info lookup failed', {
        message: error.message,
        stack: error.stack,
      });
      throw new ApiError(500, 'Ip info lookup failed');
    }
  }
};

const userReverseGeoCoding = async (coordinates: number) => {
  try {
    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      typeof coordinates[0] !== 'number' ||
      typeof coordinates[1] !== 'number'
    ) {
      logger.error('Invalid geolocation');
      throw new ApiError(404, 'Invalid geolocation');
    }

    const [longitude, latitude] = coordinates;

    const url = `https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json`;

    const { data } = await axios.get(url);

    return {
      address: data.display_name,
      city:
        data.address.city || data.address.town || data.address.village || '',
      state: data.address.state || '',
      country: data.address.country || '',
      raw: data,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Reverse geo coding failed', {
        message: error.message,
        stack: error.stack,
      });
      throw new ApiError(500, 'Not able to fetch user addresss');
    }
  }
};

export { userGeoLocation, userReverseGeoCoding };
