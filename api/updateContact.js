export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, score, stage, weakness } = req.body;

  // Validate required fields
  if (!email || score === undefined || !stage) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 1. Prepare the payload specifically for an update
    const payload = {
      attributes: {
        SYSTEM_SCORE: Number(score),
        SYSTEM_STAGE: stage.trim(),
        SYSTEM_WEAKNESS: weakness || "Not specified",
        RESULT_SENT: "NO",
        LAST_EVALUATED_AT: new Date().toISOString()
      },
      // This will add the contact to List 7 without removing them from others
      listIds: [7] 
    };

    // 2. Use the PUT endpoint to target the specific contact by email
    // encodeURIComponent handles special characters in emails like '+' or '.'
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

    // 3. Handle Brevo response
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error:", errorData);
      return res.status(response.status).json({ 
        error: errorData.message || "Failed to update contact in Brevo" 
      });
    }

    // Success!
    return res.status(200).json({
      success: true,
      message: "Contact updated and assigned to List 7 successfully"
    });

  } catch (error) {
    console.error("Vercel Server Error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
