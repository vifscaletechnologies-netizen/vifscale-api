
import { BrevoClient } from './lib/brevo.js';

export default async function handler(req, res) {
  const checks = {
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: {
      node_env: process.env.NODE_ENV,
      vercel_region: process.env.VERCEL_REGION
    }
  };

  // Check Brevo connectivity
  try {
    const brevo = new BrevoClient(process.env.BREVO_API_KEY, { retries: 1 });
    // Lightweight check: get account info
    const accountResponse = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    });
    
    checks.brevo = {
      ok: accountResponse.ok,
      status: accountResponse.status
    };
  } catch (error) {
    checks.brevo = {
      ok: false,
      error: error.message
    };
  }

  // Check required env vars
  const required = ['BREVO_API_KEY', 'BREVO_LIST_ID'];
  const missing = required.filter(v => !process.env[v]);
  
  checks.config = {
    all_present: missing.length === 0,
    missing_vars: missing
  };

  const healthy = checks.brevo.ok && checks.config.all_present;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks
  });
}
