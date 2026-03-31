export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, score, stage, weakness } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  try {
    const payload = {
      attributes: {
        SYSTEM_SCORE: String(score), 
        SYSTEM_STAGE: String(stage).trim(),
        SYSTEM_WEAKNESS: String(weakness || "None"),
        // We add this to ensure the "Attribute Change" trigger works
        LAST_EVALUATED_AT: new Date().toISOString() 
      },
      // We use 'listIds' but we will also change the trigger in Brevo
      listIds: [8]
    };

    const response = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Brevo Error:", result);
      return res.status(response.status).json(result);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
