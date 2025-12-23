const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Simple password authentication middleware
const authenticate = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    const adminPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

    if (!adminPassword) {
        return res.status(500).json({ error: 'Admin authentication not configured' });
    }

    if (password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

/**
 * Test endpoint to check database schema (no auth for debugging)
 * GET /api/callbacks/test-schema
 */
router.get('/test-schema', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'callback_requests'
            ORDER BY ordinal_position
        `);
        
        res.status(200).json({
            success: true,
            columns: result.rows
        });
    } catch (error) {
        console.error('Schema check error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Admin login endpoint
 * POST /api/admin/login
 */
router.post('/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

        if (!adminPassword) {
            return res.status(500).json({ 
                success: false, 
                error: 'Admin authentication not configured' 
            });
        }

        if (password === adminPassword) {
            return res.status(200).json({ 
                success: true, 
                message: 'Authentication successful' 
            });
        } else {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid password' 
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Login failed' 
        });
    }
});

/**
 * Get all callback requests with filtering and pagination
 * GET /api/callbacks
 * Query params: status, source, page, limit, startDate, endDate, search
 */
router.get('/callbacks', authenticate, async (req, res) => {
    try {
        const { 
            status,
            source,
            page = 1, 
            limit = 50, 
            startDate, 
            endDate,
            search 
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build dynamic query
        let query = 'SELECT * FROM callback_requests WHERE 1=1';
        const params = [];
        let paramCount = 1;

        // Filter by status
        if (status && ['pending', 'contacted', 'completed'].includes(status)) {
            query += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        // Filter by source
        if (source && ['chatbot', 'contact_form', 'footer_form'].includes(source)) {
            query += ` AND source = $${paramCount}`;
            params.push(source);
            paramCount++;
        }

        // Filter by date range
        if (startDate) {
            query += ` AND created_at >= $${paramCount}`;
            params.push(startDate);
            paramCount++;
        }

        if (endDate) {
            query += ` AND created_at <= $${paramCount}`;
            params.push(endDate + ' 23:59:59');
            paramCount++;
        }

        // Search by name or email
        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        // Count total matching records
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Add ordering and pagination
        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get callbacks error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve callbacks' 
        });
    }
});

/**
 * Get a single callback request by ID
 * GET /api/callbacks/:id
 */
router.get('/callbacks/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM callback_requests WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Callback not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get callback error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve callback' 
        });
    }
});

/**
 * Update callback status
 * PATCH /api/callbacks/:id
 */
router.patch('/callbacks/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!['pending', 'contacted', 'completed'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid status. Must be: pending, contacted, or completed' 
            });
        }

        const result = await pool.query(
            'UPDATE callback_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Callback not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0],
            message: `Callback status updated to ${status}`
        });
    } catch (error) {
        console.error('Update callback error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update callback' 
        });
    }
});

/**
 * Get callback statistics
 * GET /api/callbacks/stats
 */
router.get('/callbacks-stats', authenticate, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30_days
            FROM callback_requests
        `;

        const result = await pool.query(statsQuery);

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve statistics' 
        });
    }
});

module.exports = router;
