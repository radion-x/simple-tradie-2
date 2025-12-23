const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const mailgun = require('mailgun-js');

// Initialize Mailgun
const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    host: process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net'
});

/**
 * Tool Definitions for DeepSeek Function Calling
 */
const tools = [
    {
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Search the internet for current information, recent trends, statistics, competitor data, or specific queries. Use for information after 2024 or real-time data. Do not use for general knowledge already in training data.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query to find information about. Be specific and concise.'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'request_callback',
            description: 'Schedule a callback for the user when they want to speak with the Websited team, get pricing details, schedule a consultation, or discuss their business needs in detail. Collect name and at least one contact method (phone or email) before calling this function.',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'The user\'s full name'
                    },
                    phone: {
                        type: 'string',
                        description: 'The user\'s phone number (optional if email provided)'
                    },
                    email: {
                        type: 'string',
                        description: 'The user\'s email address (optional if phone provided)'
                    },
                    preferred_contact_method: {
                        type: 'string',
                        enum: ['phone', 'email', 'sms', 'any'],
                        description: 'How the user prefers to be contacted'
                    },
                    preferred_time: {
                        type: 'string',
                        description: 'When the user prefers to be contacted (e.g., "morning", "afternoon", "ASAP")'
                    },
                    message: {
                        type: 'string',
                        description: 'Additional message or context about what they want to discuss'
                    }
                },
                required: ['name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'fetch_webpage',
            description: 'Fetch and analyze the content of a specific webpage. Use this to examine website structure, copy, SEO elements, design, services offered, or any page-specific details. Perfect for analyzing client websites or competitor research. Use search_web for general queries.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The full URL of the webpage to fetch and analyze (must include http:// or https://)'
                    }
                },
                required: ['url']
            }
        }
    }
];

/**
 * Execute Brave Search API call
 */
