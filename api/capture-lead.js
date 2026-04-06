export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Starting capture for:`, req.body?.email);

  try {
    const { email, firstname, company, source } = req.body;
    
    if (!email || !firstname) {
      return res.status(400).json({ error: 'Email and firstname required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID);
    const WELCOME_TEMPLATE_ID = parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID);

    console.log(`[${requestId}] Env vars:`, { 
      hasKey: !!BREVO_API_KEY, 
      listId: BREVO_LIST_ID, 
      templateId: WELCOME_TEMPLATE_ID 
    });

    // Step 1: Create/Update Contact in Brevo
    console.log(`[${requestId}] Step 1: Creating contact...`);
    
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        email: cleanEmail,
        attributes: {
          FIRSTNAME: firstname,
          COMPANY: company || '',
          LEAD_SOURCE: source || 'index_page',
          CAPTURED_AT: new Date().toISOString(),
          ASSESSMENT_COMPLETED: 'false'
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      })
    });

    const contactStatus = contactRes.status;
    let contactData = null;
    
    if (contactRes.ok) {
      contactData = await contactRes.json();
      console.log(`[${requestId}] Contact created:`, contactData.id);
    } else if (contactStatus === 204) {
      console.log(`[${requestId}] Contact updated (204)`);
    } else {
      const errorText = await contactRes.text();
      console.error(`[${requestId}] Contact failed:`, contactStatus, errorText);
      throw new Error(`Contact creation failed: ${contactStatus}`);
    }

    // Step 2: Send Welcome Email
    console.log(`[${requestId}] Step 2: Sending email...`);
    
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        to: [{ email: cleanEmail, name: firstname }],
        templateId: WELCOME_TEMPLATE_ID,
        params: {
          FIRSTNAME: firstname,
          ASSESSMENT_LINK: `https://vifscale.ighreenatech.com/assessment.html?e=${encodeURIComponent(cleanEmail)}`,
          COMPANY: company || 'your company'
        }
      })
    });

    let emailData = null;
    if (emailRes.ok) {
      emailData = await emailRes.json();
      console.log(`[${requestId}] Email sent:`, emailData.messageId);
    } else {
      const errorText = await emailRes.text();
      console.error(`[${requestId}] Email failed:`, emailRes.status, errorText);
      // Don't fail the whole request if email fails
    }

    return res.status(200).json({
      success: true,
      requestId,
      contactStatus,
      emailStatus: emailRes.status,
      messageId: emailData?.messageId
    });

  } catch (error) {
    console.error(`[${requestId}] CRITICAL ERROR:`, error.message, error.stack);
    return res.status(500).json({ 
      error: error.message, 
      requestId 
    });
  }
}
