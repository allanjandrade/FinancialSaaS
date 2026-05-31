const fs = require('fs');
const path = require('path');

// Simple test framework for production readiness checks

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running production readiness tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        this.results.push({ name: test.name, status: 'PASS' });
        console.log(`✓ ${test.name}`);
      } catch (error) {
        this.results.push({ name: test.name, status: 'FAIL', error: error.message });
        console.log(`✗ ${test.name}: ${error.message}`);
      }
    }
    
    this.printSummary();
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`\n📊 Test Results: ${passed}/${this.results.length} passed`);
    
    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    return failed === 0;
  }
}

const runner = new TestRunner();

// Security Tests
runner.test('No hardcoded credentials in source files', async () => {
  const jsFiles = [
    'app.js', 'auth.js', 'family-setup.js',
    'modules/card.js', 'modules/dashboard.js', 'modules/expenses.js', 'modules/incomes.js'
  ];
  
  for (const file of jsFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('supabase.co') && !content.includes('SUPABASE_CONFIG')) {
        throw new Error(`Hardcoded Supabase URL found in ${file}`);
      }
    }
  }
});

runner.test('Sensitive files are in .gitignore', async () => {
  const gitignorePath = path.join(__dirname, '.gitignore');
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  
  const sensitiveFiles = ['config.js', 'supabase-config.js', '.env'];
  for (const file of sensitiveFiles) {
    if (!gitignore.includes(file)) {
      throw new Error(`${file} not found in .gitignore`);
    }
  }
});

runner.test('No console.log statements in production code', async () => {
  const jsFiles = [
    'app.js', 'auth.js', 'family-setup.js',
    'modules/card.js', 'modules/dashboard.js', 'modules/expenses.js', 'modules/incomes.js'
  ];
  
  for (const file of jsFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      // Remove comments before checking for console statements
      const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const consoleLogs = withoutComments.match(/console\.(log|error|warn|debug)/g);
      if (consoleLogs && consoleLogs.length > 0) {
        throw new Error(`Found ${consoleLogs.length} console statements in ${file}`);
      }
    }
  }
});

// File Structure Tests
runner.test('Required HTML files exist', async () => {
  const requiredFiles = ['index.html', 'login.html', 'family-setup.html'];
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${file} does not exist`);
    }
  }
});

runner.test('Required JavaScript files exist', async () => {
  const requiredFiles = ['app.js', 'auth.js', 'family-setup.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${file} does not exist`);
    }
  }
});

runner.test('Service worker exists', async () => {
  const swPath = path.join(__dirname, 'sw.js');
  if (!fs.existsSync(swPath)) {
    throw new Error('sw.js does not exist');
  }
});

runner.test('PWA manifest exists', async () => {
  const manifestPath = path.join(__dirname, 'manifest.webmanifest');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.webmanifest does not exist');
  }
});

// Configuration Tests
runner.test('Netlify configuration exists', async () => {
  const netlifyPath = path.join(__dirname, 'netlify.toml');
  if (!fs.existsSync(netlifyPath)) {
    throw new Error('netlify.toml does not exist');
  }
  
  const content = fs.readFileSync(netlifyPath, 'utf8');
  if (!content.includes('X-Frame-Options')) {
    throw new Error('Security headers not configured in netlify.toml');
  }
});

runner.test('Database setup files exist', async () => {
  const dbFiles = ['supabase-setup-clean.sql', 'supabase-setup.sql'];
  for (const file of dbFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${file} does not exist`);
    }
  }
});

// Content Tests
runner.test('HTML files have proper meta tags', async () => {
  const htmlFiles = ['index.html', 'login.html'];
  for (const file of htmlFiles) {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('viewport')) {
      throw new Error(`${file} missing viewport meta tag`);
    }
    if (!content.includes('charset')) {
      throw new Error(`${file} missing charset meta tag`);
    }
  }
});

runner.test('No hardcoded API keys in example files', async () => {
  const exampleFiles = ['config.js.example', '.env.example'];
  for (const file of exampleFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('oedbaemzavzvxysikkpk')) {
        throw new Error(`Actual API key found in ${file}`);
      }
    }
  }
});

// Run tests
runner.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
