export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, score, stage, weakness } = req.body;
  const apiKey = process.env.BREVO_API_KEY;

  try {
    // STEP 1: Create or Update the Contact FIRST
    // This ensures the email exists before we "fire" an event against it
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
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
        updateEnabled: true // This is the magic flag that prevents 400 errors if user exists
      })
    });

    // STEP 2: Fire the Event
    const eventResponse = await fetch("https://api.brevo.com/v3/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        event_name: "ASSESSMENT_COMPLETED",
        email: email,
        properties: { 
            score: Number(score), 
            stage: stage 
        }
      })
    });

    if (!eventResponse.ok) {
      const errorDetail = await eventResponse.json();
      console.error("Brevo Event Error:", errorDetail);
      return res.status(500).json({ error: "Event failed", details: errorDetail });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
