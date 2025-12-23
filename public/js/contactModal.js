/**
 * Contact Modal Component
 * Handles popup contact form with same logic as contact page
 */
class ContactModal {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.init();
    }

    init() {
        // Create modal HTML structure
        this.createModal();
        
        // Attach event listeners
        this.attachEventListeners();
    }

    createModal() {
        const modalHTML = `
            <!-- Contact Modal -->
            <div id="contactModal" class="contact-modal" style="display: none;">
                <div class="contact-modal-backdrop"></div>
                <div class="contact-modal-container">
                    <div class="contact-modal-content">
                        <!-- Close Button -->
                        <button class="contact-modal-close" aria-label="Close modal">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <!-- Modal Header -->
                        <div class="contact-modal-header">
                            <h2>Get In Touch</h2>
                            <p>Fill out the form below and we'll get back to you within 24 hours.</p>
                        </div>

                        <!-- Contact Form -->
                        <form id="modalContactForm" class="contact-modal-form">
                            <div class="form-group">
                                <label for="modal-name">Your Name *</label>
                                <input type="text" id="modal-name" name="name" required placeholder="John Smith">
                            </div>

                            <div class="form-group">
                                <label for="modal-email">Email *</label>
                                <input type="email" id="modal-email" name="email" required placeholder="john@example.com">
                            </div>

                            <div class="form-group">
                                <label for="modal-phone">Phone</label>
                                <input type="tel" id="modal-phone" name="phone" placeholder="0412 345 678">
                            </div>

                            <div class="form-group">
                                <label for="modal-company">Company</label>
                                <input type="text" id="modal-company" name="company" placeholder="Your Business Name">
                            </div>

                            <div class="form-group">
                                <label for="modal-service-interest">Service Interest *</label>
                                <select id="modal-service-interest" name="service-interest" required>
                                    <option value="">Select a service...</option>
                                    <option value="ai-assistants">AI Assistants & Chatbots</option>
                                    <option value="website-development">Website Development</option>
                                    <option value="seo-local-seo">SEO & Local SEO</option>
                                    <option value="social-growth">Social Media Growth</option>
                                    <option value="crm-sales-funnel">CRM & Sales Automation</option>
                                    <option value="growth-strategy-analytics">Growth Strategy & Analytics</option>
                                    <option value="other">Other / Not Sure</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="modal-budget">Budget Range</label>
                                <select id="modal-budget" name="budget">
                                    <option value="">Select budget range...</option>
                                    <option value="under-2k">Under $2,000</option>
                                    <option value="2k-5k">$2,000 - $5,000</option>
                                    <option value="5k-10k">$5,000 - $10,000</option>
                                    <option value="10k-plus">$10,000+</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="modal-message">Your Message *</label>
                                <textarea id="modal-message" name="message" required rows="4" placeholder="Tell us about your project, goals, and any specific challenges you're facing..."></textarea>
                            </div>

                            <button type="submit" class="btn btn-primary btn-full">Send Message</button>

                            <div id="modalFormMessage" class="form-status" style="display: none;"></div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Append to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('contactModal');
    }

    attachEventListeners() {
        // Close button click
        const closeBtn = this.modal.querySelector('.contact-modal-close');
        closeBtn.addEventListener('click', () => this.close());

        // Backdrop click
        const backdrop = this.modal.querySelector('.contact-modal-backdrop');
        backdrop.addEventListener('click', () => this.close());

        // Prevent modal content click from closing
        const modalContent = this.modal.querySelector('.contact-modal-content');
        modalContent.addEventListener('click', (e) => e.stopPropagation());

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Form submission
        const form = document.getElementById('modalContactForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Form validation
        this.setupValidation();
    }

    setupValidation() {
        const form = document.getElementById('modalContactForm');
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.validateField(input);
                }
            });
        });
    }

    validateField(field) {
        let isValid = true;

        // Required field validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
        }

        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(field.value);
        }

        // Phone validation (Australian format)
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^(\+?61|0)[2-478](?:[ -]?[0-9]){8}$/;
            isValid = phoneRegex.test(field.value.replace(/\s/g, ''));
        }

        // Update field styling
        if (!isValid) {
            field.classList.add('error');
            field.style.borderColor = '#ef4444';
        } else {
            field.classList.remove('error');
            field.style.borderColor = '';
        }

        return isValid;
    }

    validateForm() {
        const form = document.getElementById('modalContactForm');
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Validate form
        if (!this.validateForm()) {
            this.showStatus('error', 'Please fill in all required fields correctly.');
            return;
        }

        const form = document.getElementById('modalContactForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                this.showStatus('success', result.message || 'Thank you! Your message has been sent successfully. We\'ll get back to you within 24 hours.');
                form.reset();

                // Track conversion (if Google Analytics is available)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'form_submission', {
                        'event_category': 'contact',
                        'event_label': 'contact_modal'
                    });
                }

                // Close modal after 3 seconds
                setTimeout(() => {
                    this.close();
                }, 3000);
            } else {
                this.showStatus('error', result.error || 'Something went wrong. Please try again or contact us directly.');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showStatus('error', 'Network error. Please check your connection and try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    showStatus(type, message) {
        const statusDiv = document.getElementById('modalFormMessage');
        statusDiv.style.display = 'block';
        statusDiv.className = `form-status ${type}`;
        statusDiv.textContent = message;

        // Auto-hide after 5 seconds for errors
        if (type === 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }

    open() {
        this.isOpen = true;
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Animate in
        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);
    }

    close() {
        this.isOpen = false;
        this.modal.classList.remove('active');
        
        // Animate out
        setTimeout(() => {
            this.modal.style.display = 'none';
            document.body.style.overflow = ''; // Re-enable scrolling
            
            // Clear form and status
            const form = document.getElementById('modalContactForm');
            form.reset();
            document.getElementById('modalFormMessage').style.display = 'none';
        }, 300);
    }
}

// Initialize modal when DOM is ready
let contactModalInstance;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        contactModalInstance = new ContactModal();
    });
} else {
    contactModalInstance = new ContactModal();
}

// Global function to open modal (called by CTA buttons)
function openContactModal() {
    if (contactModalInstance) {
        contactModalInstance.open();
    }
}
