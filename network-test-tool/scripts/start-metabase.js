#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.blue('🚀 Starting Blockchain Analytics with Metabase...'));

// Check if Docker is available
function checkDockerAvailable() {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['--version'], { stdio: 'ignore' });
    docker.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Check if docker-compose is available
function checkDockerComposeAvailable() {
  return new Promise((resolve) => {
    const dockerCompose = spawn('docker-compose', ['--version'], { stdio: 'ignore' });
    dockerCompose.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Create necessary directories
function createDirectories() {
  const dirs = ['metabase-data', 'metabase-config'];
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(`✅ Created directory: ${dir}`));
    }
  });
}

// Start Metabase using Docker Compose
function startMetabase() {
  return new Promise((resolve, reject) => {
    console.log(chalk.yellow('📦 Starting Metabase container...'));

    const dockerCompose = spawn('docker-compose', ['up', '-d'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    dockerCompose.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker Compose failed with exit code ${code}`));
      }
    });
  });
}

// Wait for Metabase to be ready
function waitForMetabase() {
  return new Promise((resolve) => {
    console.log(chalk.yellow('⏳ Waiting for Metabase to start...'));

    let attempts = 0;
    const maxAttempts = 30;

    const checkHealth = () => {
      const curl = spawn('curl', ['-f', 'http://localhost:3000/api/health'], {
        stdio: 'ignore'
      });

      curl.on('close', (code) => {
        attempts++;
        if (code === 0) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkHealth, 5000); // Wait 5 seconds between attempts
        } else {
          console.log(chalk.yellow('⚠️  Health check timeout - Metabase may still be starting'));
          resolve();
        }
      });
    };

    // Start checking after 10 seconds
    setTimeout(checkHealth, 10000);
  });
}

// Main execution
async function main() {
  try {
    // Check prerequisites
    const dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      console.error(chalk.red('❌ Docker is not available. Please install Docker first.'));
      process.exit(1);
    }

    const dockerComposeAvailable = await checkDockerComposeAvailable();
    if (!dockerComposeAvailable) {
      console.error(chalk.red('❌ Docker Compose is not available. Please install Docker Compose first.'));
      process.exit(1);
    }

    // Create directories
    createDirectories();

    // Start Metabase
    await startMetabase();

    // Wait for Metabase to be ready
    await waitForMetabase();

    console.log(chalk.green('🎉 Metabase is ready!'));
    console.log('');
    console.log(chalk.blue('📊 Access your blockchain analytics:'));
    console.log(chalk.white('   • Metabase Dashboard: http://localhost:3000'));
    console.log(chalk.white('   • Existing Dashboard: http://localhost:5488'));
    console.log(chalk.white('   • JSReports Studio: http://localhost:5489'));
    console.log('');
    console.log(chalk.yellow('🔧 Next steps:'));
    console.log(chalk.white('   1. Open http://localhost:3000 in your browser'));
    console.log(chalk.white('   2. Create admin user account'));
    console.log(chalk.white('   3. Add SQLite database connection'));
    console.log(chalk.white('   4. Import dashboard templates'));
    console.log('');
    console.log(chalk.gray('💡 Database path: /blockchain-data/test-results.db'));
    console.log(chalk.gray('📚 Documentation: METABASE-IMPLEMENTATION-PLAN.md'));

  } catch (error) {
    console.error(chalk.red('❌ Failed to start Metabase:'), error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Shutting down...'));
  const dockerCompose = spawn('docker-compose', ['down'], { stdio: 'inherit' });
  dockerCompose.on('close', () => {
    process.exit(0);
  });
});

main();