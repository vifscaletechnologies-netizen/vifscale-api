// api/lib/email.js

import { BrevoClient } from './brevo.js';

// 5-tier template mapping
const TEMPLATES = {
  TIER_1: parseInt(process.env.BREVO_TEMPLATE_0_25 || '33'),    // 0-25%: Activity Without System
  TIER_2: parseInt(process.env.BREVO_TEMPLATE_26_50 || '11'),   // 26-50%: Fragmented Infrastructure
  TIER_3: parseInt(process.env.BREVO_TEMPLATE_51_70 || '35'),    // 51-70%: Emerging Revenue System
  TIER_4: parseInt(process.env.BREVO_TEMPLATE_71_85 || '36'),   // 71-85%: Structured but Inefficient
  TIER_5: parseInt(process.env.BREVO_TEMPLATE_86_100 || '34')   // 86-100%: Operational Revenue Engine
};

const TIER_NAMES = {
  [TEMPLATES.TIER_1]: 'Activity Without System',
  [TEMPLATES.TIER_2]: 'Fragmented Infrastructure',
  [TEMPLATES.TIER_3]: 'Emerging Revenue System',
  [TEMPLATES.TIER_4]: 'Structured but Inefficient',
  [TEMPLATES.TIER_5]: 'Operational Revenue Engine'
};

export function selectTemplate(score) {
  const percentage = parseInt(score);
  
  if (percentage <= 25) return { templateId: TEMPLATES.TIER_1, tierName: TIER_NAMES[TEMPLATES.TIER_1], tierLevel: 1 };
  if (percentage <= 50) return { templateId: TEMPLATES.TIER_2, tierName: TIER_NAMES[TEMPLATES.TIER_2], tierLevel: 2 };
  if (percentage <= 70) return { templateId: TEMPLATES.TIER_3, tierName: TIER_NAMES[TEMPLATES.TIER_3], tierLevel: 3 };
  if (percentage <= 85) return { templateId: TEMPLATES.TIER_4, tierName: TIER_NAMES[TEMPLATES.TIER_4], tierLevel: 4 };
  return { templateId: TEMPLATES.TIER_5, tierName: TIER_NAMES[TEMPLATES.TIER_5], tierLevel: 5 };
}

export async function sendResultsEmail({ to, toName, templateData, brevoClient }) {
  const selection = selectTemplate(templateData.score);
  
  console.log(`[${new Date().toISOString()}] Tier ${selection.tierLevel}: ${selection.tierName} (score: ${templateData.score}%)`);

  try {
    const result = await brevoClient.sendTransactionalEmail({
      to,
      toName: toName || templateData.firstname || to.split('@')[0],
      templateId: selection.templateId,
      params: {
        // All 20 attributes available to template
        FIRSTNAME: templateData.firstname || toName || to.split('@')[0],
        SYSTEM_SCORE: templateData.score,
        SYSTEM_GRADE: templateData.grade,
        SYSTEM_STAGE: selection.tierName, // Use calculated tier name
        SYSTEM_WEAKNESS: templateData.weakest_area,
        SYSTEM_RECOMMENDATIONS: Array.isArray(templateData.recommendations) 
          ? templateData.recommendations.join('; ') 
          : templateData.recommendations,
        CATEGORY_SCORES: JSON.stringify(templateData.category_scores || {}),
        TIER_LEVEL: selection.tierLevel,
        TIER_NAME: selection.tierName,
        ASSESSMENT_DATE: new Date().toLocaleDateString()
      }
    });

    return {
      success: true,
      messageId: result.messageId,
      templateId: selection.templateId,
      tierName: selection.tierName,
      tierLevel: selection.tierLevel
    };

  } catch (error) {
    console.error(`Template ${selection.templateId} failed:`, error);
    throw error; // Let caller handle fallback
  }
}
