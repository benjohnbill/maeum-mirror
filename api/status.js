// Vercel function for GET /api/status.
import { status } from '../lib/chat.mjs';

export default function handler(req, res) {
  res.status(200).json(status());
}
