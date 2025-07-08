import sgMail from '@sendgrid/mail';
import logger from './logger.util';
import ApiError from './apiError.util';
import dotenv from 'dotenv';
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface sendMailOption {
  to: string;
  templateId: string;
  dynamicTemplateData: Record<string, any>;
}

const sendMail = async ({
  to,
  templateId,
  dynamicTemplateData,
}: sendMailOption) => {
  const message = {
    to,
    from: 'harxhit13@gmail.com',
    templateId,
    dynamic_template_data: dynamicTemplateData,
  };

  try {
    await sgMail.send(message);
    logger.info('Email sent', message);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error sending mail', {
        message: error.message,
        stack: error.stack,
      });
      throw new ApiError(500, 'Error sending mail');
    }
  }
};

export default sendMail;
