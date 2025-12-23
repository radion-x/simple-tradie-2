# Websited Landing Page - AI Agent Instructions

## Project Overview
Multi-page marketing website for Websited (AI & Digital Marketing agency) with **AI chat widget on all 22 pages**, PostgreSQL lead database, admin dashboard, and dual-email contact system. Built with vanilla JavaScript, Express.js backend, real-time streaming AI chat via OpenRouter (with function calling), Mailgun email integration, and PostgreSQL database. **Deployed via Docker on Coolify platform to websited.au.**

### Core Features
- **AI Chat Widget** (22 pages): Floating chat with SSE streaming, markdown formatting, function calling (web search, webpage fetch, callback scheduling), and email transcript download with lead capture
- **Lead Database**: PostgreSQL with 4 source types (chatbot, contact_form, footer_form, download_chat), service detection, status tracking
- **Admin Dashboard**: Password-protected at `/admin/callbacks.html` with filtering by source/status, date ranges, search
- **Dual Email System**: Mailgun integration with admin notifications + customer auto-replies on both contact forms and chat transcripts
- **Function Calling**: AI can search web (Brave API), fetch webpages (Cheerio scraping), schedule callbacks (database insertion)

## Site Architecture (Multi-Page Structure)

### Page Hierarchy
```
public/
├── index.html                          # Homepage (hero, services overview, FAQ, testimonials)
├── about/index.html                    # Company info
├── contact/index.html                  # Contact form
├── service/index.html                  # Main services landing page ⭐ NEW
│   ├── ai-assistants/index.html       # AI/chatbot services
│   ├── website-development/index.html # Web dev services
│   ├── seo-local-seo/index.html       # SEO services
│   ├── social-growth/index.html       # Social media services
│   ├── crm-sales-funnel/index.html    # CRM/sales services
│   └── growth-strategy-analytics/     # Analytics services
├── industries/{industry}/index.html    # 6 industry pages (healthcare, real-estate, etc.)
├── blog/index.html                     # Blog (placeholder)
└── case-studies/index.html             # Case studies (placeholder)
```

### Navigation Structure
- **Fixed header** at top (80px height, backdrop-filter blur, z-index: 1000)
- **Main nav**: Home → About → Services (dropdown) → Industries (dropdown) → Contact
- **Services dropdown**: Reveals 6 service subpages on hover/click, main "Services" link → `/service/`
- **Breadcrumbs**: On all service/industry pages, format: `Home > Services > {Service Name}`
  - **Critical**: Must have `margin-top: 80px` to clear fixed header
  - **Centering**: Use flexbox on container `<div>` (not outer `<section>`) with `display: flex; align-items: center; min-height: 56px`

### Backend Components
- **Express.js server** (`server.js`): Serves static files from `public/`, mounts API routes at `/api`, initializes PostgreSQL database
- **Three route modules** (`routes/`):
  1. **ai.js** - AI chat endpoints (`/api/chat`, `/api/chat/email-transcript`, `/api/chat/config`)
  2. **email.js** - Contact form endpoint (`/api/send-email`)
  3. **callbacks.js** - Admin dashboard API (`/api/callbacks`, `/api/admin/login`, CRUD operations)
- **PostgreSQL database** (`db/`):
  - `pool.js` - Connection pool configuration
  - `init.js` - Automatic migration runner (runs on container startup)
  - `schema.sql` - Fresh database schema for new installations
  - `migrations/*.sql` - Version-controlled schema changes

## Database Architecture & Lead Management

### PostgreSQL Database Structure
**Primary table**: `callback_requests` (unified lead capture from all sources)
- **Fields**:
  - `id` (SERIAL PRIMARY KEY) - Auto-incrementing lead ID
  - `name` (VARCHAR 255) - Customer name (or "Chat Download Request" for transcripts)
  - `phone` (VARCHAR 50) - Customer phone (nullable)
  - `email` (VARCHAR 255) - Customer email (nullable)
  - `preferred_contact_method` (VARCHAR 20) - CHECK: 'phone', 'email', 'sms', 'any'
  - `preferred_time` (VARCHAR 255) - When to contact (nullable)
  - `message` (TEXT) - Customer message or inquiry
  - `conversation_context` (TEXT) - Full chat transcript for chatbot/download_chat sources
  - `source` (VARCHAR 20) - **CRITICAL**: 'chatbot', 'contact_form', 'footer_form', 'download_chat'
  - `service` (VARCHAR 255) - Detected or selected service (nullable)
  - `status` (VARCHAR 20) - DEFAULT 'pending', CHECK: 'pending', 'contacted', 'completed'
  - `created_at`, `updated_at` (TIMESTAMP) - Auto-managed timestamps

