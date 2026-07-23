import { defineConfig } from 'cypress'

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://127.0.0.1:4173',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
    screenshotOnRunFailure: true,
    experimentalMemoryManagement: true,
    numTestsKeptInMemory: 0,
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium') {
          launchOptions.args.push(
            '--no-sandbox',
            '--disable-gpu',
            '--in-process-gpu',
            '--disable-gpu-compositing',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-video-decode',
            '--disable-dev-shm-usage',
          )
        }
        return launchOptions
      })
    },
  },
})
