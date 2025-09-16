#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const https = require('https');

const METABASE_VERSION = 'v0.48.6';
const METABASE_JAR = `metabase-${METABASE_VERSION}.jar`;
const METABASE_URL = `https://downloads.metabase.com/${METABASE_VERSION}/metabase.jar`;

console.log(chalk.blue('🚀 Starting Blockchain Analytics with Metabase (JAR mode)...'));

// Check if Java is available
function checkJavaAvailable() {
  return new Promise((resolve) => {
    const java = spawn('java', ['-version'], { stdio: 'ignore' });
    java.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Download Metabase JAR if not exists
function downloadMetabase() {
  return new Promise((resolve, reject) => {
    const jarPath = path.join(process.cwd(), METABASE_JAR);

    if (fs.existsSync(jarPath)) {
      console.log(chalk.green('✅ Metabase JAR already exists'));
      resolve(jarPath);
      return;
    }

    console.log(chalk.yellow('📥 Downloading Metabase JAR...'));
    console.log(chalk.gray(`   From: ${METABASE_URL}`));

    const file = fs.createWriteStream(jarPath);

    https.get(METABASE_URL, (response) => {
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.pipe(file);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB)`);
      });

      file.on('finish', () => {
        file.close();
        console.log(chalk.green('\n✅ Metabase JAR downloaded successfully'));
        resolve(jarPath);
      });
    }).on('error', (err) => {
      fs.unlink(jarPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Create environment configuration
function createEnvironment() {
  const dataDir = path.join(process.cwd(), 'metabase-data');
  const dbPath = path.join(process.cwd(), 'data', 'test-results.db');

  // Create data directory
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(chalk.green('✅ Created Metabase data directory'));
  }

  // Check if SQLite database exists
  if (!fs.existsSync(dbPath)) {
    console.log(chalk.yellow('⚠️  SQLite database not found at:', dbPath));
    console.log(chalk.yellow('   Run some blockchain tests first to generate data'));
  } else {
    console.log(chalk.green('✅ Found blockchain test database'));
  }

  return {
    MB_DB_TYPE: 'h2',
    MB_DB_FILE: path.join(dataDir, 'metabase.db'),
    MB_SITE_NAME: 'Blockchain Test Analytics',
    MB_SITE_URL: 'http://localhost:3000',
    JAVA_OPTS: '-Xmx1g'
  };
}

// Start Metabase JAR
function startMetabase(jarPath, env) {
  return new Promise((resolve, reject) => {
    console.log(chalk.yellow('🚀 Starting Metabase server...'));

    const metabase = spawn('java', ['-jar', jarPath], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverReady = false;

    metabase.stdout.on('data', (data) => {
      const output = data.toString();

      // Check for server ready message
      if (output.includes('Metabase Initialization COMPLETE') ||
          output.includes('server started on port')) {
        serverReady = true;
        resolve(metabase);
      }

      // Show startup progress
      if (output.includes('Loading') || output.includes('Setting up')) {
        console.log(chalk.gray('   ' + output.trim()));
      }
    });

    metabase.stderr.on('data', (data) => {
      const error = data.toString();
      console.log(chalk.red('   Error: ' + error.trim()));
    });

    metabase.on('close', (code) => {
      if (!serverReady) {
        reject(new Error(`Metabase failed to start (exit code: ${code})`));
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!serverReady) {
        metabase.kill();
        reject(new Error('Metabase startup timeout'));
      }
    }, 300000);
  });
}

// Wait for Metabase to be responsive
function waitForMetabase() {
  return new Promise((resolve) => {
    console.log(chalk.yellow('⏳ Waiting for Metabase to be ready...'));

    let attempts = 0;
    const maxAttempts = 20;

    const checkHealth = () => {
      const http = require('http');

      const req = http.get('http://localhost:3000/api/health', (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retryCheck();
        }
      });

      req.on('error', () => {
        retryCheck();
      });

      req.setTimeout(2000, () => {
        req.destroy();
        retryCheck();
      });
    };

    const retryCheck = () => {
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkHealth, 3000);
      } else {
        console.log(chalk.yellow('⚠️  Health check timeout - Metabase may still be starting'));
        resolve();
      }
    };

    // Start checking after 10 seconds
    setTimeout(checkHealth, 10000);
  });
}

// Main execution
async function main() {
  try {
    // Check Java availability
    const javaAvailable = await checkJavaAvailable();
    if (!javaAvailable) {
      console.error(chalk.red('❌ Java is not available. Please install Java 11+ first.'));
      console.log(chalk.yellow('💡 Download from: https://adoptium.net/'));
      process.exit(1);
    }

    // Download Metabase if needed
    const jarPath = await downloadMetabase();

    // Create environment
    const env = createEnvironment();

    // Start Metabase
    const metabaseProcess = await startMetabase(jarPath, env);

    // Wait for ready state
    await waitForMetabase();

    console.log(chalk.green('🎉 Metabase is ready!'));
    console.log('');
    console.log(chalk.blue('📊 Access your blockchain analytics:'));
    console.log(chalk.white('   • Metabase Dashboard: http://localhost:3000'));
    console.log(chalk.white('   • Existing Dashboard: http://localhost:5488'));
    console.log(chalk.white('   • JSReports Studio: http://localhost:5489'));
    console.log('');
    console.log(chalk.yellow('🔧 Database connection details:'));
    console.log(chalk.white('   • Database Type: SQLite'));
    console.log(chalk.white('   • Database File: ' + path.join(process.cwd(), 'data', 'test-results.db')));
    console.log('');
    console.log(chalk.yellow('🔧 Next steps:'));
    console.log(chalk.white('   1. Open http://localhost:3000 in your browser'));
    console.log(chalk.white('   2. Create admin user account'));
    console.log(chalk.white('   3. Add SQLite database connection'));
    console.log(chalk.white('   4. Import dashboard templates'));
    console.log('');
    console.log(chalk.gray('📚 Documentation: docs/metabase/README.md'));
    console.log(chalk.gray('⏹️  Stop with Ctrl+C'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down Metabase...'));
      metabaseProcess.kill('SIGTERM');
      setTimeout(() => {
        metabaseProcess.kill('SIGKILL');
        process.exit(0);
      }, 5000);
    });

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    console.error(chalk.red('❌ Failed to start Metabase:'), error.message);

    if (error.message.includes('Java')) {
      console.log(chalk.yellow('💡 Try installing Java 11+ from: https://adoptium.net/'));
    } else if (error.message.includes('download')) {
      console.log(chalk.yellow('💡 Check your internet connection and try again'));
    }

    process.exit(1);
  }
}

main();