- **Indexes**: `idx_callback_status`, `idx_callback_source`, `idx_callback_created`
- **Trigger**: `update_callback_requests_updated_at` - Auto-updates `updated_at` on row change

**Secondary table**: `search_queries` (tracks AI web search usage)
- Stores search query text, session ID, results count, timestamp

### Database Migration System
**How it works**:
1. **Fresh install**: `db/init.js` reads `db/schema.sql` and creates tables
2. **Existing database**: `db/init.js` runs files in `migrations/*.sql` directory (numbered 001, 002, etc.)
3. **Container startup**: `server.js` calls `await initDatabase()` before listening on port
4. **Migration tracking**: Uses PostgreSQL transactions, checks for existing constraints before altering

**Migration files**:
- `001_add_source_and_service_columns.sql` - Adds source/service fields (legacy, pre-schema.sql)
- `002_add_download_chat_source.sql` - Adds 'download_chat' to CHECK constraint

**Key pattern**: Migrations drop old constraints and recreate with updated values
```sql
-- Drop old constraint
ALTER TABLE callback_requests 
DROP CONSTRAINT IF EXISTS callback_requests_source_check;

-- Add new constraint with 'download_chat' included
ALTER TABLE callback_requests 
ADD CONSTRAINT callback_requests_source_check 
CHECK (source IN ('chatbot', 'contact_form', 'footer_form', 'download_chat'));
```

### Admin Dashboard (`/admin/callbacks.html`)
**Authentication**: Password-protected via `ADMIN_DASHBOARD_PASSWORD` env var
- Login endpoint: `POST /api/admin/login` with `{ password: "..." }` body
- Session: Stored in browser `localStorage` as `adminLoggedIn=true`
- Middleware: `authenticate()` function in `routes/callbacks.js` checks `x-admin-password` header

**Features**:
- **Lead listing**: GET `/api/callbacks` with pagination (default 50 per page)
- **Filtering**: By source, status, date range, search query (name/email/message)
- **Source badges**: Color-coded by type:
  - 🤖 Chatbot (blue `#3b82f6`)
  - 📝 Contact Form (green `#10b981`)
  - 📋 Footer Form (purple `#8b5cf6`)
  - 💬 Download Chat (cyan `#06b6d4`)
- **Status management**: Click row to toggle status (pending → contacted → completed)
- **CRUD operations**: View, update status, delete leads via `/api/callbacks/:id` endpoints

**API Endpoints** (`routes/callbacks.js`):
- `POST /api/admin/login` - Password authentication
- `GET /api/callbacks` - List with filters (requires auth header)
- `GET /api/callbacks/:id` - Single lead details
- `PUT /api/callbacks/:id` - Update lead (status, notes, etc.)
- `DELETE /api/callbacks/:id` - Delete lead
- `GET /api/callbacks/test-schema` - Debug endpoint (no auth)

## Email Transcript Feature (Download Chat)

### Overview
Allows users to "download" their AI chat transcript via email, capturing them as a lead with `source='download_chat'` in the database. Header button appears greyed out initially and becomes active after first AI response.

### Frontend Implementation (`public/js/aiChat.js`)
**Flow**:
1. **Header button**: `#chatEmail` button in chat header (download icon SVG)
   - Initially greyed out (`opacity: 0.4`, `cursor: not-allowed`)
   - `enableEmailButton()` adds `.active` class after first AI response
   - Only clickable when `.active` class present

2. **Modal display**: Click triggers `showEmailModal()`
   - Creates glassmorphism modal with backdrop blur
   - Title: "📥 Download Your Chat"
   - Email input with validation
   - "Send to Me 📥" button (green gradient)

3. **Transcript submission**: `handleEmailTranscript()` sends data to API
   - Validates email format client-side
   - Packages transcript array (role + content objects)
   - POSTs to `/api/chat/email-transcript` with sessionId
   - Shows success message

**HTML Structure** (in chat header):
```html
<div class="chat-header-actions">
    <button id="chatEmail" class="chat-email" aria-label="Save chat transcript" title="Save chat transcript">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    </button>
    <button id="chatReset" class="chat-reset">...</button>
    <button id="chatClose" class="chat-close">&times;</button>
</div>
```

