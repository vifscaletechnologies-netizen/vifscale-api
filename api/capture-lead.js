// api/capture-lead.js - Compatible with all Node.js versions

// Generate simple request ID without crypto
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
  
  // Basic logging
  console.log(`[${requestId}] Request started`);
  console.log(`[${requestId}] Method: ${req.method}`);
  console.log(`[${requestId}] Body:`, JSON.stringify(req.body));

  try {
    const { email, firstname, company, source } = req.body || {};
    
    if (!email || !firstname) {
      console.log(`[${requestId}] Missing fields`);
      return res.status(400).json({ error: 'Email and firstname required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Check environment variables
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = process.env.BREVO_LIST_ID;
    const WELCOME_TEMPLATE_ID = process.env.BREVO_WELCOME_TEMPLATE_ID;

    console.log(`[${requestId}] Env check:`, {
      hasApiKey: !!BREVO_API_KEY,
      apiKeyLength: BREVO_API_KEY?.length,
      listId: BREVO_LIST_ID,
      templateId: WELCOME_TEMPLATE_ID
    });

    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not configured');
    }

    // Step 1: Create contact in Brevo
    console.log(`[${requestId}] Creating contact for: ${cleanEmail}`);
    
    const contactPayload = {
      email: cleanEmail,
      attributes: {
        FIRSTNAME: firstname,
        COMPANY: company || '',
        LEAD_SOURCE: source || 'index_page',
        CAPTURED_AT: new Date().toISOString(),
        ASSESSMENT_COMPLETED: 'false'
      },
      listIds: BREVO_LIST_ID ? [parseInt(BREVO_LIST_ID)] : [],
      updateEnabled: true
    };

    console.log(`[${requestId}] Contact payload:`, JSON.stringify(contactPayload));

    let contactRes;
    try {
      contactRes = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify(contactPayload)
      });
    } catch (fetchError) {
      console.error(`[${requestId}] Fetch error (contact):`, fetchError.message);
      throw new Error(`Network error contacting Brevo: ${fetchError.message}`);
    }

    console.log(`[${requestId}] Contact response status:`, contactRes.status);

    let contactResult = { success: false, status: contactRes.status };
    
    if (contactRes.status === 201) {
      const data = await contactRes.json();
      contactResult = { success: true, id: data.id, status: 201 };
      console.log(`[${requestId}] Contact created:`, data.id);
    } else if (contactRes.status === 204) {
      contactResult = { success: true, updated: true, status: 204 };
      console.log(`[${requestId}] Contact updated`);
    } else {
      const errorText = await contactRes.text();
      console.error(`[${requestId}] Contact error:`, contactRes.status, errorText);
      contactResult.error = errorText;
      // Continue anyway - don't fail the whole request
    }

    // Step 2: Send email (only if template ID exists)
    let emailResult = { success: false, skipped: true };
    
    if (WELCOME_TEMPLATE_ID) {
      console.log(`[${requestId}] Sending email with template:`, WELCOME_TEMPLATE_ID);
      
      const emailPayload = {
        to: [{ email: cleanEmail, name: firstname }],
        templateId: parseInt(WELCOME_TEMPLATE_ID),
        params: {
          FIRSTNAME: firstname,
          ASSESSMENT_LINK: `https://vifscale.ighreenatech.com/assessment.html?e=${encodeURIComponent(cleanEmail)}`,
          COMPANY: company || 'your company'
        }
      };

      console.log(`[${requestId}] Email payload:`, JSON.stringify(emailPayload));

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
        console.error(`[${requestId}] Fetch error (email):`, fetchError.message);
        emailResult.error = fetchError.message;
        emailRes = { status: 0, ok: false };
      }

      emailResult.status = emailRes.status;
      
      if (emailRes.ok) {
        const data = await emailRes.json();
        emailResult = { success: true, messageId: data.messageId, status: emailRes.status };
        console.log(`[${requestId}] Email sent:`, data.messageId);
      } else {
        const errorText = emailRes.status ? await emailRes.text() : 'Network error';
        console.error(`[${requestId}] Email failed:`, emailRes.status, errorText);
        emailResult.error = errorText;
      }
    } else {
      console.log(`[${requestId}] No welcome template ID - skipping email`);
    }

    // Return success even if email failed (contact is what matters most)
    return res.status(200).json({
      success: contactResult.success,
      requestId,
      contact: contactResult,
      email: emailResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${requestId}] FATAL ERROR:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      requestId 
    });
  }
}
