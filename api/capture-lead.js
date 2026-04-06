// api/capture-lead.js
import { BrevoClient } from './lib/brevo.js';
import { logEvent } from './lib/events.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const requestId = crypto.randomUUID();

  try {
    const { email, firstname, company, source } = req.body;
    if (!email || !firstname) return res.status(400).json({ error: 'Email and firstname required' });

    const brevo = new BrevoClient(process.env.BREVO_API_KEY);
    const cleanEmail = email.toLowerCase().trim();

    await brevo.upsertContact({
      email: cleanEmail,
      firstname,
      attributes: {
        FIRSTNAME: firstname,
        COMPANY: company || '',
        LEAD_SOURCE: source || 'index_page',
        CAPTURED_AT: new Date().toISOString(),
        ASSESSMENT_COMPLETED: 'false', // Not yet completed
        LEAD_TEMPERATURE: 'WARM' // Initial temperature
      },
      listIds: [parseInt(process.env.BREVO_LIST_ID)]
    });

    // Send welcome email with assessment link
    await brevo.sendTransactionalEmail({
      to: cleanEmail,
      toName: firstname,
      templateId: parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID),
      params: {
        FIRSTNAME: firstname,
        ASSESSMENT_LINK: `https://YOUR_DOMAIN.com/assessment.html?e=${encodeURIComponent(cleanEmail)}`,
        COMPANY: company || 'your company'
      }
    });

    await logEvent(requestId, 'LEAD_CAPTURED', { email: hashEmail(cleanEmail) });

    return res.status(200).json({
      success: true,
      requestId,
      capturedAt: new Date().toISOString()
    });

  } catch (error) {
    await logEvent(requestId, 'LEAD_CAPTURE_FAILED', { error: error.message });
    return res.status(500).json({ error: 'Failed to process', requestId });
  }
}

function hashEmail(email) {
  return email.split('@')[0].slice(0,2) + '***@' + email.split('@')[1];
}