**CSS for header button** (`styles.css`):
```css
.chat-email {
    opacity: 0.4;
    cursor: not-allowed;
}
.chat-email.active {
    opacity: 1;
    cursor: pointer;
}
.chat-email.active:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
}
```

### Backend Implementation (`routes/ai.js`)
**Endpoint**: `POST /api/chat/email-transcript`
**Request body**:
```json
{
  "email": "customer@example.com",
  "transcript": [
    { "role": "user", "content": "How can you help with SEO?" },
    { "role": "assistant", "content": "We offer local SEO..." }
  ],
  "sessionId": "uuid-v4-string"
}
```

**Processing steps**:
1. **Validation**: Email format + transcript array length
2. **Service detection**: Keyword matching from conversation text
   - Keywords: `['ai assistant', 'chatbot']` → service: "ai assistant"
   - Keywords: `['seo', 'google ranking']` → service: "seo"
   - Keywords: `['website', 'web design']` → service: "website"
   - (6 service categories total)
3. **Database insertion**: Creates lead with `source='download_chat'`
   - Name: "Chat Download Request" (generic placeholder)
   - Email: User-provided
   - Conversation context: Full transcript formatted as text
   - Service: Auto-detected from keywords
   - Status: 'pending'
4. **Reference ID generation**: Format `DL-{timestamp}-{leadId}`
5. **Dual email sending**:
   - **Customer email**: Formatted transcript with CTA button to `/contact/`
   - **Admin email**: Lead notification with transcript summary

**Service Detection Logic**:
```javascript
const serviceKeywords = {
  'ai assistant': ['ai assistant', 'chatbot', 'automation', 'ai chat'],
  'seo': ['seo', 'search engine', 'google ranking', 'local seo'],
  'website': ['website', 'web design', 'web development', 'site'],
  'social media': ['social media', 'facebook', 'instagram', 'linkedin'],
  'crm': ['crm', 'sales funnel', 'lead', 'pipeline'],
  'analytics': ['analytics', 'reporting', 'data', 'insights']
};
```

**Email Template Design**:
- **Customer email**: Gradient header, chat bubbles (user: gray, AI: blue), CTA box with lime gradient, footer with reference ID
- **Admin email**: Lead notification with transcript, email, detected service, reference ID
- Both use inline CSS with responsive design patterns

## Critical Developer Workflows

### Local Development
```bash
npm install              # First-time setup
npm run dev              # Development with nodemon auto-reload (port 3000)
node server.js           # Production mode (port 3000)
pkill -f "node server.js" && sleep 1 && node server.js &  # Restart background process
```

### Docker/Coolify Deployment Workflow
- **Platform**: Coolify (coolify.io) - self-hosted Docker deployment platform
- **Dockerfile**: Multi-stage Node.js 20 Alpine build with health checks
- **Health endpoint**: `/health` returns `{"status":"ok","uptime":12345,"timestamp":"..."}`
- **Port**: Always 3000 (exposed in Dockerfile, mapped by Coolify)
- **Deploy trigger**: Git push → Coolify webhook detects → Docker build → Rolling update → Health check → Old container removed
- **⚠️ Docker Cache Issue**: Coolify caches Docker images by commit SHA. If you push without file changes, build is skipped.
  - **Solution**: Modify any file (e.g., add line to `.buildtrigger`) or make meaningful code changes before pushing
  - **Command**: `echo "$(date)" >> .buildtrigger && git add .buildtrigger && git commit -m "Force rebuild" && git push`

### Environment Setup
Copy `.env` template and configure:
- **OpenRouter (AI Chat)**:
  - `OPENROUTER_API_KEY` - Required for AI chat (get from openrouter.ai/keys)
  - `OPENROUTER_MODEL` - AI model to use (e.g., `deepseek/deepseek-chat-v3-0324`)
  - `OPENROUTER_SYSTEM_PROMPT` - Single comprehensive prompt (400+ lines) defining AI personality, services list, conversation strategy
  - `OPENROUTER_USE_STREAMING=true` - Enables SSE streaming (false = single response)
  - `CHAT_SUGGESTED_QUESTIONS` - Comma-separated list shown on chat widget open
  - `BRAVE_SEARCH_API_KEY` - Required for web search function calling
