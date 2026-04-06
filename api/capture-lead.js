// api/capture-lead.js
import { BrevoClient } from './lib/brevo.js';
import { logEvent } from './lib/events.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = crypto.randomUUID();
  
  // DEBUG: Log incoming request
  console.log(`[${requestId}] Received request:`, JSON.stringify(req.body));

  try {
    const { email, firstname, company, source } = req.body;
    
    if (!email || !firstname) {
      console.log(`[${requestId}] Validation failed: missing fields`);
      return res.status(400).json({ error: 'Email and firstname required' });
    }

    // DEBUG: Check env vars
    console.log(`[${requestId}] Env check:`, {
      hasApiKey: !!process.env.BREVO_API_KEY,
      apiKeyPrefix: process.env.BREVO_API_KEY?.substring(0, 10) + '...',
      listId: process.env.BREVO_LIST_ID,
      welcomeTemplateId: process.env.BREVO_WELCOME_TEMPLATE_ID
    });

    const brevo = new BrevoClient(process.env.BREVO_API_KEY);
    const cleanEmail = email.toLowerCase().trim();

    // DEBUG: Attempt contact creation
    console.log(`[${requestId}] Creating contact:`, cleanEmail);
    
    const contactResult = await brevo.upsertContact({
      email: cleanEmail,
      firstname,
      attributes: {
        FIRSTNAME: firstname,
        COMPANY: company || '',
        LEAD_SOURCE: source || 'index_page',
        CAPTURED_AT: new Date().toISOString(),
        ASSESSMENT_COMPLETED: 'false',
        LEAD_TEMPERATURE: 'WARM'
      },
      listIds: [parseInt(process.env.BREVO_LIST_ID)]
    });

    console.log(`[${requestId}] Contact result:`, contactResult);

    // DEBUG: Attempt email send
    console.log(`[${requestId}] Sending welcome email to:`, cleanEmail);
    
    const emailResult = await brevo.sendTransactionalEmail({
      to: cleanEmail,
      toName: firstname,
      templateId: parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID),
      params: {
        FIRSTNAME: firstname,
        ASSESSMENT_LINK: `https://vifscale.ighreenatech.com/assessment.html?e=${encodeURIComponent(cleanEmail)}`,
        COMPANY: company || 'your company'
      }
    });

    console.log(`[${requestId}] Email result:`, emailResult);

    await logEvent(requestId, 'LEAD_CAPTURED', { 
      email: hashEmail(cleanEmail),
      contactCreated: contactResult.success,
      emailSent: emailResult.success
    });

    return res.status(200).json({
      success: true,
      requestId,
      contactCreated: contactResult.success,
      emailSent: emailResult.success,
      capturedAt: new Date().toISOString()
    });

  } catch (error) {
    // DEBUG: Detailed error logging
    console.error(`[${requestId}] ERROR:`, {
      message: error.message,
      name: error.name,
      statusCode: error.statusCode,
      response: error.response,
      stack: error.stack
    });
    
    await logEvent(requestId, 'LEAD_CAPTURE_FAILED', { 
      error: error.message,
      statusCode: error.statusCode 
    });
    
    return res.status(500).json({ 
      error: 'Failed to process', 
      details: error.message,
      requestId 
    });
  }
}

function hashEmail(email) {
  return email.split('@')[0].slice(0,2) + '***@' + email.split('@')[1];
}
