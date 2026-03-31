export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, score, stage, weakness } = req.body;
  const apiKey = process.env.BREVO_API_KEY;

  try {
    // STEP 1: Update the Contact Attributes & List
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

    // STEP 2: Fire the Custom Event (This is the "Trigger")
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
      const errorData = await eventResponse.json();
      return res.status(500).json({ error: "Event failed", details: errorData });
    }

    return res.status(200).json({ success: true, message: "Event fired!" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
