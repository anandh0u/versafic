// src/utils/queue.ts - Message Queue (Bull) utility
// NOTE: Bull dependency removed - queue functionality disabled
// import Queue from 'bull';
// import { logger } from './logger';
// import { sendWelcomeEmail, sendVerificationEmail } from './email';

// Create job queues
// export const emailQueue = new Queue('email', {
//   redis: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT || '6379'),
//     password: process.env.REDIS_PASSWORD,
//   },
//   defaultJobOptions: {
//     attempts: 3,
//     backoff: {
//       type: 'exponential',
//       delay: 2000,
//     },
//     removeOnComplete: true,
//   },
// });

// export const aiQueue = new Queue('ai', {
//   redis: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT || '6379'),
//     password: process.env.REDIS_PASSWORD,
//   },
//   defaultJobOptions: {
//     attempts: 2,
//     backoff: {
//       type: 'exponential',
//       delay: 1000,
//     },
//   },
// });

// Email queue processor
// emailQueue.process('welcome', async (job) => {
//   const { email, name } = job.data;
//   logger.info(`Processing welcome email for ${email}`);

//   try {
//     const result = await sendWelcomeEmail(email, name);
//     if (!result.success) {
//       throw new Error(result.error || 'Failed to send email');
//     }
//     return { success: true, email };
//   } catch (error) {
//     logger.error(`Failed to send welcome email to ${email}`, error as Error);
//     throw error;
//   }
// });

// emailQueue.process('verification', async (job) => {
//   const { email, name, verificationLink } = job.data;
//   logger.info(`Processing verification email for ${email}`);

//   try {
//     const result = await sendVerificationEmail(email, name, verificationLink);
//     if (!result.success) {
//       throw new Error(result.error || 'Failed to send email');
//     }
//     return { success: true, email };
//   } catch (error) {
//     logger.error(`Failed to send verification email to ${email}`, error as Error);
//     throw error;
//   }
// });

// AI queue processor (for heavy operations)
// aiQueue.process('generate-response', async (job) => {
//   const { userId, message, aiProvider } = job.data;
//   logger.info(`Processing AI response for user ${userId}`);

//   try {
//     // Simulate heavy AI processing
//     await new Promise(resolve => setTimeout(resolve, 1000));
//     return { success: true, userId, message };
//   } catch (error) {
//     logger.error(`Failed to generate AI response`, error as Error);
//         throw error;
//   }
// });

// Event listeners
// emailQueue.on('completed', (job) => {
//   logger.info(`Email job ${job.id} completed`);
// });

// emailQueue.on('failed', (job, err) => {
//   logger.error(`Email job ${job.id} failed: ${err.message}`);
// });

// aiQueue.on('completed', (job) => {
//   logger.info(`AI job ${job.id} completed`);
// });

// aiQueue.on('failed', (job, err) => {
//   logger.error(`AI job ${job.id} failed: ${err.message}`);
// });

// Helper to add jobs
// export const jobs = {
//   sendWelcomeEmail: (email: string, name: string) =>
//     emailQueue.add('welcome', { email, name }, { delay: 0 }),

//   sendVerificationEmail: (email: string, name: string, verificationLink: string) =>
//     emailQueue.add('verification', { email, name, verificationLink }, { delay: 0 }),

//   generateAIResponse: (userId: number, message: string, aiProvider: string) =>
//     aiQueue.add('generate-response', { userId, message, aiProvider }, { priority: 5 }),
// };

// export default emailQueue;