- **Mailgun (Email Service)**:
  - `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` - Required for email forms and transcript downloads
  - `MAILGUN_REGION` - API region (default: `api`, EU: `api.eu`)
  - `EMAIL_FROM` - Sender email address (must be verified in Mailgun)
  - `RECIPIENT_EMAIL` - Admin email for contact form notifications (supports comma-separated list)
- **Database (PostgreSQL)**:
  - `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - Database connection credentials
- **Admin Dashboard**:
  - `ADMIN_DASHBOARD_PASSWORD` - Password for admin login at `/admin/callbacks.html`
- **Site Configuration**:
  - `SITE_URL` - Base URL for email links (e.g., `https://websited.au`)
  - `NODE_ENV=production` - Affects error message verbosity

### Testing the Stack
1. **Health check**: `curl http://localhost:3000/health` (should return JSON with uptime)
2. **AI chat**: Open homepage, click chat widget (bottom-right), send test message
3. **Email form**: Fill contact form on `/contact/` or homepage footer, verify dual emails (admin + customer)
4. **Navigation**: Click Services dropdown, verify all 6 links work, check breadcrumbs on service pages

## Localization & Content Standards

### ⚠️ CRITICAL: Australian English Spelling
**All content must use Australian English conventions** (British spelling with Australian variations):
- **optimisation** not optimization
- **localisation** not localization
- **organisation** not organization
- **analyse** not analyze
- **centre** not center
- **colour** not color
- **favour** not favor

### Mass Spelling Replacement Workflow
Use `perl` for site-wide text changes (preserves inline):
```bash
# Example: Convert American to Australian spelling across all HTML files
perl -pi -e 's/optimization/optimisation/gi' public/**/*.html
perl -pi -e 's/localization/localisation/gi' public/**/*.html
perl -pi -e 's/\borganization\b/organisation/gi' public/**/*.html

# Find instances before replacing
grep -ri "optimization" public/
```

## Project-Specific Conventions

### 1. Breadcrumb Pattern (Service/Industry Pages)
**HTML Structure**:
```html
<section class="breadcrumb-section" style="padding: 0.75rem 0;">
  <div class="container" style="display: flex; align-items: center; min-height: 56px; margin-top: 80px;">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li><a href="/">Home</a></li>
        <li><a href="/service/">Services</a></li>
        <li>AI Assistants</li>
      </ol>
    </nav>
  </div>
</section>
```
**Key requirements**:
- `margin-top: 80px` on container `<div>` (not `<section>`) to clear fixed header
- Flexbox vertical centering on container: `display: flex; align-items: center; min-height: 56px`
- Reduced section padding: `0.75rem 0` (was `1rem 0`)
- Breadcrumb links use relative paths (`/service/` not absolute URLs)

### 2. FAQ Accordion Functionality (`public/js/main.js`)
**Critical**: Single event listener source (no inline scripts):
- FAQ click handlers in `main.js` using `closest('.faq-item')`
- Animation via `maxHeight` (collapsed: `0`, expanded: `scrollHeight + 'px'`)
- **Anti-pattern**: Do NOT add inline `<script>` tags in HTML with duplicate FAQ logic (causes conflicts)

**HTML Structure**:
```html
<div class="faq-item">
  <button class="faq-question" style="color: #1a1a2e; font-weight: 500;">
    Question text here
    <span class="faq-icon">+</span>
  </button>
  <div class="faq-answer" style="color: #4a5568;">
    <p>Answer text here</p>
  </div>
</div>
```

**Styling fixes applied**:
- FAQ question text: `color: #1a1a2e` (dark gray, not CSS variable that inherits white)
- FAQ answer text: `color: #4a5568` (medium gray)
- Font weight: `500` (was `600` - too bold)

### 3. Markdown Formatting in AI Chat (`public/js/aiChat.js`)
**Critical**: AI responses may contain broken unicode sequences (`u2022` instead of `•`). The `formatMessage()` function preprocesses these before rendering:
```javascript
// First fix broken unicode, THEN process markdown
formatted.replace(/u2022/g, '• ').replace(/u2019/g, "'")
```
Order matters: unicode fixes → headers → bold/italic → lists → emojis → line breaks.

### 4. Streaming Response Optimization (AI Chat)
**Why**: Prevents visible color changes during markdown formatting (e.g., text turning from black to purple mid-stream).

