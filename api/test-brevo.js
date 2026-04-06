// api/test-brevo.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Test 1: API key validity
    const accountRes = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    });
    
    const accountStatus = accountRes.status;
    let accountData = null;
    if (accountRes.ok) {
      accountData = await accountRes.json();
    }

    // Test 2: List exists
    const listRes = await fetch(`https://api.brevo.com/v3/contacts/lists/${process.env.BREVO_LIST_ID}`, {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    });

    // Test 3: Template exists
    const templateRes = await fetch(`https://api.brevo.com/v3/smtp/templates/${process.env.BREVO_WELCOME_TEMPLATE_ID}`, {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    });

    res.status(200).json({
      env: {
        hasApiKey: !!process.env.BREVO_API_KEY,
        listId: process.env.BREVO_LIST_ID,
        welcomeTemplateId: process.env.BREVO_WELCOME_TEMPLATE_ID
      },
      tests: {
        account: { status: accountStatus, ok: accountRes.ok, email: accountData?.email },
        list: { status: listRes.status, ok: listRes.ok },
        template: { status: templateRes.status, ok: templateRes.ok }
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
