// scripts/verify-env.js
const path = require('path');
const fs = require('fs');

const main = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  console.log('\nEnvironment Verification');
  console.log('=====================');
  console.log('Current directory:', process.cwd());
  console.log('Looking for .env at:', envPath);
  
  if (!fs.existsSync(envPath)) {
    console.error('\n❌ .env file not found!');
    process.exit(1);
  }

  console.log('\n✅ .env file found');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=')[0]);

  console.log('\nEnvironment variables found:');
  envVars.forEach(varName => {
    console.log(`- ${varName}`);
  });
};

main();