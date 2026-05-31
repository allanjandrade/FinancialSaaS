// Error Tracking Integration (Sentry)
// Configure your Sentry DSN in config.js: window.SENTRY_DSN

class ErrorTracker {
  constructor() {
    this.enabled = false;
    this.dsn = window.SENTRY_DSN || null;
    this.init();
  }

  init() {
    if (!this.dsn) {
      return;
    }

    // Load Sentry SDK
    this.loadSentry().then(() => {
      this.enabled = true;
      this.setupSentry();
    }).catch(error => {
      // Production: Silently fail to avoid exposing errors
    });
  }

  async loadSentry() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@sentry/browser@7.84.0/build/bundle.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  setupSentry() {
    if (typeof Sentry === 'undefined') return;

    Sentry.init({
      dsn: this.dsn,
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      replaysSessionSampleRate: 0.1, // 10% of sessions for replay
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors for replay
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      }
    });

    // Set user context if available
    this.setUserContext();
  }

  setUserContext() {
    if (typeof Sentry === 'undefined' || !this.enabled) return;

    // Try to get user info from localStorage or Supabase
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.email?.split('@')[0]
        });
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }

  captureException(error, context = {}) {
    if (!this.enabled) return;
    
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        extra: context
      });
    }
  }

  captureMessage(message, level = 'info', context = {}) {
    if (!this.enabled) return;
    
    if (typeof Sentry !== 'undefined') {
      Sentry.captureMessage(message, {
        level,
        extra: context
      });
    }
  }

  addBreadcrumb(breadcrumb) {
    if (!this.enabled) return;
    
    if (typeof Sentry !== 'undefined') {
      Sentry.addBreadcrumb(breadcrumb);
    }
  }
}

// Initialize error tracking
const errorTracker = new ErrorTracker();

// Global error handler
window.addEventListener('error', (event) => {
  errorTracker.captureException(event.error, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  errorTracker.captureException(event.reason, {
    message: 'Unhandled Promise Rejection'
  });
});
