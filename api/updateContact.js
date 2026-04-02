export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://vifscale.ighreenatech.com');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email, score, stage, weakness } = req.body;
  const apiKey = process.env.BREVO_API_KEY;

  try {
    // 1. Update/Create Contact (Standard API)
    await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        email: email,
        attributes: {
          SYSTEM_SCORE: String(score),
          SYSTEM_STAGE: String(stage),
          SYSTEM_WEAKNESS: String(weakness)
        },
        updateEnabled: true 
      })
    });

    // 2. Fire Event (The "Universal" Payload)
    const eventResponse = await fetch("https://api.brevo.com/v3/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        event_name: "ASSESSMENT_COMPLETED",
        email: email, // Top level
        contact_id: email, // Backup ID
        identifiers: { email: email }, // Modern 2026 format
        event_properties: {
          score_num: Number(score),
          stage_name: stage
        }
      })
    });

    const result = await eventResponse.json();

    if (!eventResponse.ok) {
      return res.status(500).json({ success: false, error: result });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
