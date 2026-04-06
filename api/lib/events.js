// We will upgrade to Vercel KV later if needed

export async function logEvent(requestId, type, data) {
  const event = {
    level: 'EVENT',
    requestId,
    type,
    data,
    timestamp: new Date().toISOString(),
    vercel_region: process.env.VERCEL_REGION || 'unknown'
  };

  // Log to Vercel logs (retained based on your plan)
  console.log(JSON.stringify(event));
}

// Health check: Get recent events (placeholder for future KV implementation)
export async function getRecentEvents(limit = 100) {
  // When you add Vercel KV, query from there
  return [];
}
