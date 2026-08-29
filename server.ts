import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp, errorHandler } from './server/app';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));
  }

  app.use(errorHandler);
  app.listen(port, '0.0.0.0', () => console.warn(`Prompt Maker is running on port ${port}`));
}

void startServer();
