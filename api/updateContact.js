export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, score, stage, weakness } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const payload = {
      attributes: {
        SYSTEM_SCORE: String(score), 
        SYSTEM_STAGE: String(stage).trim(),
        SYSTEM_WEAKNESS: String(weakness || "None Identified")
      },
      listIds: [8] // CHANGE THIS to your new "Assessment Completed" List ID
    };

    // We use PUT because the user already exists from the Lead Capture phase
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

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
