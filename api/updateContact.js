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
      email: email,
      attributes: {
        SYSTEM_SCORE: Number(score),             
        SYSTEM_STAGE: stage.trim(),              
        SYSTEM_WEAKNESS: weakness || "Not specified",
        RESULT_SENT: "NO",                       
        LAST_EVALUATED_AT: new Date().toISOString() 
      },
      updateEnabled: true                         
    };

    const response = await fetch(
      "https://api.brevo.com/v3/contacts",
      {
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: errorText });
    }

    return res.status(200).json({
      success: true,
      message: "Contact updated and ready for automation"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