async function executeBraveSearch(query, sessionId) {
    try {
        // Check if search is enabled
        if (process.env.ENABLE_WEB_SEARCH !== 'true') {
            return {
                error: 'Web search is currently disabled',
                results: []
            };
        }

        if (!process.env.BRAVE_SEARCH_API_KEY) {
            return {
                error: 'Search API key not configured',
                results: []
            };
        }

        // Check session search limit
        if (sessionId) {
            const sessionSearches = await pool.query(
                'SELECT COUNT(*) as count FROM search_queries WHERE session_id = $1',
                [sessionId]
            );
            
            const searchCount = parseInt(sessionSearches.rows[0].count);
            const maxSearches = parseInt(process.env.MAX_SEARCHES_PER_SESSION) || 3;
            
            if (searchCount >= maxSearches) {
                return {
                    error: `You've reached the maximum of ${maxSearches} searches for this conversation. I can still help answer your questions directly!`,
                    results: []
                };
            }
        }

        // Check monthly quota
        const monthlySearches = await pool.query(
            `SELECT COUNT(*) as count FROM search_queries 
             WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)`
        );
        
        const monthlyCount = parseInt(monthlySearches.rows[0].count);
        const monthlyQuota = parseInt(process.env.BRAVE_MONTHLY_QUOTA) || 2000;
        
        // Send warning email if approaching quota
        if (monthlyCount >= monthlyQuota * 0.95 && monthlyCount % 10 === 0) {
            sendQuotaWarningEmail(monthlyCount, monthlyQuota);
        }
        
        if (monthlyCount >= monthlyQuota) {
            return {
                error: 'Monthly search quota exceeded. I\'ll help you with the information I have!',
                results: []
            };
        }

        // Call Brave Search API
        console.log('Calling Brave API with query:', query);
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            params: {
                q: query,
                count: 5
            },
            headers: {
                'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        console.log('Brave API response received, status:', response.status);
        const results = response.data.web?.results || [];
        const formattedResults = results.slice(0, 5).map(result => ({
            title: result.title,
            description: result.description,
            url: result.url
        }));

        // Log search query to database
        console.log('Logging search to database...');
        await pool.query(
            'INSERT INTO search_queries (query, session_id, results_count) VALUES ($1, $2, $3)',
            [query, sessionId || 'unknown', formattedResults.length]
        );
        console.log('Search logged to database successfully');

        return {
            results: formattedResults,
            query: query
        };

    } catch (error) {
        console.error('Brave Search error:', error.response?.data || error.message);
        return {
            error: 'Search temporarily unavailable',
            results: []
        };
    }
}

/**
 * Fetch and parse webpage content
 */
async function executeFetchWebpage(url, sessionId) {
    try {
        // Validate URL format
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return {
                error: 'Invalid URL format. Please provide a complete URL starting with http:// or https://',
                content: null
            };
        }

        // Check session fetch limit (prevent abuse)
        if (sessionId) {
            const sessionFetches = await pool.query(
                'SELECT COUNT(*) as count FROM search_queries WHERE session_id = $1 AND query LIKE $2',
                [sessionId, 'webpage:%']
            );
            
            const fetchCount = parseInt(sessionFetches.rows[0].count);
            const maxFetches = parseInt(process.env.MAX_WEBPAGE_FETCHES_PER_SESSION) || 5;
            
            if (fetchCount >= maxFetches) {
                return {
                    error: `You've reached the maximum of ${maxFetches} webpage fetches for this conversation. I can still help answer your questions!`,
                    content: null
                };
            }
        }

        console.log(`Fetching webpage: ${url}`);

        // Fetch webpage with timeout and headers
        const response = await axios.get(url, {
            timeout: 15000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Websited-AI-Bot/1.0 (https://websited.au)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        console.log(`Webpage fetched successfully, status: ${response.status}`);

        const html = response.data;
        
        // Simple HTML parsing - extract key elements
        const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || 'No title';
        const metaDescription = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
        
        // Remove script and style tags
        let textContent = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Limit content length to prevent token overflow (keep first 8000 chars)
        if (textContent.length > 8000) {
            textContent = textContent.substring(0, 8000) + '... [content truncated]';
        }

        // Extract headings for structure
        const h1Tags = (html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || []).map(tag => 
            tag.replace(/<[^>]+>/g, '').trim()
        );
        const h2Tags = (html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || []).map(tag => 
            tag.replace(/<[^>]+>/g, '').trim()
        ).slice(0, 10); // Limit to first 10 h2s

        // Log webpage fetch to database (reuse search_queries table)
        await pool.query(
            'INSERT INTO search_queries (query, session_id, results_count) VALUES ($1, $2, $3)',
            [`webpage:${url}`, sessionId || 'unknown', 1]
        );

        const result = {
            url: url,
            title: title,
            metaDescription: metaDescription,
            headings: {
                h1: h1Tags,
                h2: h2Tags
            },
            content: textContent,
            contentLength: textContent.length
        };

        console.log(`Webpage analyzed: ${title.substring(0, 50)}... (${textContent.length} chars)`);

        return result;

    } catch (error) {
        console.error('Fetch webpage error:', error.message);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return {
                error: 'Could not connect to that website. Please check the URL is correct.',
                content: null
            };
        }
        
        if (error.response?.status === 404) {
            return {
                error: 'Page not found (404). The URL may be incorrect or the page may have been removed.',
                content: null
            };
        }
        
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            return {
                error: 'The website took too long to respond. It may be down or very slow.',
                content: null
            };
        }

        return {
            error: 'Unable to fetch webpage content. The site may be blocking automated access.',
            content: null
        };
    }
}

/**
 * Execute callback request
 */
async function executeCallbackRequest(data, conversationContext) {
    try {
        // Check if callbacks are enabled
        if (process.env.ENABLE_CALLBACKS !== 'true') {
            return {
                success: false,
                error: 'Callback requests are currently disabled'
            };
        }

        // Validate required fields
        if (!data.name) {
            return {
                success: false,
                error: 'Name is required'
            };
        }

        if (!data.phone && !data.email) {
            return {
                success: false,
                error: 'Please provide either a phone number or email address'
            };
        }

        // Insert callback request into database
        const result = await pool.query(
            `INSERT INTO callback_requests 
             (name, phone, email, preferred_contact_method, preferred_time, message, conversation_context, status, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'chatbot')
             RETURNING id, created_at`,
            [
                data.name,
                data.phone || null,
                data.email || null,
                data.preferred_contact_method || 'any',
                data.preferred_time || 'ASAP',
                data.message || '',
                conversationContext || ''
            ]
        );

        const callbackId = result.rows[0].id;
        const createdAt = result.rows[0].created_at;
        const referenceId = `CB-${new Date(createdAt).getTime()}-${callbackId}`;

        // Send emails (admin notification + customer confirmation)
        await sendCallbackEmails({
            ...data,
            id: callbackId,
            referenceId: referenceId,
            conversationContext: conversationContext
        });

        return {
            success: true,
            referenceId: referenceId,
            message: `Callback scheduled successfully! Reference: ${referenceId}`
        };

    } catch (error) {
        console.error('Callback request error:', error.message);
        return {
            success: false,
            error: 'Failed to schedule callback. Please try again.'
        };
    }
}

/**
 * Send callback notification emails
 */
async function sendCallbackEmails(data) {
    try {
        const recipients = process.env.RECIPIENT_EMAIL.split(',').map(e => e.trim());
        
        // Admin notification email
        const adminEmailData = {
            from: process.env.EMAIL_FROM,
            to: recipients,
            subject: '🔥 URGENT: New Callback Request - Websited',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
                        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .info-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                        .info-table td:first-child { font-weight: 600; width: 40%; color: #6b7280; }
                        .context-box { background: #f9fafb; padding: 15px; border-left: 4px solid #C4EF17; margin: 20px 0; }
                        .cta-button { display: inline-block; background: #C4EF17; color: #0f0f23; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 28px;">🔥 New Callback Request</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">HIGH PRIORITY - Respond within 24 hours</p>
                        </div>
                        <div class="content">
                            <h2 style="color: #1a1a2e; margin-top: 0;">Contact Details</h2>
                            <table class="info-table">
                                <tr>
                                    <td>Name:</td>
                                    <td><strong>${data.name}</strong></td>
                                </tr>
                                ${data.phone ? `<tr><td>Phone:</td><td><strong>${data.phone}</strong></td></tr>` : ''}
                                ${data.email ? `<tr><td>Email:</td><td><strong>${data.email}</strong></td></tr>` : ''}
                                <tr>
                                    <td>Preferred Contact:</td>
                                    <td><strong>${data.preferred_contact_method || 'any'}</strong></td>
                                </tr>
                                <tr>
                                    <td>Preferred Time:</td>
                                    <td><strong>${data.preferred_time || 'ASAP'}</strong></td>
                                </tr>
                                <tr>
                                    <td>Reference ID:</td>
                                    <td><strong>${data.referenceId}</strong></td>
                                </tr>
                            </table>
                            
                            ${data.message ? `
                            <h3 style="color: #1a1a2e;">Message:</h3>
                            <p style="background: #f9fafb; padding: 15px; border-radius: 6px;">${data.message}</p>
                            ` : ''}
                            
                            ${data.conversationContext ? `
                            <div class="context-box">
                                <h3 style="color: #1a1a2e; margin-top: 0;">Conversation Context:</h3>
                                <p style="margin: 0; white-space: pre-wrap;">${data.conversationContext.substring(0, 500)}${data.conversationContext.length > 500 ? '...' : ''}</p>
                            </div>
                            ` : ''}
                            
                            <center>
                                <a href="${process.env.SITE_URL}/admin/callbacks.html?id=${data.id}" class="cta-button">
                                    View in Dashboard
                                </a>
                            </center>
                            
                            <div class="footer">
                                <p>Received: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEDT</p>
                                <p style="margin: 0;">Websited - AI & Digital Marketing Solutions</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `NEW CALLBACK REQUEST\n\nName: ${data.name}\nPhone: ${data.phone || 'N/A'}\nEmail: ${data.email || 'N/A'}\nPreferred Contact: ${data.preferred_contact_method || 'any'}\nPreferred Time: ${data.preferred_time || 'ASAP'}\nReference: ${data.referenceId}\n\n${data.message ? `Message: ${data.message}\n\n` : ''}View in dashboard: ${process.env.SITE_URL}/admin/callbacks.html?id=${data.id}`
        };

        await mg.messages().send(adminEmailData);
        console.log(`✅ Admin callback notification sent to ${recipients.join(', ')}`);

        // Customer confirmation email (if email provided)
        if (data.email) {
            const customerEmailData = {
                from: process.env.EMAIL_FROM,
                to: data.email,
                'h:Reply-To': process.env.EMAIL_FROM,
                subject: 'We\'ve received your request - Websited',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #1E40AF 0%, #8B5CF6 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
                            .content { background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; }
                            .reference-box { background: #f0fdf4; border: 2px solid #C4EF17; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
                            .cta-button { display: inline-block; background: #C4EF17; color: #0f0f23; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0; font-size: 32px;">Thank You, ${data.name}! ✨</h1>
                                <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">We've received your callback request</p>
                            </div>
                            <div class="content">
                                <p style="font-size: 16px; margin-top: 0;">Our team at Websited is excited to connect with you and discuss how we can help grow your business with AI-powered marketing solutions.</p>
                                
                                <div class="reference-box">
                                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Reference Number</p>
                                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a2e;">${data.referenceId}</p>
                                </div>
                                
                                <h2 style="color: #1a1a2e; font-size: 20px;">What Happens Next?</h2>
                                <ul style="padding-left: 20px;">
                                    <li style="margin: 12px 0;">Our team will review your request immediately</li>
                                    <li style="margin: 12px 0;">You'll hear from us <strong>within 24 hours</strong> via ${data.preferred_contact_method === 'phone' ? 'phone call' : data.preferred_contact_method === 'email' ? 'email' : data.preferred_contact_method === 'sms' ? 'SMS' : 'your preferred method'}</li>
                                    <li style="margin: 12px 0;">We'll discuss your specific business needs and goals</li>
                                    <li style="margin: 12px 0;">You'll receive a customized strategy recommendation</li>
                                </ul>
                                
                                <p style="background: #f9fafb; padding: 20px; border-left: 4px solid #C4EF17; margin: 30px 0;">
                                    <strong>Want to get started faster?</strong><br>
                                    Book a time directly in our calendar:
                                </p>
                                
                                <center>
                                    <a href="https://calendly.com/websited" class="cta-button">
                                        �� Book a Time Now
                                    </a>
                                </center>
                                
                                <div class="footer">
                                    <p style="margin: 0 0 10px 0;"><strong>Websited</strong></p>
                                    <p style="margin: 0 0 5px 0;">2 Martin Place, Sydney, Australia</p>
                                    <p style="margin: 0 0 5px 0;">📧 hello@simplepage.com.au | 🌐 simplepage.com.au</p>
                                    <p style="margin: 20px 0 0 0; font-size: 12px;">25+ years dominating digital marketing with AI-powered solutions</p>
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `Thank you, ${data.name}!\n\nWe've received your callback request.\n\nYour Reference Number: ${data.referenceId}\n\nWhat happens next?\n- Our team will review your request immediately\n- You'll hear from us within 24 hours via ${data.preferred_contact_method || 'your preferred method'}\n- We'll discuss your specific business needs and goals\n\nWant to get started faster? Book a time: https://calendly.com/websited\n\nWebsited - AI & Digital Marketing Solutions\n2 Martin Place, Sydney, Australia\nhello@simplepage.com.au | simplepage.com.au`
            };

            await mg.messages().send(customerEmailData);
            console.log(`✅ Customer confirmation sent to ${data.email}`);
        }

    } catch (error) {
        console.error('Email sending error:', error.message);
        // Don't throw - callback was saved, email failure shouldn't break the flow
    }
}

/**
 * Send quota warning email to admins
 */
async function sendQuotaWarningEmail(currentCount, quota) {
    try {
        const recipients = process.env.RECIPIENT_EMAIL.split(',').map(e => e.trim());
        const percentage = Math.round((currentCount / quota) * 100);
        
        const emailData = {
            from: process.env.EMAIL_FROM,
            to: recipients,
            subject: `⚠️ Brave Search Quota Warning: ${percentage}% Used`,
            html: `
                <h2>⚠️ Search Quota Warning</h2>
                <p>Your Brave Search API usage is approaching the monthly limit:</p>
                <ul>
                    <li><strong>Current Usage:</strong> ${currentCount} / ${quota} searches</li>
                    <li><strong>Percentage Used:</strong> ${percentage}%</li>
                    <li><strong>Remaining:</strong> ${quota - currentCount} searches</li>
                </ul>
                <p>Consider upgrading your Brave Search plan at: <a href="https://brave.com/search/api/">https://brave.com/search/api/\</a\>\</p\>
            `,
            text: `Search Quota Warning\n\nCurrent Usage: ${currentCount} / ${quota} searches\nPercentage Used: ${percentage}%\nRemaining: ${quota - currentCount} searches\n\nConsider upgrading at: https://brave.com/search/api/`
        };

        await mg.messages().send(emailData);
        console.log(`⚠️ Quota warning email sent (${percentage}% used)`);
    } catch (error) {
        console.error('Quota warning email error:', error.message);
    }
}

/**
 * POST /api/chat
 * Handle AI chat messages with function calling support
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, history = [], sessionId } = req.body;

        // Validate input
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ 
                error: 'Message is required' 
            });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            console.error('OPENROUTER_API_KEY not configured');
            return res.status(500).json({ 
                error: 'AI service not configured' 
            });
        }

        // Build messages array with system prompt and conversation history
        const messages = [
            {
                role: 'system',
                content: process.env.OPENROUTER_SYSTEM_PROMPT || 'You are a helpful AI assistant.'
            }
        ];

        // Add conversation history (last 10 messages for context)
        if (Array.isArray(history) && history.length > 0) {
            const recentHistory = history.slice(-10);
            recentHistory.forEach(msg => {
                if (msg.role && msg.content) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    });
                }
            });
        }

        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        // Check if streaming is enabled
        const useStreaming = process.env.OPENROUTER_USE_STREAMING === 'true';

        // Build conversation context for callback
        const conversationContext = history
            .slice(-5)
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');

        if (useStreaming) {
            // Streaming response with function calling
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                    messages: messages,
                    tools: tools,
                    max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 1000,
                    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
                    stream: true
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                        'X-Title': process.env.SITE_NAME || 'Website Chat'
                    },
                    responseType: 'stream',
                    timeout: 30000
                }
            );

            const keepAlive = setInterval(() => {
                try { res.write(':\n\n'); } catch (_) {}
            }, 15000);

            const cleanup = () => {
                clearInterval(keepAlive);
                try { response.data.destroy(); } catch (_) {}
            };

            let toolCallBuffer = {};
            let currentToolCallId = null;

            response.data.on('data', async (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            // Don't send [DONE] yet - we need to execute buffered tool calls first
                            // The actual [DONE] will be sent after tool execution in the 'end' handler
                            continue;
                        } else {
                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta;
                                
                                // Check for tool calls
                                if (delta?.tool_calls) {
                                    const toolCall = delta.tool_calls[0];
                                    
                                    // Log each tool call chunk for debugging
                                    console.log('Tool call chunk received:', JSON.stringify(toolCall, null, 2));
                                    
                                    if (toolCall.id) {
                                        currentToolCallId = toolCall.id;
                                        if (!toolCallBuffer[currentToolCallId]) {
                                            toolCallBuffer[currentToolCallId] = {
                                                id: toolCall.id,
                                                name: '',
                                                arguments: ''
                                            };
                                        }
                                        // Also grab name and arguments if provided in same chunk
                                        if (toolCall.function?.name) {
                                            toolCallBuffer[currentToolCallId].name = toolCall.function.name;
                                        }
                                        if (toolCall.function?.arguments) {
                                            toolCallBuffer[currentToolCallId].arguments += toolCall.function.arguments;
                                        }
                                    } else if (currentToolCallId && toolCall.function) {
                                        // Accumulate function arguments
                                        if (toolCall.function.name) {
                                            toolCallBuffer[currentToolCallId].name = toolCall.function.name;
                                        }
                                        if (toolCall.function.arguments) {
                                            toolCallBuffer[currentToolCallId].arguments += toolCall.function.arguments;
                                        }
                                    }
                                } else {
                                    // Regular content streaming
                                    res.write(`data: ${data}\n\n`);
                                }
                            } catch (parseError) {
                                // If parsing fails, just pass through
                                console.log('Parse error, passing through:', data.substring(0, 100));
                                res.write(`data: ${data}\n\n`);
                            }
                        }
                    }
                }
            });

            response.data.on('end', async () => {
                console.log('Stream ended, checking for buffered tool calls');
                
                // Execute any buffered tool calls before ending
                if (currentToolCallId && toolCallBuffer[currentToolCallId]) {
                    const toolCall = toolCallBuffer[currentToolCallId];
                    
                    console.log('Executing tool call:', {
                        name: toolCall.name,
                        argumentsLength: toolCall.arguments?.length,
                        argumentsPreview: toolCall.arguments?.substring(0, 100)
                    });
                    
                    try {
                        // Ensure arguments string is properly formed JSON
                        const argsString = toolCall.arguments?.trim() || '';
                        if (!argsString) {
                            throw new Error('Empty arguments for tool call');
                        }
                        
                        const args = JSON.parse(argsString);
                        let toolResult;

                        if (toolCall.name === 'search_web') {
                            console.log('Starting Brave search for:', args.query);
                            res.write(`data: ${JSON.stringify({ tool_status: 'Searching the web...', tool_name: 'search_web', tool_args: args })}\n\n`);
                            toolResult = await executeBraveSearch(args.query, sessionId);
                            console.log('Search completed, results count:', toolResult.results?.length || 0);
                            res.write(`data: ${JSON.stringify({ tool_result: toolResult, tool_name: 'search_web' })}\n\n`);
                        } else if (toolCall.name === 'fetch_webpage') {
                            console.log('Starting webpage fetch for:', args.url);
                            res.write(`data: ${JSON.stringify({ tool_status: 'Fetching webpage...', tool_name: 'fetch_webpage', tool_args: args })}\n\n`);
                            toolResult = await executeFetchWebpage(args.url, sessionId);
                            console.log('Webpage fetch completed, content length:', toolResult.contentLength || 0);
                            res.write(`data: ${JSON.stringify({ tool_result: toolResult, tool_name: 'fetch_webpage' })}\n\n`);
                        } else if (toolCall.name === 'request_callback') {
                            console.log('Starting callback request for:', args.name);
                            res.write(`data: ${JSON.stringify({ tool_status: 'Scheduling your callback...', tool_name: 'request_callback', tool_args: args })}\n\n`);
                            toolResult = await executeCallbackRequest(args, conversationContext);
                            console.log('Callback request completed, success:', toolResult.success);
                            res.write(`data: ${JSON.stringify({ tool_result: toolResult, tool_name: 'request_callback' })}\n\n`);
                        }

                        // PHASE 2: Send tool result back to AI for analysis
                        if (toolResult) {
                            console.log('Making follow-up API call with tool result...');
                            
                            // Build follow-up messages with tool result
                            const followUpMessages = [
                                ...messages,
                                {
                                    role: 'assistant',
                                    content: null,
                                    tool_calls: [{
                                        id: toolCall.id,
                                        type: 'function',
                                        function: {
                                            name: toolCall.name,
                                            arguments: argsString
                                        }
                                    }]
                                },
                                {
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify(toolResult)
                                }
                            ];

                            // Make follow-up streaming request for AI's analysis
                            const followUpResponse = await axios.post(
                                'https://openrouter.ai/api/v1/chat/completions',
                                {
                                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                                    messages: followUpMessages,
                                    tools: tools,
                                    max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 1000,
                                    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
                                    stream: true
                                },
                                {
                                    headers: {
                                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                                        'Content-Type': 'application/json',
                                        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                                        'X-Title': process.env.SITE_NAME || 'Website Chat'
                                    },
                                    responseType: 'stream',
                                    timeout: 60000
                                }
                            );

                            console.log('Streaming AI analysis response...');

                            // Stream the follow-up response
                            followUpResponse.data.on('data', (chunk) => {
                                const lines = chunk.toString().split('\n').filter(line => line.trim());
                                
                                for (const line of lines) {
                                    if (line.startsWith('data: ')) {
                                        const data = line.slice(6);
                                        
                                        if (data === '[DONE]') {
                                            console.log('Follow-up response complete');
                                            return;
                                        }
                                        
                                        // Forward the analysis response to client
                                        res.write(`data: ${data}\n\n`);
                                    }
                                }
                            });

                            followUpResponse.data.on('end', () => {
                                console.log('Sending [DONE] signal');
                                res.write('data: [DONE]\n\n');
                                console.log('[DONE] signal sent successfully');
                                cleanup();
                                res.end();
                            });

                            followUpResponse.data.on('error', (error) => {
                                console.error('Follow-up stream error:', error);
                                res.write(`data: ${JSON.stringify({ error: 'Analysis failed' })}\n\n`);
                                res.write('data: [DONE]\n\n');
                                cleanup();
                                res.end();
                            });

                            return; // Don't send [DONE] yet, wait for follow-up
                        }

                    } catch (error) {
                        console.error('Tool execution error:', error);
                        console.error('Tool call buffer:', toolCallBuffer[currentToolCallId]);
                        res.write(`data: ${JSON.stringify({ tool_error: `Tool execution failed: ${error.message}` })}\n\n`);
                    }
                }
                
                console.log('Sending [DONE] signal');
                res.write('data: [DONE]\n\n');
                console.log('[DONE] signal sent successfully');
                
                cleanup();
                res.end();
            });

            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                cleanup();
                res.end();
            });

            req.on('close', () => {
                cleanup();
            });

        } else {
            // Non-streaming response with function calling
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                    messages: messages,
                    tools: tools,
                    max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 1000,
                    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                        'X-Title': process.env.SITE_NAME || 'Website Chat'
                    },
                    timeout: 30000
                }
            );

            const choice = response.data.choices[0];
            const aiMessage = choice?.message;

            // Check if AI wants to call a tool
            if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
                const toolCall = aiMessage.tool_calls[0];
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                let toolResult;

                if (functionName === 'search_web') {
                    toolResult = await executeBraveSearch(functionArgs.query, sessionId);
                } else if (functionName === 'fetch_webpage') {
                    toolResult = await executeFetchWebpage(functionArgs.url, sessionId);
                } else if (functionName === 'request_callback') {
                    toolResult = await executeCallbackRequest(functionArgs, conversationContext);
                }

                // Return tool result to frontend
                return res.status(200).json({
                    tool_call: {
                        name: functionName,
                        arguments: functionArgs,
                        result: toolResult
                    },
                    success: true
                });
            }

            // Regular text response
            const aiResponse = aiMessage?.content;

            if (!aiResponse) {
                throw new Error('No response from AI service');
            }

            res.status(200).json({ 
                response: aiResponse,
                success: true 
            });
        }

    } catch (error) {
        console.error('AI chat error:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            return res.status(500).json({ 
                error: 'AI service authentication failed' 
            });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({ 
                error: 'Too many requests. Please wait a moment and try again.' 
            });
        }

        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                error: 'AI service timeout. Please try again.' 
            });
        }

        res.status(500).json({ 
            error: 'Failed to get AI response. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/chat/config
 * Get public chat configuration
 */
router.get('/chat/config', (req, res) => {
    let suggestedQuestions = [];
    if (process.env.CHAT_SUGGESTED_QUESTIONS) {
        suggestedQuestions = process.env.CHAT_SUGGESTED_QUESTIONS
            .split(',')
            .map(q => q.trim())
            .filter(q => q.length > 0);
    }

    res.json({
        available: !!process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
        maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 1000,
        suggestedQuestions: suggestedQuestions,
        webSearchEnabled: process.env.ENABLE_WEB_SEARCH === 'true',
        callbacksEnabled: process.env.ENABLE_CALLBACKS === 'true'
    });
});

/**
 * POST /api/chat/email-transcript
 * Email chat transcript and save lead to database
 */
router.post('/chat/email-transcript', async (req, res) => {
    try {
        const { email, transcript, sessionId } = req.body;

        // Validate input
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }

        if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
            return res.status(400).json({ 
                error: 'Chat transcript is required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        // Format conversation context for database
        const conversationContext = transcript
            .map(msg => `${msg.role === 'user' ? 'User' : 'AI Assistant'}: ${msg.content}`)
            .join('\n\n');

        // Extract any mentioned services or topics from conversation
        const conversationText = transcript.map(m => m.content).join(' ').toLowerCase();
        let detectedService = null;
        
        const serviceKeywords = {
            'ai assistant': ['ai assistant', 'chatbot', 'automation', 'ai chat'],
            'seo': ['seo', 'search engine', 'google ranking', 'local seo'],
            'website': ['website', 'web design', 'web development', 'site'],
            'social media': ['social media', 'facebook', 'instagram', 'linkedin', 'social'],
            'crm': ['crm', 'sales funnel', 'lead', 'pipeline'],
            'analytics': ['analytics', 'reporting', 'data', 'insights', 'growth strategy']
        };

        for (const [service, keywords] of Object.entries(serviceKeywords)) {
            if (keywords.some(keyword => conversationText.includes(keyword))) {
                detectedService = service;
                break;
            }
        }

        // Save lead to database with source='download_chat'
        const result = await pool.query(
            `INSERT INTO callback_requests 
             (name, phone, email, preferred_contact_method, preferred_time, message, conversation_context, source, service, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') 
             RETURNING id, created_at`,
            [
                'Chat Download Request', // name - we don't have it yet
                null, // phone
                email,
                'email', // preferred contact method
                'ASAP',
                'Requested chat transcript download',
                conversationContext,
                'download_chat', // source type
                detectedService // detected service from conversation
            ]
        );

        const leadId = result.rows[0].id;
        const createdAt = result.rows[0].created_at;
        const referenceId = `DL-${new Date(createdAt).getTime()}-${leadId}`;

        // Format transcript for email (HTML)
        const formattedTranscript = transcript.map(msg => {
            const isUser = msg.role === 'user';
            const backgroundColor = isUser ? '#f3f4f6' : '#e0f2fe';
            const alignment = isUser ? 'right' : 'left';
            const label = isUser ? 'You' : 'Websited AI';
            const labelColor = isUser ? '#6b7280' : '#0369a1';
            
            return `
                <div style="margin-bottom: 20px; text-align: ${alignment};">
                    <div style="display: inline-block; max-width: 80%; text-align: left;">
                        <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: 600; color: ${labelColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
                        <div style="background: ${backgroundColor}; padding: 12px 16px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <p style="margin: 0; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${msg.content}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const currentDate = new Date().toLocaleDateString('en-AU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });

        // Send transcript email to customer
        const customerEmailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            'h:Reply-To': process.env.EMAIL_FROM,
            subject: `Your Websited Chat Transcript - ${currentDate}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 700px; margin: 0 auto; }
                        .header { background: linear-gradient(135deg, #1E40AF 0%, #8B5CF6 100%); color: white; padding: 40px 30px; text-align: center; }
                        .content { background: #ffffff; padding: 40px 30px; }
                        .transcript-container { background: #f9fafb; padding: 30px; border-radius: 12px; margin: 30px 0; border: 1px solid #e5e7eb; }
                        .cta-box { background: linear-gradient(135deg, #C4EF17 0%, #a3d916 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0; }
                        .cta-button { display: inline-block; background: #0f0f23; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
                        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding: 30px; background: #f9fafb; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 32px;">📧 Your Chat Transcript</h1>
                            <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.95;">${currentDate}</p>
                        </div>
                        <div class="content">
                            <p style="font-size: 16px; margin-top: 0;">Hi there! 👋</p>
                            <p style="font-size: 16px;">Here's a copy of your conversation with our Websited AI assistant. We've saved this for your records and our team has been notified of your interest.</p>
                            
                            <div class="transcript-container">
                                <h2 style="margin-top: 0; color: #1a1a2e; font-size: 20px;">Your Conversation</h2>
                                ${formattedTranscript}
                            </div>
                            
                            <div class="cta-box">
                                <h3 style="margin: 0 0 15px 0; color: #0f0f23; font-size: 24px;">Ready to Take the Next Step?</h3>
                                <p style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 16px;">Let's discuss how we can help grow your business with AI-powered marketing.</p>
                                <a href="${process.env.SITE_URL}/contact/" class="cta-button">
                                    📞 Schedule a Free Consultation
                                </a>
                            </div>
                            
                            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 30px 0;">
                                <strong>💡 Quick Tip:</strong> Our team typically responds within 24 hours. If you have urgent questions, feel free to call or email us directly!
                            </p>
                            
                            <div class="footer">
                                <p style="margin: 0 0 15px 0;"><strong style="color: #1a1a2e; font-size: 18px;">Websited</strong></p>
                                <p style="margin: 0 0 8px 0;">AI & Digital Marketing Solutions</p>
                                <p style="margin: 0 0 8px 0;">2 Martin Place, Sydney, NSW 2000, Australia</p>
                                <p style="margin: 0 0 15px 0;">
                                    📧 <a href="mailto:hello@simplepage.com.au" style="color: #1E40AF; text-decoration: none;">hello@simplepage.com.au</a> |
                                    🌐 <a href="${process.env.SITE_URL}" style="color: #1E40AF; text-decoration: none;">websited.org</a>
                                </p>
                                <p style="margin: 20px 0 0 0; font-size: 12px; color: #9ca3af;">
                                    Reference ID: ${referenceId}<br>
                                    You're receiving this because you requested a copy of your chat transcript.
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Your Websited Chat Transcript - ${currentDate}\n\n${transcript.map(msg => `${msg.role === 'user' ? 'You' : 'Websited AI'}: ${msg.content}`).join('\n\n')}\n\nReady to take the next step?\n\nLet's discuss how we can help grow your business with AI-powered marketing.\nSchedule a free consultation: ${process.env.SITE_URL}/contact/\n\nWebsited - AI & Digital Marketing Solutions\n2 Martin Place, Sydney, Australia\nhello@simplepage.com.au | ${process.env.SITE_URL}\n\nReference ID: ${referenceId}`
        };

        await mg.messages().send(customerEmailData);
        console.log(`✅ Chat transcript sent to ${email}`);

        // Send notification to admin
        const recipients = process.env.RECIPIENT_EMAIL.split(',').map(e => e.trim());
        const adminEmailData = {
            from: process.env.EMAIL_FROM,
            to: recipients,
            subject: '💬 New Chat Transcript Download Request - Websited',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #8B5CF6 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
                        .info-box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8B5CF6; }
                        .transcript-preview { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; max-height: 300px; overflow-y: auto; }
                        .cta-button { display: inline-block; background: #C4EF17; color: #0f0f23; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 28px;">💬 New Chat Download Request</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">A visitor requested their chat transcript</p>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
                                <p style="margin: 0 0 10px 0;"><strong>Session ID:</strong> ${sessionId || 'Not provided'}</p>
                                <p style="margin: 0 0 10px 0;"><strong>Detected Service:</strong> ${detectedService || 'General inquiry'}</p>
                                <p style="margin: 0 0 10px 0;"><strong>Reference ID:</strong> ${referenceId}</p>
                                <p style="margin: 0;"><strong>Date:</strong> ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEDT</p>
                            </div>
                            
                            <h3 style="color: #1a1a2e; margin-top: 30px;">Conversation Preview:</h3>
                            <div class="transcript-preview">
                                <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #4b5563;">${conversationContext.substring(0, 800)}${conversationContext.length > 800 ? '...\n\n[View full transcript in dashboard]' : ''}</p>
                            </div>
                            
                            <center>
                                <a href="${process.env.SITE_URL}/admin/callbacks.html?id=${leadId}" class="cta-button">
                                    View Full Details in Dashboard
                                </a>
                            </center>
                            
                            <div class="footer">
                                <p style="margin: 0;">This lead has been automatically saved to your database with source type: <strong>Download Chat</strong></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `New Chat Transcript Download Request\n\nEmail: ${email}\nSession ID: ${sessionId || 'Not provided'}\nDetected Service: ${detectedService || 'General inquiry'}\nReference ID: ${referenceId}\nDate: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEDT\n\nConversation Preview:\n${conversationContext.substring(0, 500)}${conversationContext.length > 500 ? '...' : ''}\n\nView full details: ${process.env.SITE_URL}/admin/callbacks.html?id=${leadId}`
        };

        await mg.messages().send(adminEmailData);
        console.log(`✅ Admin notification sent for chat download lead #${leadId}`);

        res.status(200).json({
            success: true,
            message: 'Chat transcript sent successfully! Check your email.',
            referenceId: referenceId
        });

    } catch (error) {
        console.error('Email transcript error:', error.message);
        
        if (error.code === '23514') { // CHECK constraint violation
            return res.status(500).json({
                error: 'Database configuration error. Please contact support.',
                details: process.env.NODE_ENV === 'development' ? 'download_chat source type may not be enabled in database' : undefined
            });
        }

        res.status(500).json({
            error: 'Failed to send transcript. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