**How**: 
- Accumulate chunks in `fullResponse` buffer
- Use `requestAnimationFrame` to batch DOM updates at 60fps
- Apply full markdown formatting on each frame (not just new content)
- User scroll detection pauses auto-scroll during streaming

**Key Design Decision**: Character-by-character streaming uses `requestAnimationFrame` batching (60fps) to update formatted markdown content smoothly. This prevents jerky rendering while maintaining character-by-character appearance. See `public/js/aiChat.js:handleStreamingResponse()`.

### 5. Modern Gradient Design System (`public/css/styles.css`)
Uses CSS custom properties with gradient-based color system:
- Primary gradient: `--gradient-primary` (indigo → purple → pink)
- All major headings use `clamp()` for fluid responsive typography
- Glassmorphism effects: `backdrop-filter: blur(20px)` on header and modals
- Animated backgrounds via `@keyframes pulse` in hero section

### 6. Email Template Structure (`routes/email.js`)
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

### AI Function Calling (Tool Use)
**Overview**: AI can invoke three tools during conversation to enhance responses with real-time data.

**Tool Definitions** (sent in `/api/chat` request):
1. **search_web** - Brave Search API integration
   - Parameters: `query` (string), `count` (number, default 5)
   - Use case: General web queries, news, company research
   - Returns: Array of search results with titles, URLs, snippets

2. **fetch_webpage** - Web scraping with Cheerio
   - Parameters: `url` (string), `focus` (optional string for specific section)
   - Use case: Analyze website structure, competitor research, page content extraction
   - Returns: Cleaned HTML content (strips scripts, styles, navigation)

3. **request_callback** - Database lead insertion
   - Parameters: `name`, `phone`, `email`, `preferred_contact_method`, `preferred_time`, `message`, `conversation_context`
   - Use case: User wants to schedule consultation or receive a callback
   - Saves lead with `source='chatbot'` and `service` (if detected)

**Execution Flow**:
1. AI model returns `tool_calls` array in streaming response
2. Backend executes each tool sequentially:
   - Sends `tool_status` SSE event (e.g., "Searching the web...")
   - Calls external API or database
   - Sends `tool_result` SSE event with formatted results
3. Appends tool results to conversation history as `tool` role messages
4. Makes follow-up API call to OpenRouter with updated history
5. AI generates final response incorporating tool results

**Frontend Tool Display** (`public/js/aiChat.js`):
- Tool status: Shows loading message (e.g., "🔍 Searching the web...")
- Tool results: Formatted as collapsed/expandable sections with emojis
- Search results: Bulleted list with clickable links
- Callback confirmation: Green success message with reference ID

**Example Tool Call** (from OpenRouter response):
```json
{
  "choices": [{
    "delta": {
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "search_web",
          "arguments": "{\"query\": \"latest SEO trends 2024\", \"count\": 5}"
        }
      }]
    }
  }]
}
```

**Backend Tool Execution** (`routes/ai.js`):
```javascript
if (toolCall.name === 'search_web') {
  const args = JSON.parse(toolCall.function.arguments);
  res.write(`data: ${JSON.stringify({ tool_status: 'Searching the web...', tool_name: 'search_web' })}\n\n`);
  const toolResult = await searchWeb(args.query, args.count);
  res.write(`data: ${JSON.stringify({ tool_result: toolResult, tool_name: 'search_web' })}\n\n`);
}
```

### Mailgun Integration
- **Region-aware**: Uses `MAILGUN_REGION` (default: `api`) to build base URL
- **Multiple recipients**: `RECIPIENT_EMAIL` supports comma-separated list
- **Domain setup**: Must verify domain in Mailgun dashboard first
- **Error handling**: Returns user-friendly messages (never expose API details)

## Common Patterns & Anti-Patterns

### ✅ Do This
- **Always use Australian spelling** for all content edits (optimisation, localisation, organisation)
- Use `perl -pi -e` for mass text replacements (preserves inline formatting)
- Add `margin-top: 80px` to first content section on new pages (clears fixed header)
- Apply flexbox vertical centering to breadcrumb container `<div>` (not outer `<section>`)
- Always preprocess unicode artifacts before markdown rendering in AI chat
- Batch DOM updates with `requestAnimationFrame` for smooth streaming
- Use semantic HTML5 elements (`<strong>`, `<em>`, `<h3>`) not styled `<span>`
- Validate forms on both client (`formHandler.js`) and server (`routes/email.js`)
- Use CSS custom properties for all colors/spacing (never hardcode hex values)
- Force Docker rebuild by modifying `.buildtrigger` file when pushing without code changes

