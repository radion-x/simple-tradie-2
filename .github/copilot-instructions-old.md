# Websited Landing Page - AI Agent Instructions

## Project Overview
This is a marketing landing page for Websited (AI & Digital Marketing agency) with integrated AI chat widget and contact forms. Built with vanilla JavaScript, Express.js backend, real-time streaming AI chat via OpenRouter, and Mailgun email integration.

## Architecture & Data Flow

### Core Components
- **Frontend**: Single-page vanilla JS application (`public/index.html` + modular JS)
- **Backend**: Express.js server (`server.js`) with two main API routes
- **AI Chat**: Real-time streaming via Server-Sent Events (SSE) from OpenRouter API
- **Email**: Mailgun integration for contact form submissions

### Data Flow Pattern
1. **AI Chat Streaming**: Client → `/api/chat` (POST) → OpenRouter API → SSE stream → `requestAnimationFrame` rendering → Formatted HTML display
2. **Contact Forms**: Client validation → `/api/send-email` (POST) → Mailgun → Dual emails (admin notification + customer auto-reply)

### Key Design Decision: Character-by-Character Streaming
The AI chat uses `requestAnimationFrame` batching (60fps) to update formatted markdown content smoothly during streaming. This prevents jerky rendering while maintaining character-by-character appearance. See `public/js/aiChat.js:handleStreamingResponse()`.

## Critical Developer Workflows

### Starting the Server
```bash
npm run dev          # Development with nodemon auto-reload
node server.js       # Production (port 3000)
pkill -f "node server.js" && sleep 1 && node server.js &  # Restart background process
```

### Environment Setup
Copy `.env` and configure:
- `OPENROUTER_API_KEY` - Required for AI chat (get from openrouter.ai/keys)
- `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` - Required for email forms
- `OPENROUTER_SYSTEM_PROMPT` - Single comprehensive prompt defining AI personality, services, and conversation strategy

### Testing the Stack
1. Health check: `curl http://localhost:3000/health`
2. AI chat: Open browser console, send message via chat widget
3. Email form: Fill contact form, check both admin and customer emails

## Project-Specific Conventions

### 1. Markdown Formatting in AI Chat (`public/js/aiChat.js`)
**Critical**: AI responses may contain broken unicode sequences (`u2022` instead of `•`). The `formatMessage()` function preprocesses these before rendering:
```javascript
// First fix broken unicode, THEN process markdown
formatted.replace(/u2022/g, '• ').replace(/u2019/g, "'")
```
Order matters: unicode fixes → headers → bold/italic → lists → emojis → line breaks.

### 2. Modern Gradient Design System (`public/css/styles.css`)
Uses CSS custom properties with gradient-based color system:
- Primary gradient: `--gradient-primary` (indigo → purple → pink)
- All major headings use `clamp()` for fluid responsive typography
- Glassmorphism effects: `backdrop-filter: blur(20px)` on header and modals
- Animated backgrounds via `@keyframes pulse` in hero section

### 3. Streaming Response Optimization
**Why**: Prevents visible color changes during markdown formatting (e.g., text turning from black to purple mid-stream).
**How**: 
- Accumulate chunks in `fullResponse` buffer
- Use `requestAnimationFrame` to batch DOM updates at 60fps
- Apply full markdown formatting on each frame (not just new content)
- User scroll detection pauses auto-scroll during streaming

### 4. Email Template Structure (`routes/email.js`)
Two email templates in single endpoint:
1. **Admin notification**: Full form data to `RECIPIENT_EMAIL`
2. **Auto-reply**: Branded thank-you message to customer
Both use inline HTML with Tailwind-inspired utility classes.

## Integration Points

### OpenRouter API (AI Chat)
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Headers**: Requires `HTTP-Referer` and `X-Title` for tracking
- **Streaming**: Use `responseType: 'stream'` in axios, parse SSE format (`data: [JSON]\n\n`)
- **Conversation History**: Send last 10 messages in `history` array (role + content objects)
- **Keep-Alive**: 15-second ping (`:` comment) prevents proxy timeouts
- **Model**: Currently using `deepseek/deepseek-chat-v3-0324` (see `.env`)

### Mailgun Integration
- **Region-aware**: Uses `MAILGUN_REGION` (default: `api`) to build base URL
- **Multiple recipients**: `RECIPIENT_EMAIL` supports comma-separated list
- **Domain setup**: Must verify domain in Mailgun dashboard first
- **Error handling**: Returns user-friendly messages (never expose API details)

## Common Patterns & Anti-Patterns

### ✅ Do This
- Always preprocess unicode artifacts before markdown rendering
- Batch DOM updates with `requestAnimationFrame` for smooth streaming
- Use semantic HTML5 elements (`<strong>`, `<em>`, `<h3>`) not styled `<span>`
- Validate forms on both client (`formHandler.js`) and server (`routes/email.js`)
- Use CSS custom properties for all colors/spacing (never hardcode hex values)

### ❌ Avoid This
- Don't use `textContent` during streaming (breaks formatting) - use `innerHTML` with sanitized markdown
- Never expose `.env` values in frontend code (fetch via `/api/chat/config` endpoint)
- Don't parse markdown character-by-character (causes flashing) - parse full accumulated text
- Avoid inline styles in HTML - all styling via `styles.css` custom properties
- Don't add transitions to heading elements in chat (causes visible formatting changes)

## File Dependencies Map
- `server.js` → requires `routes/email.js`, `routes/ai.js`
- `public/index.html` → loads `styles.css`, `formHandler.js`, `aiChat.js`, `main.js` (in order)
- `routes/ai.js` → depends on `.env` vars: `OPENROUTER_*`
- `routes/email.js` → depends on `.env` vars: `MAILGUN_*`, `EMAIL_*`
- `public/js/aiChat.js` → fetches `/api/chat/config` for suggested questions
- All CSS → uses custom properties from `:root` in `styles.css` lines 1-50

## Environment Variables Reference
See `.env` for full list. Critical ones:
- `OPENROUTER_USE_STREAMING=true` - Enables SSE streaming (false = single response)
- `OPENROUTER_SYSTEM_PROMPT` - Complete AI personality (400+ line prompt with services, strategy, boundaries)
- `CHAT_SUGGESTED_QUESTIONS` - Comma-separated list shown on chat open
- `NODE_ENV=production` - Affects error message verbosity

## Debugging Tips
1. **AI chat not streaming**: Check browser Network tab for `text/event-stream` content-type
2. **Unicode artifacts (`u2022`)**: Add pattern to `formatMessage()` preprocessing section
3. **Email not sending**: Verify Mailgun domain is verified (check dashboard)
4. **CSS not updating**: Hard refresh (`Cmd+Shift+R`) - browser caches aggressively
5. **Server won't restart**: Check port 3000 with `lsof -ti:3000` and kill process

## Key Files to Reference
- `routes/ai.js:52-100` - SSE streaming implementation with proxy-safe headers
- `public/js/aiChat.js:148-200` - Markdown formatter with unicode preprocessing
- `public/js/aiChat.js:295-370` - Streaming response handler with `requestAnimationFrame`
- `public/css/styles.css:1-50` - Design system custom properties
- `.env:40-110` - Complete AI system prompt (defines conversation strategy)
