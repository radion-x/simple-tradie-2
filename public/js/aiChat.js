/**
 * AI Chat Widget Class
 * Handles the floating AI chat widget functionality
 */
class AIChat {
    constructor() {
        this.chatToggle = null;
        this.chatWindow = null;
        this.chatClose = null;
        this.chatReset = null;
        this.chatForm = null;
        this.chatInput = null;
        this.chatMessages = null;
        this.apiEndpoint = '/api/chat';
        this.configEndpoint = '/api/chat/config';
        this.isOpen = false;
        this.conversationHistory = [];
        this.suggestedQuestions = [];
        this.hasShownSuggestions = false;
        this.userHasScrolled = false;
        this.isStreaming = false;
        this.streamingMessageDiv = null;
        this.sessionId = this.generateSessionId();
        this.toolStatusDiv = null;
        this.chatEmailBtn = null;
        this.hasShownEmailButton = false;
    }

    generateSessionId() {
        // Generate a unique session ID for this chat session
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async init() {
        this.chatToggle = document.getElementById('chatToggle');
        this.chatWindow = document.getElementById('chatWindow');
        this.chatClose = document.getElementById('chatClose');
        this.chatReset = document.getElementById('chatReset');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.chatMessages = document.getElementById('chatMessages');

        if (!this.chatToggle || !this.chatWindow || !this.chatMessages) {
            console.error('Chat widget critical elements not found. Aborting initialization.');
            return;
        }

        this.chatToggle.addEventListener('click', () => this.toggleChat());
        this.chatClose.addEventListener('click', () => this.toggleChat());
        this.chatReset.addEventListener('click', () => this.resetChat());
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Email transcript button in header
        this.chatEmailBtn = document.getElementById('chatEmail');
        if (this.chatEmailBtn) {
            this.chatEmailBtn.addEventListener('click', () => {
                if (this.chatEmailBtn.classList.contains('active')) {
                    this.showEmailModal();
                }
            });
        }

        // Track user scroll to pause auto-scroll during streaming
        this.chatMessages.addEventListener('scroll', () => this.handleScroll());

        // Fetch configuration and suggested questions
        await this.loadConfig();

        // Add welcome message
        this.addMessage('ai', 'Hello! 👋 I\'m here to help you grow your business with AI and digital marketing. How can I assist you today?');

        // Add suggested questions if available
        if (this.suggestedQuestions.length > 0 && !this.hasShownSuggestions) {
            this.showSuggestedQuestions();
        }

        // Close chat when clicking outside
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    async loadConfig() {
        try {
            const response = await fetch(this.configEndpoint);
            const config = await response.json();

            if (config.suggestedQuestions && Array.isArray(config.suggestedQuestions)) {
                this.suggestedQuestions = config.suggestedQuestions;
            }
        } catch (error) {
            console.warn('Could not load chat config:', error);
            // Continue without suggested questions
        }
    }

    showSuggestedQuestions() {
        if (this.hasShownSuggestions) return;

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'chat-suggestions';
        suggestionsDiv.id = 'chatSuggestions';

        this.suggestedQuestions.forEach(question => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = question;
            btn.addEventListener('click', (e) => this.handleSuggestionClick(question, e));
            suggestionsDiv.appendChild(btn);
        });

        this.chatMessages.appendChild(suggestionsDiv);
        this.scrollToBottom();
        this.hasShownSuggestions = true;
    }

    handleSuggestionClick(question, event) {
        // Prevent click from bubbling up to the outside click handler
        if (event) {
            event.stopPropagation();
        }

        // Remove suggestions
        const suggestionsDiv = document.getElementById('chatSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.remove();
        }

        // Set input value and submit
        this.chatInput.value = question;
        this.chatForm.dispatchEvent(new Event('submit'));
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.chatWindow.classList.toggle('hidden');
        
        if (this.isOpen) {
            this.chatInput.focus();
            // Track chat open event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'chat_opened', {
                    'event_category': 'engagement'
                });
            }
        }
    }

    resetChat() {
        // Clear all messages
        this.chatMessages.innerHTML = '';
        
        // Reset conversation history
        this.conversationHistory = [];
        
        // Reset flags
        this.hasShownSuggestions = false;
        this.userHasScrolled = false;
        this.isStreaming = false;
        this.streamingMessageDiv = null;
        
        // Add welcome message back
        this.addMessage('ai', 'Hello! 👋 I\'m here to help you grow your business with AI and digital marketing. How can I assist you today?');
        
        // Show suggested questions again
        if (this.suggestedQuestions.length > 0) {
            this.showSuggestedQuestions();
        }
        
        // Track reset event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'chat_reset', {
                'event_category': 'engagement'
            });
        }
    }

    handleOutsideClick(e) {
        if (this.isOpen && 
            !this.chatWindow.contains(e.target) && 
            !this.chatToggle.contains(e.target)) {
            this.toggleChat();
        }
    }

    addMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        // Format AI messages with markdown-like rendering
        if (type === 'ai') {
            messageDiv.innerHTML = this.formatMessage(text);
        } else {
            messageDiv.textContent = text;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in conversation history
        this.conversationHistory.push({
            role: type === 'user' ? 'user' : 'assistant',
            content: text
        });

        // Enable email transcript button after first AI response (excluding welcome message)
        if (type === 'ai' && this.conversationHistory.length >= 3 && !this.hasShownEmailButton) {
            // Wait a moment for smooth UX
            setTimeout(() => {
                this.enableEmailButton();
            }, 500);
        }
    }

    formatMessage(text) {
        let formatted = text;

        // STEP 1: Fix broken unicode FIRST
        formatted = this.fixBrokenUnicode(formatted);

        // STEP 2: Process block elements (headers, lists)
        formatted = this.processBlockElements(formatted);

        // STEP 3: Process inline elements (bold, italic)
        formatted = this.processInlineElements(formatted);

        // STEP 4: Final cleanup (line breaks, spacing)
        formatted = this.finalizeFormatting(formatted);

        return formatted;
    }

    fixBrokenUnicode(text) {
        return text
            // Fix escaped unicode (like \u2022)
            .replace(/\\u2022/g, '•')
            .replace(/\\u2023/g, '‣')
            .replace(/\\u2024/g, '․')
            .replace(/\\u2026/g, '…')
            .replace(/\\u2013/g, '–')
            .replace(/\\u2014/g, '—')
            .replace(/\\u2019/g, "'")
            .replace(/\\u201C/g, '"')
            .replace(/\\u201D/g, '"')
            .replace(/\\u00A0/g, ' ')
            // Fix broken unicode WITHOUT backslash (the actual issue in screenshot)
            // Match "u2022" when followed by capital letter or standalone
            .replace(/u2022(?=[A-Z])/g, '• ')  // "u2022AI" → "• AI"
            .replace(/\bu2022\b/g, '•')         // " u2022 " → " • "
            .replace(/u2023(?=[A-Z])/g, '‣ ')
            .replace(/\bu2023\b/g, '‣')
            .replace(/u2024(?=[A-Z])/g, '․ ')
            .replace(/\bu2024\b/g, '․')
            .replace(/u2026(?=[A-Z])/g, '… ')
            .replace(/\bu2026\b/g, '…')
            .replace(/u2013(?=[A-Z])/g, '– ')
            .replace(/\bu2013\b/g, '–')
            .replace(/u2014(?=[A-Z])/g, '— ')
            .replace(/\bu2014\b/g, '—')
            .replace(/u2019(?=[A-Z])/g, "' ")
            .replace(/\bu2019\b/g, "'")
            .replace(/u201C(?=[A-Z])/g, '" ')
            .replace(/\bu201C\b/g, '"')
            .replace(/u201D(?=[A-Z])/g, '" ')
            .replace(/\bu201D\b/g, '"')
            .replace(/u00A0(?=[A-Z])/g, ' ')
            .replace(/\bu00A0\b/g, ' ');
    }

    processBlockElements(text) {
        // Headers - process first
        text = text
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Lists - improved line-by-line processing
        const lines = text.split('\n');
        const processed = [];
        let inList = false;

        for (let line of lines) {
            // Check if line is a list item (including checkmark emojis)
            const bulletMatch = line.match(/^[•\-\*‣✅✔️☑️]\s*(.+)$/);
            const numberMatch = line.match(/^\d+\.\s+(.+)$/);

            if (bulletMatch || numberMatch) {
                if (!inList) {
                    processed.push('<ul>');
                    inList = true;
                }
                const content = bulletMatch ? bulletMatch[1] : numberMatch[1];
                processed.push(`<li>${content}</li>`);
            } else if (line.trim()) {
                // Non-empty line that's not a list item
                if (inList) {
                    processed.push('</ul>');
                    inList = false;
                }
                processed.push(line);
            } else {
                // Empty line - close list if open
                if (inList) {
                    processed.push('</ul>');
                    inList = false;
                }
                processed.push(line);
            }
        }

        // Close list if still open at end
        if (inList) {
            processed.push('</ul>');
        }

        return processed.join('\n');
    }

    processInlineElements(text) {
        // Bold - match non-greedy
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic - only if not part of bold
        text = text.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');

        return text;
    }

    finalizeFormatting(text) {
        // Split into lines for processing
        const lines = text.split('\n');
        const processed = [];
        let paragraphLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            
            // Check if line is a block element (heading, list tag)
            const isBlockElement = /^<(h[1-4]|ul|li|\/(h[1-4]|ul|li))/.test(trimmed);
            
            if (isBlockElement) {
                // Flush paragraph if we have accumulated lines
                if (paragraphLines.length > 0) {
                    processed.push('<p>' + paragraphLines.join(' ') + '</p>');
                    paragraphLines = [];
                }
                processed.push(trimmed);
            } else if (trimmed) {
                // Accumulate non-empty lines as paragraph content
                paragraphLines.push(trimmed);
            } else if (paragraphLines.length > 0) {
                // Empty line: flush current paragraph
                processed.push('<p>' + paragraphLines.join(' ') + '</p>');
                paragraphLines = [];
            }
        }

        // Flush remaining paragraph
        if (paragraphLines.length > 0) {
            processed.push('<p>' + paragraphLines.join(' ') + '</p>');
        }

        return processed.join('');
    }

    addTypingIndicator() {
        // Remove any existing typing indicator first
        this.removeTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            // Fade out smoothly
            typingIndicator.style.opacity = '0';
            typingIndicator.style.transform = 'translateY(-4px)';
            typingIndicator.style.transition = 'opacity 0.15s, transform 0.15s';
            setTimeout(() => {
                if (typingIndicator.parentNode) {
                    typingIndicator.remove();
                }
            }, 150);
        }
    }

    handleScroll() {
        if (!this.isStreaming) return;
        
        const threshold = 50;
        const isNearBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop - this.chatMessages.clientHeight < threshold;
        
        // If user scrolls away from bottom during streaming, pause auto-scroll
        if (!isNearBottom) {
            this.userHasScrolled = true;
        } else {
            this.userHasScrolled = false;
        }
    }

    scrollToBottom() {
        // Only auto-scroll if user hasn't manually scrolled up
        if (!this.userHasScrolled) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage('user', message);
        this.chatInput.value = '';

        // Disable input while processing
        this.chatInput.disabled = true;
        const submitBtn = this.chatForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        // Show typing indicator
        this.addTypingIndicator();

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    history: this.conversationHistory.slice(-10),
                    sessionId: this.sessionId
                }),
            });

            // Check if streaming
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/event-stream')) {
                // Handle streaming response
                await this.handleStreamingResponse(response);
            } else {
                // Handle non-streaming response
                const data = await response.json();

                // Remove typing indicator
                this.removeTypingIndicator();

                if (response.ok) {
                    this.addMessage('ai', data.response || data.message);
                    
                    // Track successful chat interaction
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'chat_message_sent', {
                            'event_category': 'engagement'
                        });
                    }
                } else {
                    this.addMessage('ai', 'Sorry, I encountered an error. Please try again or contact us directly.');
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.removeTypingIndicator();
            this.addMessage('ai', 'Sorry, I\'m having trouble connecting. Please try again later or contact us directly.');
        } finally {
            // Re-enable input
            this.chatInput.disabled = false;
            submitBtn.disabled = false;
            this.chatInput.focus();
        }
    }

    async handleStreamingResponse(response) {
        this.streamingMessageDiv = null;
        this.toolStatusDiv = null;
        let fullResponse = '';
        this.isStreaming = true;
        this.userHasScrolled = false;
        let updatePending = false;
        let cursorVisible = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Blinking cursor HTML
        const cursorHTML = '<span class="streaming-cursor"></span>';

        // Smooth update function with requestAnimationFrame for optimal rendering
        const smoothUpdate = () => {
            if (this.streamingMessageDiv && fullResponse) {
                // Format and render with cursor
                const formattedContent = this.formatMessage(fullResponse);
                this.streamingMessageDiv.innerHTML = formattedContent + (this.isStreaming ? cursorHTML : '');
                this.scrollToBottom();
            }
            updatePending = false;
        };

        // Request update on next animation frame (60fps smooth)
        const requestUpdate = () => {
            if (!updatePending) {
                updatePending = true;
                requestAnimationFrame(smoothUpdate);
            }
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            // Stop streaming and do final render without cursor
                            this.isStreaming = false;
                            
                            // Final render without cursor
                            if (this.streamingMessageDiv && fullResponse) {
                                this.streamingMessageDiv.innerHTML = this.formatMessage(fullResponse);
                                this.scrollToBottom();
                            }
                            
                            if (fullResponse) {
                                this.conversationHistory.push({
                                    role: 'assistant',
                                    content: fullResponse
                                });
                            }
                            
                            this.streamingMessageDiv = null;
                            
                            // Enable email transcript button after first AI response
                            if (this.conversationHistory.length >= 3 && !this.hasShownEmailButton) {
                                setTimeout(() => {
                                    this.enableEmailButton();
                                }, 500);
                            }
                            
                            if (typeof gtag !== 'undefined') {
                                gtag('event', 'chat_message_sent', {
                                    'event_category': 'engagement'
                                });
                            }
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            
                            // Handle tool status events
                            if (parsed.tool_status) {
                                this.removeTypingIndicator();
                                this.showToolStatus(parsed.tool_name, parsed.tool_status, parsed.tool_args);
                                continue;
                            }

                            // Handle tool result events
                            if (parsed.tool_result) {
                                this.removeToolStatus();
                                this.renderToolResult(parsed.tool_name, parsed.tool_result);
                                // Reset streaming div so AI analysis can create new message
                                this.streamingMessageDiv = null;
                                continue;
                            }

                            // Handle tool error events
                            if (parsed.tool_error) {
                                this.removeToolStatus();
                                this.showToolError(parsed.tool_error);
                                continue;
                            }

                            // Handle regular content
                            const content = parsed.choices?.[0]?.delta?.content;

                            if (content) {
                                if (!this.streamingMessageDiv) {
                                    this.removeTypingIndicator();
                                    this.removeToolStatus();
                                    this.streamingMessageDiv = document.createElement('div');
                                    this.streamingMessageDiv.className = 'chat-message ai';
                                    this.chatMessages.appendChild(this.streamingMessageDiv);
                                }

                                // Pre-clean unicode as it arrives (prevents accumulation of broken unicode)
                                // Only fix the most critical pattern that causes "u2022AI" artifacts
                                const cleanedContent = content
                                    .replace(/u2022(?=[A-Z])/g, '• ')
                                    .replace(/u2023(?=[A-Z])/g, '‣ ')
                                    .replace(/u2024(?=[A-Z])/g, '․ ');

                                fullResponse += cleanedContent;
                                // Request smooth update on next animation frame
                                requestUpdate();
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);
            this.removeTypingIndicator();
            if (!this.streamingMessageDiv) {
                this.streamingMessageDiv = document.createElement('div');
                this.streamingMessageDiv.className = 'chat-message ai';
                this.chatMessages.appendChild(this.streamingMessageDiv);
            }
            this.streamingMessageDiv.innerHTML = 'Sorry, there was an error receiving the response.';
            this.isStreaming = false;
            this.streamingMessageDiv = null;
        }
    }

    // Public method to programmatically send a message (useful for triggering chat from other parts of the site)
    sendMessage(message) {
        if (!this.isOpen) {
            this.toggleChat();
        }
        this.chatInput.value = message;
        this.chatForm.dispatchEvent(new Event('submit'));
    }

    // Tool handling methods
    showToolStatus(toolName, status, toolArgs) {
        if (!this.toolStatusDiv) {
            this.toolStatusDiv = document.createElement('div');
            this.toolStatusDiv.className = 'chat-message tool-status';
            this.toolStatusDiv.style.cssText = 'background: #f3f4f6; border-left: 4px solid #4A5D4F; padding: 12px; margin: 8px 0; border-radius: 8px; font-size: 14px; color: #4b5563;';
            this.chatMessages.appendChild(this.toolStatusDiv);
        }

        let icon = '🔧';
        if (toolName === 'search_web') {
            icon = '🔍';
        } else if (toolName === 'request_callback') {
            icon = '📞';
        }

        this.toolStatusDiv.innerHTML = `<strong>${icon} ${status}</strong>`;
        this.scrollToBottom();
    }

    removeToolStatus() {
        if (this.toolStatusDiv) {
            this.toolStatusDiv.remove();
            this.toolStatusDiv = null;
        }
    }

    renderToolResult(toolName, toolResult) {
        if (toolName === 'search_web') {
            this.renderSearchResults(toolResult);
        } else if (toolName === 'fetch_webpage') {
            this.renderWebpageAnalysis(toolResult);
        } else if (toolName === 'request_callback') {
            this.renderCallbackConfirmation(toolResult);
        }
    }

    renderSearchResults(result) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'chat-message ai search-results';
        resultsDiv.style.cssText = 'background: #ffffff; color: #1f2937; padding: 16px; border-radius: 12px; margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;';

        let html = `<div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;"><strong style="color: #4A5D4F;">🔍 Search Results for:</strong> "${result.query}"</div>`;
        
        if (result.results && result.results.length > 0) {
            html += '<div style="background: #f9fafb; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">';
            result.results.forEach((item, index) => {
                html += `
                    <div style="margin-bottom: ${index < result.results.length - 1 ? '12px' : '0'}; padding-bottom: ${index < result.results.length - 1 ? '12px' : '0'}; border-bottom: ${index < result.results.length - 1 ? '1px solid #e5e7eb' : 'none'};">
                        <div style="font-weight: 600; margin-bottom: 4px;">
                            <a href="${item.url}" target="_blank" rel="noopener noreferrer" style="color: #4A5D4F; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#3b4d40'" onmouseout="this.style.color='#4A5D4F'">
                                ${item.title}
                            </a>
                        </div>
                        <div style="font-size: 13px; color: #4b5563; margin-bottom: 4px; line-height: 1.5;">
                            ${item.description}
                        </div>
                        <div style="font-size: 12px; color: #9ca3af; word-break: break-all;">
                            ${item.url}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div style="color: #6b7280; font-style: italic; padding: 12px; background: #f9fafb; border-radius: 8px;">No results found.</div>';
        }

        resultsDiv.innerHTML = html;
        this.chatMessages.appendChild(resultsDiv);
        this.scrollToBottom();
    }

    renderWebpageAnalysis(result) {
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'chat-message ai webpage-analysis';
        analysisDiv.style.cssText = 'background: #ffffff; color: #1f2937; padding: 16px; border-radius: 12px; margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;';

        if (result.error) {
            analysisDiv.innerHTML = `
                <div style="color: #dc2626; padding: 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                    <strong>⚠️ Could not fetch webpage:</strong> ${result.error}
                </div>
            `;
        } else {
            let html = `
                <div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;">
                    <strong style="color: #4A5D4F;">🌐 Webpage Analysis:</strong> 
                    <a href="${result.url}" target="_blank" rel="noopener noreferrer" style="color: #4A5D4F; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                        ${result.url}
                    </a>
                </div>
                <div style="background: #f9fafb; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Title</div>
                        <div style="font-weight: 600; color: #1f2937; font-size: 16px;">${result.title}</div>
                    </div>
            `;

            if (result.metaDescription) {
                html += `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Meta Description</div>
                        <div style="color: #4b5563; font-size: 14px; line-height: 1.5;">${result.metaDescription}</div>
                    </div>
                `;
            }

            if (result.headings?.h1 && result.headings.h1.length > 0) {
                html += `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Main Headings (H1)</div>
                        <div style="color: #4b5563; font-size: 14px;">
                            ${result.headings.h1.map(h => `• ${h}`).join('<br>')}
                        </div>
                    </div>
                `;
            }

            if (result.headings?.h2 && result.headings.h2.length > 0) {
                html += `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Subheadings (H2)</div>
                        <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                            ${result.headings.h2.slice(0, 5).map(h => `• ${h}`).join('<br>')}
                            ${result.headings.h2.length > 5 ? `<br><span style="color: #9ca3af; font-style: italic;">...and ${result.headings.h2.length - 5} more</span>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
                        📄 Content length: ${result.contentLength?.toLocaleString() || 0} characters
                    </div>
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: #6b7280; font-style: italic;">
                    ℹ️ I've analyzed this webpage and will use the content to provide insights.
                </div>
            `;

            analysisDiv.innerHTML = html;
        }

        this.chatMessages.appendChild(analysisDiv);
        this.scrollToBottom();
    }

    renderCallbackConfirmation(result) {
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'chat-message ai callback-confirmation';
        confirmDiv.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px; border-radius: 12px; margin: 8px 0;';

        const html = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">
                    Callback Request Confirmed!
                </div>
                <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">
                        Your Reference Number:
                    </div>
                    <div style="font-size: 20px; font-weight: 700; letter-spacing: 1px; font-family: monospace;">
                        ${result.referenceId}
                    </div>
                </div>
                <div style="font-size: 14px; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">Our team will contact you within 24 hours via your preferred method.</p>
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.8);">
                        Save your reference number for future correspondence.
                    </p>
                </div>
            </div>
        `;

        confirmDiv.innerHTML = html;
        this.chatMessages.appendChild(confirmDiv);
        this.scrollToBottom();
    }

    showToolError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message ai tool-error';
        errorDiv.style.cssText = 'background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 8px 0; border-radius: 8px; color: #991b1b;';
        errorDiv.innerHTML = `<strong>⚠️ Error:</strong> ${error}`;
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
    }

    enableEmailButton() {
        // Enable the header email button once we have conversation
        if (this.hasShownEmailButton || this.conversationHistory.length === 0) {
            return;
        }

        if (this.chatEmailBtn) {
            this.chatEmailBtn.classList.add('active');
            this.hasShownEmailButton = true;
        }
    }

    showEmailModal() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'emailTranscriptModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;';

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 440px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📥</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1a1a2e;">Download Your Chat</h2>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">Enter your email and we'll send you a copy of this conversation.</p>
                </div>

                <!-- Email Form -->
                <form id="emailTranscriptForm">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">Email Address</label>
                        <input type="email" id="transcriptEmail" required placeholder="your.email@example.com" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; transition: border-color 0.2s; box-sizing: border-box;">
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">We'll also follow up within 24 hours if you have any questions.</p>
                    </div>
                    
                    <div id="emailModalMessage" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button type="button" id="cancelEmailBtn" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; background: white; color: #6b7280; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            Cancel
                        </button>
                        <button type="submit" id="sendEmailBtn" style="flex: 1; padding: 12px; border: none; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
                            Send to Me 📥
                        </button>
                    </div>
                </form>
            </div>

            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #transcriptEmail:focus {
                    outline: none;
                    border-color: #10b981;
                }
                #cancelEmailBtn:hover {
                    background: #f3f4f6;
                    border-color: #d1d5db;
                }
                #sendEmailBtn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                }
                #sendEmailBtn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            </style>
        `;

        document.body.appendChild(modal);

        // Focus email input
        setTimeout(() => {
            document.getElementById('transcriptEmail').focus();
        }, 300);

        // Close modal on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close modal on cancel
        document.getElementById('cancelEmailBtn').addEventListener('click', () => {
            modal.remove();
        });

        // Handle form submission
        document.getElementById('emailTranscriptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEmailTranscript(modal);
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async handleEmailTranscript(modal) {
        const emailInput = document.getElementById('transcriptEmail');
        const sendBtn = document.getElementById('sendEmailBtn');
        const messageDiv = document.getElementById('emailModalMessage');
        const email = emailInput.value.trim();

        if (!email) {
            this.showModalMessage(messageDiv, 'Please enter your email address', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showModalMessage(messageDiv, 'Please enter a valid email address', 'error');
            return;
        }

        // Disable form
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        emailInput.disabled = true;

        try {
            const response = await fetch('/api/chat/email-transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    transcript: this.conversationHistory,
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showModalMessage(messageDiv, '✅ Success! Check your email inbox.', 'success');
                
                // Close modal after 2 seconds
                setTimeout(() => {
                    modal.remove();
                    
                    // Show confirmation in chat
                    this.addMessage('ai', `Great! I've sent your chat transcript to ${email}. Our team will follow up with you within 24 hours. 📧`);
                }, 2000);
            } else {
                throw new Error(result.error || 'Failed to send transcript');
            }
        } catch (error) {
            console.error('Email transcript error:', error);
            this.showModalMessage(messageDiv, error.message || 'Failed to send. Please try again.', 'error');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Chat 📧';
            emailInput.disabled = false;
        }
    }

    showModalMessage(messageDiv, text, type) {
        messageDiv.style.display = 'block';
        messageDiv.textContent = text;
        
        if (type === 'success') {
            messageDiv.style.background = '#d1fae5';
            messageDiv.style.color = '#065f46';
            messageDiv.style.borderLeft = '4px solid #10b981';
        } else {
            messageDiv.style.background = '#fee2e2';
            messageDiv.style.color = '#991b1b';
            messageDiv.style.borderLeft = '4px solid #ef4444';
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChat;
}
