// api/lib/email.js

import { BrevoClient } from './brevo.js';

// 5-tier template mapping based on score ranges
const TEMPLATES = {
  // 0-25%: Activity Without System
  TIER_1: parseInt(process.env.BREVO_TEMPLATE_0_25 || '10'),
  // 26-50%: Fragmented Infrastructure  
  TIER_2: parseInt(process.env.BREVO_TEMPLATE_26_50 || '11'),
  // 51-70%: Emerging Revenue System
  TIER_3: parseInt(process.env.BREVO_TEMPLATE_51_70 || '9'),
  // 71-85%: Structured but Inefficient
  TIER_4: parseInt(process.env.BREVO_TEMPLATE_71_85 || '12'),
  // 86-100%: Operational Revenue Engine
  TIER_5: parseInt(process.env.BREVO_TEMPLATE_86_100 || '13')
};

// Result names for logging/display
const TIER_NAMES = {
  [TEMPLATES.TIER_1]: 'Activity Without System',
  [TEMPLATES.TIER_2]: 'Fragmented Infrastructure',
  [TEMPLATES.TIER_3]: 'Emerging Revenue System',
  [TEMPLATES.TIER_4]: 'Structured but Inefficient',
  [TEMPLATES.TIER_5]: 'Operational Revenue Engine'
};

export function selectTemplate(score) {
  const percentage = parseInt(score);
  
  if (percentage <= 25) {
    return { 
      templateId: TEMPLATES.TIER_1, 
      tierName: TIER_NAMES[TEMPLATES.TIER_1],
      tierLevel: 1 
    };
  } else if (percentage <= 50) {
    return { 
      templateId: TEMPLATES.TIER_2, 
      tierName: TIER_NAMES[TEMPLATES.TIER_2],
      tierLevel: 2 
    };
  } else if (percentage <= 70) {
    return { 
      templateId: TEMPLATES.TIER_3, 
      tierName: TIER_NAMES[TEMPLATES.TIER_3],
      tierLevel: 3 
    };
  } else if (percentage <= 85) {
    return { 
      templateId: TEMPLATES.TIER_4, 
      tierName: TIER_NAMES[TEMPLATES.TIER_4],
      tierLevel: 4 
    };
  } else {
    return { 
      templateId: TEMPLATES.TIER_5, 
      tierName: TIER_NAMES[TEMPLATES.TIER_5],
      tierLevel: 5 
    };
  }
}

export async function sendResultsEmail({ to, toName, templateData, brevoClient }) {
  const score = parseInt(templateData.score);
  const selection = selectTemplate(score);
  
  console.log(`Selected template ${selection.templateId} for score ${score}% (${selection.tierName})`);

  try {
    const result = await brevoClient.sendTransactionalEmail({
      to,
      toName,
      templateId: selection.templateId,
      params: {
        // Standard params expected by all your templates
        FIRSTNAME: templateData.firstname || toName || to.split('@')[0],
        SYSTEM_SCORE: templateData.score,
        SYSTEM_GRADE: templateData.grade,
        SYSTEM_STAGE: templateData.stage,
        SYSTEM_WEAKNESS: templateData.weakest_area,
        SYSTEM_RECOMMENDATIONS: templateData.recommendations,
        CATEGORY_SCORES: templateData.category_scores,
        ASSESSMENT_DATE: new Date().toLocaleDateString(),
        
        // Legacy support for templates using old variable names
        contact: {
          FIRSTNAME: templateData.firstname || toName || to.split('@')[0],
          SYSTEM_SCORE: templateData.score,
          SYSTEM_WEAKNESS: templateData.weakest_area
        }
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
    console.error(`Template email failed for tier ${selection.tierName}:`, error);
    
    // Fallback to next tier down or generic
    const fallbackTier = Math.max(1, selection.tierLevel - 1);
    const fallbackId = Object.values(TEMPLATES)[fallbackTier - 1];
    
    console.log(`Attempting fallback to template ${fallbackId}`);
    
    try {
      const fallbackResult = await brevoClient.sendTransactionalEmail({
        to,
        toName,
        templateId: fallbackId,
        params: {
          FIRSTNAME: templateData.firstname || toName || to.split('@')[0],
          SYSTEM_SCORE: templateData.score,
          SYSTEM_WEAKNESS: templateData.weakest_area
        }
      });
      
      return {
        success: true,
        messageId: fallbackResult.messageId,
        templateId: fallbackId,
        tierName: TIER_NAMES[fallbackId] + ' (fallback)',
        tierLevel: fallbackTier,
        fallback: true
      };
    } catch (fallbackError) {
      // Final fallback: inline HTML
      return await sendFallbackEmail({ to, toName, templateData, brevoClient });
    }
  }
}

async function sendFallbackEmail({ to, toName, templateData, brevoClient }) {
  const html = generateFallbackHTML(templateData);
  
  return await brevoClient.sendTransactionalEmail({
    to,
    toName,
    subject: `Your Business Assessment Results: ${templateData.score}/100`,
    htmlContent: html
  });
}

function generateFallbackHTML(data) {
  // Simple fallback that matches your template style
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f0f2f5; }
        .wrapper { width: 100%; background-color: #f0f2f5; padding: 30px 0; }
        .main { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .content { padding: 40px; }
        h1 { font-size: 24px; color: #111827; margin-bottom: 20px; }
        .score-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; color: white; margin: 20px 0; }
        .score { font-size: 48px; font-weight: bold; }
        .stage { font-size: 18px; margin-top: 10px; }
        .section { margin: 30px 0; }
        h2 { font-size: 16px; color: #111827; border-left: 4px solid #667eea; padding-left: 12px; }
        p { color: #4b5563; line-height: 1.6; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="main">
            <div class="content">
                <h1>Hi ${data.firstname || 'there'},</h1>
                <p>Thank you for completing the Business Systems Assessment.</p>
                
                <div class="score-box">
                    <div class="score">${data.score}%</div>
                    <div class="stage">${data.stage}</div>
                </div>
                
                <div class="section">
                    <h2>Priority Focus Area</h2>
                    <p><strong>${data.weakest_area}</strong> - This is where you'll see the fastest improvements.</p>
                </div>
                
                <div class="section">
                    <h2>Next Steps</h2>
                    <p>${Array.isArray(data.recommendations) ? data.recommendations.join(' ') : data.recommendations}</p>
                </div>
                
                <p style="margin-top: 30px;">Ready to implement? <a href="https://calendly.com/YOUR_LINK" style="color: #667eea;">Book a strategy call</a>.</p>
            </div>
        </div>
        <div class="footer">
            &copy; 2026 Vifscale Technologies
        </div>
    </div>
</body>
</html>`;
}
