import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'APP_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'المسار المطلوب غير موجود.' });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({ error: error.message, code: error.code });
    return;
  }

  const bodyTooLarge = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large';
  if (bodyTooLarge) {
    response.status(413).json({ error: 'حجم الطلب أو الصور المرفقة أكبر من الحد المسموح.' });
    return;
  }

  console.error('Unhandled server error:', error);
  response.status(500).json({ error: 'حدث خطأ داخلي غير متوقع. حاول مرة أخرى.' });
};
