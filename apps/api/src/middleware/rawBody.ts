import { RequestHandler } from 'express';

/**
 * Capture raw body for Stripe signature verification.
 * This middleware must run BEFORE express.json().
 * 
 * Stripe webhooks require the raw request body to verify
 * the signature. Express's body parser converts the body
 * to a JavaScript object, which breaks signature verification.
 * 
 * Usage:
 * app.use(rawBody);
 * app.use(express.json());
 */
const rawBody: RequestHandler = (req, res, next) => {
  let data: Buffer[] = [];
  
  req.on('data', (chunk) => {
    data.push(chunk as Buffer);
  });
  
  req.on('end', () => {
    // Attach raw body to request object
    (req as any).rawBody = Buffer.concat(data);
    next();
  });
  
  req.on('error', (err) => {
    next(err);
  });
};

export default rawBody;

