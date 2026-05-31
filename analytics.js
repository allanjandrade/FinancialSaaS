// Analytics Integration (Google Analytics 4)
// Configure your GA Measurement ID in config.js: window.GA_MEASUREMENT_ID

class Analytics {
  constructor() {
    this.enabled = false;
    this.measurementId = window.GA_MEASUREMENT_ID || null;
    this.init();
  }

  init() {
    if (!this.measurementId) {
      return;
    }

    // Load Google Analytics
    this.loadGA().then(() => {
      this.enabled = true;
      this.setupGA();
    }).catch(error => {
      // Production: Silently fail to avoid exposing errors
    });
  }

  async loadGA() {
    return new Promise((resolve, reject) => {
      // Load gtag.js
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  setupGA() {
    if (typeof gtag === 'undefined') return;

    // Initialize GA4
    gtag('js', new Date());
    gtag('config', this.measurementId, {
      send_page_view: true,
      anonymize_ip: true, // Privacy: anonymize IP addresses
      cookie_flags: 'SameSite=None;Secure' // Secure cookies
    });

    // Track initial page view
    this.trackPageView();
  }

  trackPageView(pagePath = null, pageTitle = null) {
    if (!this.enabled) return;
    
    if (typeof gtag !== 'undefined') {
      gtag('event', 'page_view', {
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title
      });
    }
  }

  trackEvent(eventName, parameters = {}) {
    if (!this.enabled) return;
    
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, parameters);
    }
  }

  // Specific business events
  trackLogin(method = 'email') {
    this.trackEvent('login', { method });
  }

  trackSignup(method = 'email') {
    this.trackEvent('sign_up', { method });
  }

  trackFamilyCreated() {
    this.trackEvent('family_created');
  }

  trackMemberInvited() {
    this.trackEvent('member_invited');
  }

  trackExpenseAdded(category, amount) {
    this.trackEvent('expense_added', {
      category,
      value: amount,
      currency: 'BRL'
    });
  }

  trackIncomeAdded(category, amount) {
    this.trackEvent('income_added', {
      category,
      value: amount,
      currency: 'BRL'
    });
  }

  trackReceiptUpload(success = true) {
    this.trackEvent('receipt_upload', { success });
  }

  trackAiQuery(queryLength) {
    this.trackEvent('ai_query', { query_length: queryLength });
  }

  trackExport(format = 'json') {
    this.trackEvent('data_export', { format });
  }

  trackError(errorName, errorMessage) {
    this.trackEvent('error', {
      error_name: errorName,
      error_message: errorMessage?.substring(0, 100) // Limit length
    });
  }
}

// Initialize analytics
const analytics = new Analytics();

// Track page navigation (SPA)
let lastPath = window.location.pathname;
let observer = null;

// Wait for DOM to be ready before observing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer = new MutationObserver(() => {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath) {
          analytics.trackPageView();
          lastPath = currentPath;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
} else if (document.body) {
  observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      analytics.trackPageView();
      lastPath = currentPath;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
