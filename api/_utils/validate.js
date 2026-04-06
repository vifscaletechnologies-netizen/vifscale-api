
export function validateAssessment(data) {
  const errors = [];
  
  if (!data) {
    return { valid: false, errors: ['No data provided'] };
  }

  // Required fields
  if (!data.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (data.assessment_score === undefined || data.assessment_score === null) {
    errors.push('Assessment score is required');
  } else {
    const score = parseInt(data.assessment_score);
    if (isNaN(score) || score < 0 || score > 100) {
      errors.push('Score must be 0-100');
    }
  }

  if (!data.stage) {
    errors.push('Stage is required');
  }

  // Sanitize
  const sanitized = {
    email: data.email?.toLowerCase().trim(),
    firstname: sanitizeString(data.firstname),
    company: sanitizeString(data.company),
    assessment_score: parseInt(data.assessment_score),
    raw_score: parseInt(data.raw_score) || parseInt(data.assessment_score),
    assessment_grade: sanitizeString(data.assessment_grade),
    stage: sanitizeString(data.stage),
    weakest_area: sanitizeString(data.weakest_area),
    recommendations: data.recommendations || [],
    category_scores: data.category_scores || {},
    source: sanitizeString(data.source) || 'assessment_page',
    completed_at: data.completed_at || new Date().toISOString()
  };

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  return { valid: true, errors: [], sanitized };
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function sanitizeString(str) {
  if (!str) return '';
  return String(str).trim().substring(0, 500); // Limit length
}
