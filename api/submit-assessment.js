import { corsHeaders, handleCors } from './_utils/cors.js';
import { validateAssessment } from './_utils/validate.js';
import { BrevoClient } from './lib/brevo.js';
import { sendResultsEmail } from './lib/email.js';
import { logEvent } from './lib/events.js';

const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_LIST_ID: parseInt(process.env.BREVO_LIST_ID)
};

export default async function handler(req, res) {
   // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const validation = validateAssessment(req.body);
    if (!validation.valid) {
      await logEvent(requestId, 'VALIDATION_FAILED', { errors: validation.errors });
      return res.status(400).json({ error: 'Invalid data', details: validation.errors, requestId });
    }

    const data = validation.sanitized;
    const email = data.email.toLowerCase().trim();

    // Calculate tier info
    const score = parseInt(data.assessment_score);
    let tierName, tierLevel;
    if (score <= 25) { tierName = 'Activity Without System'; tierLevel = 1; }
    else if (score <= 50) { tierName = 'Fragmented Infrastructure'; tierLevel = 2; }
    else if (score <= 70) { tierName = 'Emerging Revenue System'; tierLevel = 3; }
    else if (score <= 85) { tierName = 'Structured but Inefficient'; tierLevel = 4; }
    else { tierName = 'Operational Revenue Engine'; tierLevel = 5; }

    const brevo = new BrevoClient(CONFIG.BREVO_API_KEY);

    // UPSERT contact with all 20 attributes
    const contactResult = await brevo.upsertContact({
      email,
      firstname: data.firstname,
      attributes: {
        // Core assessment
        FIRSTNAME: data.firstname || email.split('@')[0],
        COMPANY: data.company || '',
        ASSESSMENT_SCORE: score,
        RAW_SCORE: parseInt(data.raw_score) || 0,
        ASSESSMENT_GRADE: data.assessment_grade || calculateGrade(score),
        STAGE: tierName, // Use calculated tier name
        WEAKEST_AREA: data.weakest_area || '',
        CATEGORY_SCORES: JSON.stringify(data.category_scores || {}),
        RECOMMENDATIONS: Array.isArray(data.recommendations) 
          ? data.recommendations.join('|') 
          : data.recommendations || '',
        ASSESSMENT_DATE: data.completed_at 
          ? data.completed_at.split('T')[0] 
          : new Date().toISOString().split('T')[0],
        ASSESSMENT_COMPLETED: 'true',
        ASSESSMENT_VERSION: '2.0',

        // Lead tracking
        LEAD_SOURCE: data.source || 'assessment_page',
        LEAD_TEMPERATURE: calculateTemperature(score),
        CAPTURED_AT: sessionStorage.getItem('capturedAt') || new Date().toISOString(),
        LAST_ASSESSMENT_AT: data.completed_at || new Date().toISOString(),
        LAST_ASSESSMENT_IP: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '',

        // System/internal
        REQUEST_ID: requestId,
        TIER_NAME: tierName,
        TIER_LEVEL: tierLevel
      },
      listIds: [CONFIG.BREVO_LIST_ID]
    });

    // Send tier-specific email
    const emailResult = await sendResultsEmail({
      to: email,
      toName: data.firstname,
      templateData: {
        score: score,
        grade: data.assessment_grade || calculateGrade(score),
        stage: tierName,
        weakest_area: data.weakest_area,
        recommendations: data.recommendations,
        category_scores: data.category_scores,
        firstname: data.firstname,
        tier_level: tierLevel
      },
      brevoClient: brevo
    });

    await logEvent(requestId, 'ASSESSMENT_COMPLETED', {
      email: hashEmail(email),
      score,
      tierName,
      tierLevel,
      templateId: emailResult.templateId,
      duration: Date.now() - startTime
    });

    return res.status(200).json({
      success: true,
      requestId,
      emailSent: true,
      messageId: emailResult.messageId,
      tier: {
        name: tierName,
        level: tierLevel,
        templateId: emailResult.templateId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logEvent(requestId, 'ASSESSMENT_FAILED', { error: error.message });
    return res.status(500).json({
      error: 'Processing failed',
      requestId,
      retryable: true
    });
  }
}

function calculateGrade(score) {
  if (score >= 86) return 'A';
  if (score >= 71) return 'B';
  if (score >= 51) return 'C';
  if (score >= 26) return 'D';
  return 'F';
}

function calculateTemperature(score) {
  if (score >= 86) return 'HOT';
  if (score >= 71) return 'WARM';
  if (score >= 51) return 'LUKEWARM';
  return 'COLD';
}

function hashEmail(email) {
  return email.split('@')[0].slice(0,2) + '***@' + email.split('@')[1];
}
