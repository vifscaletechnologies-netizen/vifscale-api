export default async function handler(req, res) {
  // 1. SET CORS HEADERS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // In production, replace '*' with 'https://vifscale.ighreenatech.com'
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 2. HANDLE PREFLIGHT (The 'OPTIONS' request the browser sends first)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, score, stage, weakness } = req.body;
  const apiKey = process.env.BREVO_API_KEY;

  try {
    // STEP 1: Update Contact
    await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        attributes: {
          SYSTEM_SCORE: String(score),
          SYSTEM_STAGE: String(stage),
          SYSTEM_WEAKNESS: String(weakness)
        },
        listIds: [8]
      })
    });

    // STEP 2: Fire Custom Event
    const eventResponse = await fetch("https://api.brevo.com/v3/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        event_name: "ASSESSMENT_COMPLETED",
        email: email,
        properties: { score: Number(score), stage: stage }
      })
    });

    if (!eventResponse.ok) {
      const errorData = await eventResponse.json();
      return res.status(500).json({ error: "Event failed", details: errorData });
    }

    return res.status(200).json({ success: true, message: "Event fired!" });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
