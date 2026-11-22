import type { Request, Response } from 'express';
import { app } from '../backend/server.ts';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
