// In the success response of api/submit-assessment.js:

const emailResult = await sendResultsEmail({
  to: email,
  toName: data.firstname,
  templateData: {
    score: data.assessment_score,
    grade: data.assessment_grade,
    stage: data.stage,
    weakest_area: data.weakest_area,
    recommendations: data.recommendations,
    category_scores: data.category_scores,
    firstname: data.firstname
  },
  brevoClient: brevo
});

// Return tier info to frontend
return res.status(200).json({
  success: true,
  requestId,
  emailSent: true,
  messageId: emailResult.messageId,
  tier: {
    name: emailResult.tierName,
    level: emailResult.tierLevel,
    templateId: emailResult.templateId
  },
  timestamp: new Date().toISOString()
});
