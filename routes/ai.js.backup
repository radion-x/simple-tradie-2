const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * POST /api/chat
 * Handle AI chat messages using OpenRouter API
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;

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

        if (useStreaming) {
            // Streaming response
            // Proxy-friendly SSE headers (for nginx/Coolify): disable buffering and prevent transforms
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            // Flush headers early so clients can start receiving the stream immediately
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                    messages: messages,
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

            // Keep connection alive for intermediaries that may close idle streams
            const keepAlive = setInterval(() => {
                try { res.write(':\n\n'); } catch (_) {}
            }, 15000);

            const cleanup = () => {
                clearInterval(keepAlive);
                try { response.data.destroy(); } catch (_) {}
            };

            // Pipe the streaming response to client
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            res.write('data: [DONE]\n\n');
                        } else {
                            res.write(`data: ${data}\n\n`);
                        }
                    }
                }
            });

            response.data.on('end', () => {
                cleanup();
                res.end();
            });

            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                cleanup();
                res.end();
            });

            // Client aborted the request before stream ended
            req.on('close', () => {
                cleanup();
            });

        } else {
            // Non-streaming response (original code)
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                    messages: messages,
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

            // Extract AI response
            const aiResponse = response.data.choices[0]?.message?.content;

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
        
        // Handle specific error cases
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
 * Get public chat configuration (optional endpoint)
 */
router.get('/chat/config', (req, res) => {
    // Parse suggested questions from environment variable
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
        suggestedQuestions: suggestedQuestions
    });
});

module.exports = router;
