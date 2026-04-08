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

  // Declare requestId HERE so it's available in catch block
  const requestId = generateId();
  
  console.log('[' + requestId + '] Request started');
  console.log('[' + requestId + '] Body:', JSON.stringify(req.body));

  try {
    const body = req.body || {};
    const email = body.email;
    const firstname = body.firstname;
    const company = body.company;
    const source = body.source;
    
    if (!email || !firstname) {
      console.log('[' + requestId + '] Missing fields');
      return res.status(400).json({ error: 'Email and firstname required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = process.env.BREVO_LIST_ID;
    const WELCOME_TEMPLATE_ID = process.env.BREVO_WELCOME_TEMPLATE_ID;

    console.log('[' + requestId + '] Env check:', {
      hasApiKey: !!BREVO_API_KEY,
      apiKeyLength: BREVO_API_KEY ? BREVO_API_KEY.length : 0,
      listId: BREVO_LIST_ID,
      templateId: WELCOME_TEMPLATE_ID
    });

    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not configured');
    }

    // Step 1: Create/Update Contact
    console.log('[' + requestId + '] Creating contact for:', cleanEmail);
    
    const contactPayload = {
      email: cleanEmail,
      attributes: {
        FIRSTNAME: firstname,
        COMPANY: company || '',
        LEAD_SOURCE: source || 'index_page',
        CAPTURED_AT: new Date().toISOString(),
        ASSESSMENT_COMPLETED: 'false'
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

    // If contact exists (400), update via PUT
    if (contactRes.status === 400) {
      console.log('[' + requestId + '] Contact exists, updating...');
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

    // Parse contact result
    let contactResult = { success: false, status: contactRes.status };
    
    if (contactRes.status === 201) {
      const data = await contactRes.json();
      contactResult = { success: true, id: data.id, status: 201, created: true };
      console.log('[' + requestId + '] Contact created:', data.id);
    } else if (contactRes.status === 204) {
      contactResult = { success: true, updated: true, status: 204 };
      console.log('[' + requestId + '] Contact updated');
    } else {
      const errorText = await contactRes.text();
      contactResult = { success: false, error: errorText, status: contactRes.status };
      console.error('[' + requestId + '] Contact error:', contactRes.status, errorText);
    }

    // Step 2: Add to list
    if (BREVO_LIST_ID && contactResult.success) {
      console.log('[' + requestId + '] Adding to list:', BREVO_LIST_ID);
      
      const listRes = await fetch('https://api.brevo.com/v3/contacts/lists/add', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
          emails: [cleanEmail],
          listIds: [parseInt(BREVO_LIST_ID)]
        })
      });

      console.log('[' + requestId + '] List add status:', listRes.status);
      
      if (!listRes.ok && listRes.status !== 204) {
        const listError = await listRes.text();
        console.error('[' + requestId + '] List add failed:', listError);
      }
    }

    // Step 3: Send welcome email
    let emailResult = { success: false, skipped: true };
    
    if (WELCOME_TEMPLATE_ID && contactResult.success) {
      console.log('[' + requestId + '] Sending email with template:', WELCOME_TEMPLATE_ID);
      
      const emailPayload = {
        to: [{ email: cleanEmail, name: firstname }],
        templateId: parseInt(WELCOME_TEMPLATE_ID),
        params: {
          FIRSTNAME: firstname,
          ASSESSMENT_LINK: 'https://vifscale.ighreenatech.com/assessment.html?e=' + encodeURIComponent(cleanEmail),
          COMPANY: company || 'your company'
        }
      };

      let emailRes;
      try {
        emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': BREVO_API_KEY
          },
          body: JSON.stringify(emailPayload)
        });
      } catch (fetchError) {
        console.error('[' + requestId + '] Fetch error (email):', fetchError.message);
        emailResult.error = fetchError.message;
        emailRes = { ok: false, status: 0 };
      }

      if (emailRes.ok) {
        const data = await emailRes.json();
        emailResult = { success: true, messageId: data.messageId, status: emailRes.status };
        console.log('[' + requestId + '] Email sent:', data.messageId);
      } else {
        const errorText = emailRes.status ? await emailRes.text() : 'Network error';
        console.error('[' + requestId + '] Email failed:', emailRes.status, errorText);
        emailResult.error = errorText;
        emailResult.status = emailRes.status;
      }
    } else {
      console.log('[' + requestId + '] Skipping email - no template or contact failed');
    }

    // Return response
    return res.status(200).json({
      success: contactResult.success,
      requestId: requestId,
      contact: contactResult,
      email: emailResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // requestId is now in scope here!
    console.error('[' + requestId + '] FATAL ERROR:', error.message);
    console.error('[' + requestId + '] Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      requestId: requestId 
    });
  }
}
