/**
 * Main JavaScript file
 * Handles general website functionality
 */

// Mobile Menu Toggle with Dropdown Support
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');
const MOBILE_BREAKPOINT = 768;

const isMobileView = () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

const setMenuState = (isActive) => {
    if (!navLinks) return;
    if (!isMobileView()) {
        navLinks.style.transform = '';
        navLinks.style.opacity = '';
        navLinks.style.visibility = '';
        return;
    }
    navLinks.style.transform = isActive ? 'translateX(0)' : 'translateX(100%)';
    navLinks.style.opacity = isActive ? '1' : '0';
    navLinks.style.visibility = isActive ? 'visible' : 'hidden';
};

const setHamburgerState = (isActive) => {
    if (!mobileMenuToggle) return;
    const spans = mobileMenuToggle.querySelectorAll('span');
    if (isActive) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
    } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
    }
};

if (mobileMenuToggle && navLinks) {
    setMenuState(false);
    
    // Toggle mobile menu
    mobileMenuToggle.addEventListener('click', (e) => {
        if (!isMobileView()) return;
        e.stopPropagation();
        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.classList.toggle('menu-open');
        const isActive = navLinks.classList.contains('active');
        setMenuState(isActive);
        setHamburgerState(isActive);
    });

    // Handle mobile dropdown toggles - ALL dropdowns, not just services
    const mobileDropdowns = document.querySelectorAll('.nav-item-dropdown');
    mobileDropdowns.forEach(dropdown => {
        const dropdownLink = dropdown.querySelector(':scope > a');
        if (dropdownLink) {
            dropdownLink.addEventListener('click', (e) => {
                // On mobile, toggle dropdown instead of navigating
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                    
                    // Close other dropdowns
                    mobileDropdowns.forEach(other => {
                        if (other !== dropdown) {
                            other.classList.remove('active');
                        }
                    });
                }
            });
        }
    });

    // Close menu when clicking a non-dropdown link
    document.querySelectorAll('.nav-links a:not(.nav-item-dropdown > a)').forEach(link => {
        link.addEventListener('click', () => {
            if (!isMobileView()) return;
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
            setMenuState(false);
            setHamburgerState(false);
            
            // Close all dropdowns
            mobileDropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!isMobileView()) return;
        if (navLinks.classList.contains('active') && 
            !e.target.closest('.nav-links') && 
            !e.target.closest('.mobile-menu-toggle')) {
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
            setMenuState(false);
            setHamburgerState(false);
            
            // Close all dropdowns
            mobileDropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
    window.addEventListener('resize', () => {
        const isActive = mobileMenuToggle.classList.contains('active');
        if (!isMobileView()) {
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
        setMenuState(isMobileView() && isActive);
        setHamburgerState(isMobileView() && isActive);
    });
}

// Make logo clickable to scroll to top
const logo = document.querySelector('.logo');
if (logo) {
    logo.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Smooth scrolling for navigation links with browser history
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Update browser history and URL bar
            window.history.pushState({ section: href }, '', href);
            
            // Close mobile menu if open
            if (mobileMenuToggle && navLinks && isMobileView()) {
                mobileMenuToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.classList.remove('menu-open');
                setMenuState(false);
                setHamburgerState(false);
            }
        }
    });
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.section) {
        const target = document.querySelector(e.state.section);
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
});

// Active navigation highlighting on scroll
function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
}

// Throttle scroll events for better performance
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
    }
    scrollTimeout = window.requestAnimationFrame(() => {
        updateActiveNav();
        handleHeaderShadow();
    });
});

// Add shadow to header on scroll
function handleHeaderShadow() {
    const header = document.querySelector('header');
    if (window.scrollY > 10) {
        header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    }
}


// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards and other elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.service-card, .stat, .info-item');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Service link quick actions
document.querySelectorAll('.service-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const serviceName = link.closest('.service-card').querySelector('h3').textContent;
        
        // Scroll to contact form
        document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
        
        // Pre-fill service field if chat is available
        setTimeout(() => {
            const serviceSelect = document.querySelector('#serviceType');
            if (serviceSelect) {
                const options = Array.from(serviceSelect.options);
                const matchingOption = options.find(opt => 
                    opt.text.toLowerCase().includes(serviceName.toLowerCase())
                );
                if (matchingOption) {
                    serviceSelect.value = matchingOption.value;
                }
            }
        }, 500);
    });
});

// Console welcome message (optional, for developers)
console.log(
    '%c✨ Websited Digital Marketing',
    'color: #2563EB; font-size: 16px; font-weight: bold;'
);

// Handle form input animations
document.querySelectorAll('.form-group input, .form-group textarea, .form-group select').forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        if (!this.value) {
            this.parentElement.classList.remove('focused');
        }
    });
});

// Quick contact trigger from service cards
function initQuickContact() {
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('service-link')) {
                // Optional: Trigger AI chat with pre-filled message
                const serviceName = card.querySelector('h3').textContent;
                if (typeof aiChatInstance !== 'undefined') {
                    // This will open chat with a pre-filled message
                    // Uncomment if you want this behavior:
                    // aiChatInstance.sendMessage(`I'm interested in ${serviceName}`);
                }
            }
        });
    });
}

// Initialize quick contact
document.addEventListener('DOMContentLoaded', initQuickContact);

// Handle page load animations
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Performance: Lazy load images (if you add images later)
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// FAQ Accordion
document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.closest('.faq-item');
            const answer = faqItem.querySelector('.faq-answer');
            const isOpen = question.getAttribute('aria-expanded') === 'true';
            
            // Close all other FAQs
            document.querySelectorAll('.faq-question').forEach(q => {
                if (q !== question) {
                    q.setAttribute('aria-expanded', 'false');
                    const otherItem = q.closest('.faq-item');
                    const otherAnswer = otherItem.querySelector('.faq-answer');
                    if (otherAnswer) {
                        otherAnswer.style.maxHeight = '0';
                        otherAnswer.classList.remove('active');
                    }
                }
            });
            
            // Toggle current FAQ
            if (isOpen) {
                question.setAttribute('aria-expanded', 'false');
                answer.style.maxHeight = '0';
                answer.classList.remove('active');
            } else {
                question.setAttribute('aria-expanded', 'true');
                answer.style.maxHeight = answer.scrollHeight + 'px';
                answer.classList.add('active');
            }
        });
    });
});