### ❌ Avoid This
- **Never use American spelling** (optimization, localization, organization) - always Australian
- Don't add inline `<script>` tags to HTML with duplicate event listeners (causes conflicts)
- Don't apply `margin-top` to outer `<section>` for breadcrumbs (needs to be on container `<div>`)
- Don't use CSS variables like `var(--text-primary)` in FAQ styling (inherits white on dark backgrounds)
- Don't use `textContent` during AI streaming (breaks formatting) - use `innerHTML` with sanitized markdown
- Never expose `.env` values in frontend code (fetch via `/api/chat/config` endpoint)
- Don't parse markdown character-by-character (causes flashing) - parse full accumulated text
- Avoid inline styles in HTML - all styling via `styles.css` custom properties
- Don't add transitions to heading elements in chat (causes visible formatting changes)
- Don't push to git without file changes if you need Docker rebuild (cache will skip build)

## File Dependencies Map
- `server.js` → requires `routes/email.js`, `routes/ai.js`, `routes/callbacks.js`, `db/init.js`
- `db/init.js` → runs `db/schema.sql` (fresh install) or `migrations/*.sql` (existing database)
- `public/index.html` → loads `styles.css`, `formHandler.js`, `aiChat.js`, `main.js` (in order)
- `public/service/index.html` → Main services page with 6 service cards
- All 22 HTML pages → load `aiChat.js` for chat widget (homepage, about, contact, 6 services, 6 industries, blog, case studies, privacy)
- All service pages → breadcrumb pattern with `margin-top: 80px` on container div
- `routes/ai.js` → depends on `.env` vars: `OPENROUTER_*`, `BRAVE_SEARCH_API_KEY`, `POSTGRES_*`, `MAILGUN_*`
- `routes/email.js` → depends on `.env` vars: `MAILGUN_*`, `EMAIL_*`, `RECIPIENT_EMAIL`
- `routes/callbacks.js` → depends on `.env` vars: `ADMIN_DASHBOARD_PASSWORD`, `POSTGRES_*`
- `public/js/aiChat.js` → fetches `/api/chat/config` for suggested questions, calls `/api/chat` and `/api/chat/email-transcript`
- `public/admin/callbacks.html` → calls `/api/admin/login` and `/api/callbacks` with auth header
- All CSS → uses custom properties from `:root` in `styles.css` lines 1-50

## Environment Variables Reference
See `.env` for full list. Critical ones:
- `OPENROUTER_API_KEY` - Required for AI chat functionality
- `OPENROUTER_USE_STREAMING=true` - Enables SSE streaming (false = single response)
- `OPENROUTER_SYSTEM_PROMPT` - Complete AI personality (400+ line prompt with services, strategy, boundaries)
- `CHAT_SUGGESTED_QUESTIONS` - Comma-separated list shown on chat widget open
- `BRAVE_SEARCH_API_KEY` - Required for web search function calling tool
- `MAILGUN_API_KEY` - Required for email form submissions and transcript downloads
- `MAILGUN_DOMAIN` - Verified domain in Mailgun dashboard
- `RECIPIENT_EMAIL` - Admin email (supports comma-separated list for multiple recipients)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - Database connection
- `ADMIN_DASHBOARD_PASSWORD` - Password for admin login at `/admin/callbacks.html`
- `SITE_URL` - Base URL for email links (e.g., `https://websited.au`)
- `NODE_ENV=production` - Affects error message verbosity

## Debugging Tips
1. **AI chat not streaming**: Check browser Network tab for `text/event-stream` content-type
2. **Unicode artifacts (`u2022`)**: Add pattern to `formatMessage()` preprocessing section in `aiChat.js`
3. **Email not sending**: Verify Mailgun domain is verified (check dashboard), check server logs for API errors
4. **CSS not updating**: Hard refresh (`Cmd+Shift+R`) - browser caches aggressively, or check Docker container has new code
5. **Server won't restart locally**: Check port 3000 with `lsof -ti:3000 | xargs kill -9`
6. **Docker deployment not updating**: Verify commit has file changes (not just message), check Coolify build logs for cache hit
7. **Breadcrumbs hidden under header**: Check `margin-top: 80px` is on container `<div>` not `<section>`
8. **FAQ not opening**: Check for duplicate event listeners (remove inline scripts, keep only `main.js`)
9. **Text invisible**: Check color isn't CSS variable that inherits white (use specific hex like `#1a1a2e`)
10. **Function calling not working**: Check `BRAVE_SEARCH_API_KEY` in `.env`, verify tool definitions in `routes/ai.js`
11. **Database migration not running**: Check `db/init.js` logs on container startup, verify migration files in `migrations/`
12. **Admin dashboard login failing**: Verify `ADMIN_DASHBOARD_PASSWORD` in `.env`, check browser localStorage for `adminLoggedIn`
13. **Email transcript button not appearing**: Check first AI response completed, verify `enableEmailButton()` call in `aiChat.js`

