/**
 * Form Handler Class
 * Handles contact form submissions and validation
 */
class FormHandler {
    constructor(formId = 'contactForm') {
        this.form = document.getElementById(formId);
        if (!this.form) {
            // Try alternative form ID
            this.form = document.getElementById('quoteForm');
        }
        
        if (this.form) {
            this.statusDiv = this.form.querySelector('.form-status') || document.getElementById('formStatus');
            this.apiEndpoint = '/api/send-email';
            this.init();
        }
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupValidation();
    }

    setupValidation() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
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
        const value = field.value.trim();
        let isValid = true;

        // Check required fields
        if (field.hasAttribute('required') && !value) {
            isValid = false;
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(value);
        }

        // Phone validation (if value exists)
        if (field.type === 'tel' && value) {
            const phoneRegex = /^[\d\s\-\(\)\+]+$/;
            isValid = phoneRegex.test(value);
        }

        // Date validation (if value exists) - prevent past dates
        if (field.type === 'date' && value) {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isValid = selectedDate >= today;
        }

        // Update field styling
        if (!isValid) {
            field.classList.add('error');
            field.style.borderColor = 'var(--error)';
        } else {
            field.classList.remove('error');
            field.style.borderColor = '';
        }

        return isValid;
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
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

        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());

        // Show loading state
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                this.showStatus('success', result.message || 'Thank you! Your message has been sent successfully. We\'ll get back to you soon.');
                this.form.reset();
                
                // Track conversion (if you use analytics)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'form_submission', {
                        'event_category': 'contact',
                        'event_label': 'contact_form'
                    });
                }
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
        this.statusDiv.className = `form-status ${type}`;
        this.statusDiv.textContent = message;
        this.statusDiv.style.display = 'block';

        // Auto-hide after 7 seconds
        setTimeout(() => {
            this.statusDiv.style.display = 'none';
        }, 7000);

        // Scroll to status message
        this.statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new FormHandler();
    });
} else {
    new FormHandler();
}
