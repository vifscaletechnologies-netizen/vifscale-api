export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { email, score, stage, weakness } = req.body;
  const apiKey = process.env.BREVO_API_KEY;

  try {
    // STEP 1: Ensure Contact Exists & Update Attributes
    // We use the 'POST' to /contacts with 'updateEnabled: true' for maximum reliability
    const contactResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        email: email,
        attributes: {
          SYSTEM_SCORE: String(score),
          SYSTEM_STAGE: String(stage),
          SYSTEM_WEAKNESS: String(weakness)
        },
        listIds: [8],
        updateEnabled: true 
      })
    });

    // STEP 2: Fire the Custom Event (This creates the event in Brevo)
    const eventResponse = await fetch("https://api.brevo.com/v3/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        event_name: "ASSESSMENT_COMPLETED",
        email: email,
        properties: {
          score_num: Number(score)
        }
      })
    });

    const eventResult = await eventResponse.json();

    if (!eventResponse.ok) {
      return res.status(500).json({ error: "Event Registration Failed", details: eventResult });
    }

    return res.status(200).json({ success: true, message: "Event Registered!" });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
