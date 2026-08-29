import { Router } from 'express';
import { hasManagedGeminiKey } from '../services/gemini';

const router = Router();

router.get('/gemini-auth', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    mode: hasManagedGeminiKey() ? 'managed' : 'user-required',
  });
});

export default router;
