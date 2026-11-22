// Vercel function for POST /api/chat; same relay as the local server.
import { chat } from '../lib/chat.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const [code, body] = await chat(req.body);
  res.status(code).json(body);
}
