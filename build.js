const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const filesToMinify = [
  'app.js',
  'auth.js',
  'family-setup.js',
  'modules/card.js',
  'modules/dashboard.js',
  'modules/expenses.js',
  'modules/incomes.js',
  'utils/currency.js',
  'utils/dates.js',
  'store/state.js'
];

const cssFiles = [
  'styles.css'
];

async function minifyJS(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = await minify(code, {
      compress: true,
      mangle: true,
      format: {
        comments: false
      }
    });
    
    const outputPath = filePath.replace('.js', '.min.js');
    fs.writeFileSync(outputPath, result.code);
    console.log(`✓ Minified ${filePath} -> ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error minifying ${filePath}:`, error.message);
    return false;
  }
}

function copyFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const outputPath = filePath;
    fs.writeFileSync(outputPath, content);
    console.log(`✓ Copied ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error copying ${filePath}:`, error.message);
    return false;
  }
}

async function build() {
  console.log('🚀 Starting build process...\n');
  
  // Create dist directory
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  
  // Minify JavaScript files
  console.log('Minifying JavaScript files:');
  let jsSuccess = 0;
  for (const file of filesToMinify) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const success = await minifyJS(filePath);
      if (success) jsSuccess++;
    }
  }
  
  // Copy CSS files (could add CSS minification)
  console.log('\nCopying CSS files:');
  let cssSuccess = 0;
  for (const file of cssFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const success = copyFile(filePath);
      if (success) cssSuccess++;
    }
  }
  
  // Copy other static files
  console.log('\nCopying static files:');
  const staticFiles = [
    'index.html',
    'login.html',
    'family-setup.html',
    'manifest.webmanifest',
    'icon.svg',
    'sw.js'
  ];
  
  let staticSuccess = 0;
  for (const file of staticFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const success = copyFile(filePath);
      if (success) staticSuccess++;
    }
  }
  
  console.log(`\n✅ Build complete!`);
  console.log(`   JavaScript: ${jsSuccess}/${filesToMinify.length} files minified`);
  console.log(`   CSS: ${cssSuccess}/${cssFiles.length} files copied`);
  console.log(`   Static: ${staticSuccess}/${staticFiles.length} files copied`);
}

build().catch(console.error);
