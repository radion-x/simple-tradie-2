const express = require('express');
const router = express.Router();
const mailgun = require('mailgun-js');
const pool = require('../db/pool');

// Initialize Mailgun
const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    host: process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net'
});

/**
 * POST /api/send-email
 * Send contact form emails via Mailgun
 */
router.post('/send-email', async (req, res) => {
    try {
        const { name, email, phone, service, message, suburb, vehicleType, timing, notes } = req.body;

        // Determine if this is a blue slip quote or general contact
        const isBlueSlipQuote = suburb && vehicleType;

        // Validate required fields based on form type
        if (isBlueSlipQuote) {
            // Blue slip quote form validation
            if (!name || !phone || !suburb || !vehicleType) {
                return res.status(400).json({
                    error: 'Name, phone, suburb, and vehicle type are required'
                });
            }
        } else {
            // General contact form validation
            if (!name || !email || !message) {
                return res.status(400).json({
                    error: 'Name, email, and message are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email format'
                });
            }
        }

        // Build email HTML content
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E40AF, #8B5CF6); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                    .field { margin-bottom: 20px; }
                    .label { font-weight: bold; color: #1f2937; margin-bottom: 5px; }
                    .value { background: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .urgent { background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 4px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin: 0;">${isBlueSlipQuote ? '🚗 New Blue Slip Quote Request' : '🚀 New Growth Strategy Inquiry'}</h2>
                    </div>
                    <div class="content">
                        <div class="field">
                            <div class="label">Name:</div>
                            <div class="value">${name}</div>
                        </div>
                        ${isBlueSlipQuote ? `
                        <div class="field">
                            <div class="label">Phone:</div>
                            <div class="value"><a href="tel:${phone}">${phone}</a></div>
                        </div>
                        <div class="field">
                            <div class="label">Suburb:</div>
                            <div class="value">${suburb}</div>
                        </div>
                        <div class="field">
                            <div class="label">Vehicle Type:</div>
                            <div class="value">${vehicleType}</div>
                        </div>
                        ${timing ? `
                        <div class="field">
                            <div class="label">Timeframe:</div>
                            <div class="value">${timing}</div>
                        </div>
                        ` : ''}
                        ${notes ? `
                        <div class="field">
                            <div class="label">Additional Notes:</div>
                            <div class="value">${notes.replace(/\n/g, '<br>')}</div>
                        </div>
                        ` : ''}
                        ${timing === 'today' || timing === 'tomorrow' ? `
                        <div class="urgent">
                            <strong>⚡ URGENT:</strong> Customer needs service ${timing}!
                        </div>
                        ` : ''}
                        ` : `
                        <div class="field">
                            <div class="label">Email:</div>
                            <div class="value"><a href="mailto:${email}">${email}</a></div>
                        </div>
                        ${phone ? `
                        <div class="field">
                            <div class="label">Phone:</div>
                            <div class="value"><a href="tel:${phone}">${phone}</a></div>
                        </div>
                        ` : ''}
                        ${service ? `
                        <div class="field">
                            <div class="label">Service Interested In:</div>
                            <div class="value">${service}</div>
                        </div>
                        ` : ''}
                        <div class="field">
                            <div class="label">Message:</div>
                            <div class="value">${message.replace(/\n/g, '<br>')}</div>
                        </div>
                        `}
                    </div>
                    <div class="footer">
                        <p>This email was sent from your website ${isBlueSlipQuote ? 'quote' : 'contact'} form.</p>
                        <p>Received on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Save to database before sending email
        try {
            const query = `
                INSERT INTO callback_requests (
                    name, 
                    phone, 
                    email, 
                    message, 
                    service,
                    source,
                    preferred_contact_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;
            
            const values = [
                name,
                phone || null,
                email || null,
                isBlueSlipQuote 
                    ? `Blue Slip Quote - ${suburb}, ${vehicleType}${timing ? `, Timeframe: ${timing}` : ''}${notes ? `\n\nNotes: ${notes}` : ''}`
                    : message,
                service || (isBlueSlipQuote ? 'Blue Slip Quote' : null),
                'contact_form',
                email ? 'email' : 'phone'
            ];
            
            console.log('💾 Saving contact form to database:', { name, phone, email, service, source: 'contact_form' });
            const result = await pool.query(query, values);
            console.log(`✅ Contact form submission saved to database (ID: ${result.rows[0].id})`);
        } catch (dbError) {
            console.error('❌ Database save error:', dbError);
            console.error('❌ Error details:', dbError.message);
            console.error('❌ Query failed for:', { name, phone, email, service });
            
            // TEMPORARY: Return error to client for debugging
            return res.status(500).json({
                error: 'Database save failed: ' + dbError.message,
                details: dbError.detail || 'Check if database columns exist (source, service)'
            });
        }

        // Plain text version
        const textContent = isBlueSlipQuote ? `
New Blue Slip Quote Request

Name: ${name}
Phone: ${phone}
Suburb: ${suburb}
Vehicle Type: ${vehicleType}
${timing ? `Timeframe: ${timing}` : ''}
${notes ? `Notes: ${notes}` : ''}

${timing === 'today' || timing === 'tomorrow' ? `⚡ URGENT: Customer needs service ${timing}!\n` : ''}
Received on ${new Date().toLocaleString()}
        ` : `
New Growth Strategy Inquiry from Websited.org

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${service ? `Service Interest: ${service}` : ''}

Message:
${message}

Received on ${new Date().toLocaleString()}
        `;

        // Email data
        const emailData = {
            from: `Websited <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: process.env.RECIPIENT_EMAIL || 'hello@simplepage.com.au',
            subject: isBlueSlipQuote
                ? `🚗 Blue Slip Quote: ${name} - ${suburb} (${vehicleType})${timing === 'today' || timing === 'tomorrow' ? ' - URGENT' : ''}`
                : `🚀 New Growth Inquiry: ${name}${service ? ` - ${service}` : ''}`,
            html: emailContent,
            text: textContent,
            'h:Reply-To': isBlueSlipQuote ? undefined : email
        };

        // Send email
        await mg.messages().send(emailData);

        // Send auto-reply to customer (only if they provided an email)
        if (email) {
            const autoReplyData = {
                from: `Websited <noreply@${process.env.MAILGUN_DOMAIN}>`,
                to: email,
                subject: 'Thank you for contacting Websited',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #1E40AF, #8B5CF6); color: white; padding: 20px; text-align: center; }
                            .content { padding: 30px; background: #f9fafb; }
                            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h2 style="margin: 0;">Thank You for Contacting Websited!</h2>
                            </div>
                            <div class="content">
                                <p>Hi ${name},</p>
                                <p>Thank you for reaching out to us about growing your business. We've received your inquiry and our growth strategists will get back to you within 24 hours.</p>
                                <p>In the meantime, feel free to explore our <a href="https://websited.org">website</a> to learn more about our AI and digital marketing solutions.</p>
                                <p>Best regards,<br>The Websited Team</p>
                            </div>
                            <div class="footer">
                                <p>This is an automated response. Please do not reply to this email.</p>
                                <p>2 Martin Place, Sydney, Australia</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `Hi ${name},\n\nThank you for reaching out to us about growing your business. We've received your inquiry and our growth strategists will get back to you within 24 hours.\n\nBest regards,\nThe Websited Team`
            };

            // Send auto-reply (don't wait for it, send in background)
            mg.messages().send(autoReplyData).catch(err => {
                console.error('Auto-reply error:', err);
            });
        }

        res.status(200).json({
            message: 'Thank you! Your message has been sent successfully. We\'ll get back to you soon.',
            success: true
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ 
            error: 'Failed to send email. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
