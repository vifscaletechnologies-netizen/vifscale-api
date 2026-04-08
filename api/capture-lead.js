// api/capture-lead.js - Automation-friendly version

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = generateId();
  
  console.log('[' + requestId + '] Request started');

  try {
    const body = req.body || {};
    const email = body.email;
    const firstname = body.firstname;
    const company = body.company;
    const source = body.source;
    
    if (!email || !firstname) {
      return res.status(400).json({ error: 'Email and firstname required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = process.env.BREVO_LIST_ID;

    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not configured');
    }

    // Step 1: Create/Update Contact
    console.log('[' + requestId + '] Creating contact:', cleanEmail);
    
    const contactPayload = {
      email: cleanEmail,
      attributes: {
        FIRSTNAME: firstname,
        COMPANY: company || '',
        LEAD_SOURCE: source || 'index_page',
        CAPTURED_AT: new Date().toISOString(),
        ASSESSMENT_COMPLETED: 'false',
        LEAD_TEMPERATURE: 'WARM'
      },
      updateEnabled: true
    };

    let contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(contactPayload)
    });

    // If exists, update
    if (contactRes.status === 400) {
      contactRes = await fetch('https://api.brevo.com/v3/contacts/' + encodeURIComponent(cleanEmail), {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({ attributes: contactPayload.attributes })
      });
    }

    let contactSuccess = contactRes.status === 201 || contactRes.status === 204;
    console.log('[' + requestId + '] Contact result:', contactRes.status, contactSuccess);

    // Step 2: Add to list (triggers automation)
    if (BREVO_LIST_ID && contactSuccess) {
      console.log('[' + requestId + '] Adding to list:', BREVO_LIST_ID);
      
      const listRes = await fetch('https://api.brevo.com/v3/contacts/lists/' + parseInt(BREVO_LIST_ID) + '/contacts/add', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
          emails: [cleanEmail]
        })
      });

      console.log('[' + requestId + '] List add status:', listRes.status);
    }

    // Automation will send welcome email
    return res.status(200).json({
      success: true,
      requestId: requestId,
      message: 'Contact created. Welcome email will be sent by Brevo automation.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[' + requestId + '] ERROR:', error.message);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      requestId: requestId 
    });
  }
}
