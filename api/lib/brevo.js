// api/lib/brevo.js

export class BrevoAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'BrevoAPIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class BrevoClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.brevo.com/v3';
    this.retries = options.retries || 3;
    this.delay = options.delay || 1000;
  }

  async fetchWithRetry(endpoint, options, attempt = 1) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        
        // Don't retry on client errors (4xx except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new BrevoAPIError(`Brevo API error: ${errorBody}`, response.status, errorBody);
        }

        // Retry on server errors or rate limits
        if (attempt < this.retries) {
          await this.sleep(this.delay * attempt);
          return this.fetchWithRetry(endpoint, options, attempt + 1);
        }
        
        throw new BrevoAPIError(`Brevo API failed after ${this.retries} attempts: ${errorBody}`, response.status, errorBody);
      }

      // 204 No Content (contact updated)
      if (response.status === 204) {
        return { success: true, updated: true, created: false };
      }

      return await response.json();

    } catch (error) {
      if (error.name === 'BrevoAPIError') throw error;
      
      // Network errors—retry
      if (attempt < this.retries) {
        await this.sleep(this.delay * attempt);
        return this.fetchWithRetry(endpoint, options, attempt + 1);
      }
      
      throw new BrevoAPIError(`Network error after ${this.retries} attempts: ${error.message}`, 0, error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // UPSERT: Create or update contact (idempotent)
  async upsertContact({ email, firstname, attributes, listIds }) {
    const payload = {
      email,
      attributes: {
        ...attributes,
        FIRSTNAME: firstname || attributes.FIRSTNAME || email.split('@')[0]
      },
      listIds,
      updateEnabled: true // Critical: enables upsert behavior
    };

    try {
      // Try CREATE first
      const result = await this.fetchWithRetry('/contacts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return {
        success: true,
        created: true,
        updated: false,
        contactId: result.id
      };

    } catch (error) {
      // If contact exists (likely 400 with duplicate error), force UPDATE
      if (error.statusCode === 400 || error.statusCode === 409) {
        // Remove listIds for update (Brevo quirk: update doesn't accept listIds same way)
        const updatePayload = {
          attributes: payload.attributes
        };

        const updateResult = await this.fetchWithRetry(`/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload)
        });

        // Add to list separately if needed
        if (listIds && listIds.length > 0) {
          await this.addToLists(email, listIds);
        }

        return {
          success: true,
          created: false,
          updated: true,
          contactId: email
        };
      }
      
      throw error;
    }
  }

  async addToLists(email, listIds) {
    return this.fetchWithRetry('/contacts/lists/add', {
      method: 'POST',
      body: JSON.stringify({
        emails: [email],
        listIds: listIds
      })
    });
  }

   // Send transactional email
   // Send transactional email
  async sendTransactionalEmail({ to, toName, templateId, params, subject, htmlContent }) {
    // Build recipient object - only include name if it exists
    const recipient = toName && toName.trim() 
      ? { email: to, name: toName.trim() }
      : { email: to };
    
    // Build payload
    let payload;
    if (templateId) {
      payload = {
        to: [recipient],
        templateId: parseInt(templateId),
        params: params || {}
      };
      
      // CRITICAL: Add sender - Brevo requires this even for templates
      if (process.env.EMAIL_FROM) {
        payload.sender = {
          email: process.env.EMAIL_FROM,
          name: process.env.EMAIL_FROM_NAME || 'Business Systems Assessment'
        };
      }
    } else {
      payload = {
        to: [recipient],
        sender: { 
          email: process.env.EMAIL_FROM, 
          name: process.env.EMAIL_FROM_NAME || 'Business Systems Assessment' 
        },
        subject,
        htmlContent
      };
    }

    console.log('Sending email payload:', JSON.stringify(payload));

    const result = await this.fetchWithRetry('/smtp/email', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      success: true,
      messageId: result.messageId
    };
  }
}
