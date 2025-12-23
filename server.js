require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
const callbackRoutes = require('./routes/callbacks');
const initDatabase = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (for Coolify/Docker health checks)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api', emailRoutes);
app.use('/api', aiRoutes);
app.use('/api', callbackRoutes);

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
(async () => {
    try {
        await initDatabase();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
        console.log(`📧 Email API: http://localhost:${PORT}/api/send-email`);
        console.log(`🤖 AI Chat API: http://localhost:${PORT}/api/chat`);
        console.log(`📞 Callbacks API: http://localhost:${PORT}/api/callbacks`);
        console.log(`🔧 Admin Dashboard: http://localhost:${PORT}/admin/callbacks.html`);
        console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    });
})();

module.exports = app;
