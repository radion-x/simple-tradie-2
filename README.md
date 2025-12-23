# 🌐 Reusable Website Template with AI Chat & Email Forms

A complete, production-ready website template with integrated email forms (via Mailgun) and AI chat widget (via OpenRouter). Perfect for quickly launching new business websites with professional contact capabilities.

## ✨ Features

- **📧 Email Contact Forms**: Fully functional contact form with Mailgun integration
- **🤖 AI Chat Widget**: Floating chat widget powered by OpenRouter AI
- **📱 Fully Responsive**: Works perfectly on desktop, tablet, and mobile
- **🎨 Modern Design**: Clean, professional UI with smooth animations
- **⚡ Fast & Lightweight**: Optimized for performance
- **🔧 Easy to Customize**: Change colors, content, and branding in minutes
- **🔒 Secure**: Built-in security headers and validation

## 📂 Project Structure

```
website-template/
├── public/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── styles.css      # All styling
│   └── js/
│       ├── formHandler.js  # Contact form logic
│       ├── aiChat.js       # AI chat widget logic
│       └── main.js         # General site functionality
├── routes/
│   ├── email.js            # Email sending API endpoint
│   └── ai.js               # AI chat API endpoint
├── server.js               # Express server
├── package.json            # Dependencies
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Clone or Copy This Template

```bash
# Copy this entire folder to your new project
cp -r website-template my-new-website
cd my-new-website
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your actual credentials
nano .env  # or use your preferred editor
```

**Required Configuration:**

- **Mailgun**: Get API key from [mailgun.com](https://www.mailgun.com)
- **OpenRouter**: Get API key from [openrouter.ai](https://openrouter.ai/keys)

### 4. Customize Your Business Details

Open `.env` and update:

```bash
RECIPIENT_EMAIL=your-email@example.com
OPENROUTER_SYSTEM_PROMPT="You are an AI assistant for [Your Business Name]..."
```

### 5. Run the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Visit: `http://localhost:3000`

## 🎨 Customization Guide

### Update Business Information

Edit `public/index.html`:

1. **Company Name**: Search for "Your Business" and replace
2. **Services**: Update the service cards in the Services section
3. **Contact Info**: Change phone, email, address in Contact section
4. **About Section**: Update the "About Us" content

### Change Colors & Branding

Edit `public/css/styles.css`:

```css
:root {
    --primary-color: #2563eb;     /* Main brand color */
    --secondary-color: #1e40af;   /* Secondary/hover color */
    /* Change these to match your brand */
}
```

### Customize AI Chat Prompt

Edit `.env`:

```bash
OPENROUTER_SYSTEM_PROMPT="You are a helpful AI assistant for [Your Company]. 
Answer questions about [your services]. 
Be professional and friendly. 
For urgent matters, direct users to call [your phone]."
```

### Add Your Logo

Replace the text logo in `index.html`:

```html
<!-- Replace this: -->
<div class="logo">Your Business</div>

<!-- With an image: -->
<div class="logo">
    <img src="images/logo.png" alt="Your Business" height="40">
</div>
```

### Modify Form Fields

Edit the contact form in `index.html` to add/remove fields:

```html
<div class="form-group">
    <label for="newfield">New Field *</label>
    <input type="text" id="newfield" name="newfield" required>
</div>
```

## 📧 Email Configuration

### Mailgun Setup

1. Sign up at [mailgun.com](https://www.mailgun.com)
2. Add and verify your domain
3. Get your API key from Account Settings
4. Update `.env` with your credentials

### Email Templates

Customize the email templates in `routes/email.js`:

- **Admin notification**: Email sent to you
- **Auto-reply**: Email sent to customer

## 🤖 AI Chat Configuration

### OpenRouter Setup

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Get your API key from [openrouter.ai/keys](https://openrouter.ai/keys)
3. Choose a model (see [openrouter.ai/models](https://openrouter.ai/models))

### Available Models

**Free Options** (great for testing):
- `tngtech/deepseek-r1t2-chimera:free`
- `google/gemini-flash-1.5:free`

**Paid Options** (better quality):
- `openai/gpt-4o` - Best overall
- `openai/gpt-3.5-turbo` - Fast and cheap
- `anthropic/claude-3.5-sonnet` - Excellent quality

### Chat Customization

Edit `public/js/aiChat.js` to:
- Change welcome message
- Modify chat appearance
- Add quick reply buttons
- Customize behavior

## 🌐 Deployment

### Deploy to Heroku

```bash
# Install Heroku CLI, then:
heroku create your-app-name
heroku config:set MAILGUN_API_KEY=your-key
heroku config:set OPENROUTER_API_KEY=your-key
heroku config:set RECIPIENT_EMAIL=your-email
# ... set other env vars
git push heroku main
```

### Deploy to Vercel

```bash
# Install Vercel CLI, then:
vercel
# Follow prompts and add environment variables in dashboard
```

### Deploy to DigitalOcean/VPS

```bash
# SSH into your server
git clone your-repo
cd your-repo
npm install
pm2 start server.js --name "my-website"
```

## 🔒 Security Best Practices

1. **Never commit `.env`** - It's in `.gitignore` by default
2. **Use environment variables** for all sensitive data
3. **Enable rate limiting** in production (add express-rate-limit)
4. **Use HTTPS** in production
5. **Validate all inputs** on both client and server

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Email not sending?

- Check Mailgun API key and domain in `.env`
- Verify your domain in Mailgun dashboard
- Check server logs for errors

### AI chat not working?

- Verify OpenRouter API key in `.env`
- Check if you have credits (for paid models)
- Try a free model first
- Check browser console for errors

### Server won't start?

```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
```

## 📝 License

MIT License - feel free to use for personal or commercial projects

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the code comments
3. Check Mailgun and OpenRouter documentation

## 🎯 Next Steps

After setup:

1. ✅ Test the contact form
2. ✅ Test the AI chat
3. ✅ Customize colors and branding
4. ✅ Update all business information
5. ✅ Add your logo and images
6. ✅ Test on mobile devices
7. ✅ Deploy to production
8. ✅ Set up analytics (Google Analytics, etc.)

---

**Built with ❤️ for rapid website development**

Start building your next website in minutes, not days!
