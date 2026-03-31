export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, score, stage, weakness } = req.body;

  if (!email || score === undefined || !stage) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const payload = {
      attributes: {
        // CONVERT TO STRING to match your Brevo "Text" type
        SYSTEM_SCORE: String(score), 
        SYSTEM_STAGE: String(stage).trim(),
        SYSTEM_WEAKNESS: String(weakness || "Not specified"),
        // Note: Ensure RESULT_SENT and LAST_EVALUATED_AT 
        // also exist in Brevo or remove them to prevent errors.
      },
      listIds: [7] 
    };

    const response = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        method: "PUT", // Use PUT for existing contacts
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo Error Detail:", data);
      return res.status(response.status).json({ error: data.message });
    }

    return res.status(200).json({
      success: true,
      message: "Contact updated successfully"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
