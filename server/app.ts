import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './lib/http';
import dailyAdviceRouter from './routes/dailyAdvice';
import generateVisualRouter from './routes/generateVisual';
import optimizePromptRouter from './routes/optimizePrompt';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createApp() {
  const app = express();
  const bodyLimit = `${positiveInteger(process.env.MAX_REQUEST_BODY_MB, 15)}mb`;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(express.json({ limit: bodyLimit }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: positiveInteger(process.env.API_RATE_LIMIT_PER_MINUTE, 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'طلبات كثيرة جدًا خلال دقيقة واحدة. انتظر قليلًا ثم حاول مجددًا.' },
  }));
  app.use('/api', optimizePromptRouter, generateVisualRouter, dailyAdviceRouter);
  app.use('/api', notFoundHandler);

  return app;
}

export { errorHandler };