## Key Files to Reference
- `server.js` - Express app setup, static file serving, API route mounting, database initialization
- `routes/ai.js:52-100` - SSE streaming implementation with proxy-safe headers and keep-alive pings
- `routes/ai.js:17-90` - Function calling tool definitions (search_web, fetch_webpage, request_callback)
- `routes/ai.js:784-836` - Tool execution logic with SSE status/result broadcasting
- `routes/ai.js:1040-1200` - Email transcript endpoint with service detection and dual email templates
- `routes/email.js` - Dual email templates (admin notification + customer auto-reply) with Mailgun integration
- `routes/callbacks.js` - Admin dashboard authentication, filtering, CRUD operations
- `db/init.js` - Database initialization with automatic migration runner
- `db/schema.sql` - Fresh database schema with callback_requests and search_queries tables
- `migrations/002_add_download_chat_source.sql` - Migration adding download_chat source type
- `public/index.html` - Homepage with hero, services overview, FAQ, testimonials, contact form
- `public/service/index.html` - Main services landing page with 6 service cards
- `public/admin/callbacks.html` - Admin dashboard with password auth, filtering, source badges
- `public/js/aiChat.js` - AI chat widget (1018 lines) with SSE streaming, markdown formatting, header-based download button, email transcript modal
- `public/js/aiChat.js:enableEmailButton()` - Adds `.active` class to header button after first AI response
- `public/js/aiChat.js:showEmailModal()` - Creates "Download Your Chat" modal for email capture
- `public/js/main.js` - FAQ accordion functionality (single source of truth for event listeners)
- `public/css/styles.css:1-50` - Design system custom properties (colors, gradients, spacing)
- `public/css/styles.css:1440-1475` - Chat header button styles (`.chat-email`, `.chat-email.active`)
- `public/css/mobile.css:688-710` - Responsive styles for chat header buttons (36px touch targets)
- `.env` - Environment variables (OpenRouter API key, Mailgun config, system prompt, database, admin password)
- `Dockerfile` - Multi-stage Node.js Alpine build with health checks for Coolify deployment

## Recent Changes & Patterns
1. **Australian spelling conversion**: Used `perl -pi -e 's/optimization/optimisation/gi'` across 90+ instances site-wide
2. **Main services page created**: `/service/index.html` with grid of 6 service cards linking to subpages
3. **Breadcrumb centering fixed**: Applied flexbox to container `<div>` with `display: flex; align-items: center; min-height: 56px`
4. **FAQ visibility fixed**: Changed `.faq-question` color from `var(--text-primary)` to `#1a1a2e` (dark gray)
5. **FAQ functionality fixed**: Removed inline `<script>` tag from `index.html` that duplicated `main.js` event listeners
6. **Docker cache bypass**: Added `.buildtrigger` file and committed to force Coolify rebuild when no code changes exist
7. **AI chat widget site-wide**: Added `<script src="/js/aiChat.js"></script>` to all 22 HTML pages
8. **Email transcript feature**: Built complete lead capture system with header button → modal → API → database → dual emails
9. **Database migration for download_chat**: Created `002_add_download_chat_source.sql` migration, updated `db/init.js` to run on startup
10. **Function calling tools**: Implemented search_web, fetch_webpage, request_callback with SSE status broadcasting
11. **Header-based download button**: Refactored from in-chat button to persistent header button with greyed-out/active states
    - `#chatEmail` button in `.chat-header-actions` with download SVG icon
    - `.chat-email` CSS class (greyed out: opacity 0.4, not-allowed cursor)
    - `.chat-email.active` CSS class (full opacity, pointer cursor, hover effects)
    - `chatEmailBtn` property in constructor (replaces old `emailTranscriptButton`)
    - `enableEmailButton()` method adds `.active` class after first AI response
````