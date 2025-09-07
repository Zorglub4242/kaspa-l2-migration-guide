const { DataStorage } = require('../utils/data-storage');
const readline = require('readline');
const chalk = require('chalk');
const { logger } = require('../utils/logger');

/**
 * Data Management Utility Script
 * Provides comprehensive data management capabilities for test sessions
 * Supports session isolation, data purging, and analytics export
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function displayMainMenu() {
  logger.log(chalk.cyan('📊 Data Management Utility'));
  logger.gray('='.repeat(80));
  
  logger.info('Choose a data management operation:');
  logger.info('');
  logger.info('📋 SESSION MANAGEMENT:');
  logger.info('  1. List all sessions');
  logger.info('  2. View session details');
  logger.info('  3. Archive specific session');
  logger.info('  4. Create isolated test session');
  logger.info('');
  logger.info('🧹 DATA CLEANUP:');
  logger.info('  5. Purge data before date (dry run)');
  logger.info('  6. Purge data before date (execute)');
  logger.info('  7. Auto-archive old sessions');
  logger.info('  8. Get storage statistics');
  logger.info('');
  logger.info('📈 ANALYTICS EXPORT:');
  logger.info('  9. Export data for analytics (JSON)');
  logger.info('  10. Export data for analytics (CSV)');
  logger.info('  11. Export specific sessions');
  logger.info('');
  logger.info('⚙️ CONFIGURATION:');
  logger.info('  12. Create new storage configuration');
  logger.info('  13. Switch storage mode');
  logger.info('');
  logger.info('  0. Exit');
  logger.gray('='.repeat(80));
}

async function listAllSessions() {
  logger.cyan('\n📋 ALL TEST SESSIONS');
  logger.gray('-'.repeat(60));
  
  const storage = new DataStorage();
  const sessions = await storage.listSessions();
  
  if (sessions.length === 0) {
    logger.info('No sessions found.');
    return;
  }
  
  logger.info(`Found ${sessions.length} sessions:`);
  logger.info('');
  
  sessions.forEach((session, index) => {
    const duration = session.endTime ? 
      Math.round((new Date(session.endTime) - new Date(session.startTime)) / 1000) : 
      'In Progress';
      
    logger.info(`${index + 1}. ${session.sessionId}`);
    logger.info(`   Test Type: ${session.testType || 'Unknown'}`);
    logger.info(`   Started: ${new Date(session.startTime).toLocaleString()}`);
    logger.info(`   Duration: ${duration}s`);
    logger.info(`   Networks: ${session.networks.join(', ')}`);
    logger.info(`   Operations: ${session.operationCount}, Transactions: ${session.transactionCount}`);
    logger.info('');
  });
}

async function viewSessionDetails() {
  const sessionId = await question('\n🔍 Enter session ID to view details: ');
  
  if (!sessionId.trim()) {
    logger.warning('No session ID provided.');
    return;
  }
  
  const storage = new DataStorage();
  const session = await storage.loadSession(sessionId);
  
  if (!session) {
    logger.error(`Session ${sessionId} not found.`);
    return;
  }
  
  logger.cyan(`\n📋 SESSION DETAILS: ${sessionId}`);
  logger.gray('-'.repeat(80));
  
  logger.info(`Test Type: ${session.testType}`);
  logger.info(`Started: ${new Date(session.startTime).toLocaleString()}`);
  logger.info(`Ended: ${session.endTime ? new Date(session.endTime).toLocaleString() : 'In Progress'}`);
  logger.info(`Duration: ${session.duration ? Math.round(session.duration / 1000) + 's' : 'N/A'}`);
  logger.info(`Networks: ${session.networks.map(n => n.name).join(', ')}`);
  
  logger.info('\n📊 SUMMARY:');
  logger.info(`  Total Operations: ${session.operations.length}`);
  logger.info(`  Total Transactions: ${session.transactions.length}`);
  logger.info(`  Total Deployments: ${session.deployments.length}`);
  logger.info(`  Total Errors: ${session.errors.length}`);
  
  if (session.operations.length > 0) {
    const successRate = session.operations.filter(o => o.success).length / session.operations.length;
    logger.info(`  Success Rate: ${(successRate * 100).toFixed(1)}%`);
  }
  
  logger.info('\n🌐 NETWORK BREAKDOWN:');
  session.networks.forEach(network => {
    const networkOps = session.operations.filter(o => o.network === network.name);
    const networkTx = session.transactions.filter(t => t.network === network.name);
    logger.info(`  ${network.name}:`);
    logger.info(`    Operations: ${networkOps.length}`);
    logger.info(`    Transactions: ${networkTx.length}`);
  });
}

async function purgeDataBeforeDate(dryRun = true) {
  const dateInput = await question('\n🧹 Enter cutoff date (YYYY-MM-DD): ');
  
  try {
    const cutoffDate = new Date(dateInput);
    if (isNaN(cutoffDate.getTime())) {
      logger.error('Invalid date format. Please use YYYY-MM-DD.');
      return;
    }
    
    logger.warning(`\n⚠️ This will ${dryRun ? 'simulate' : 'permanently'} delete all data before ${cutoffDate.toDateString()}`);
    
    if (!dryRun) {
      const confirm = await question('Are you sure? Type "DELETE" to confirm: ');
      if (confirm !== 'DELETE') {
        logger.info('Operation cancelled.');
        return;
      }
    }
    
    const storage = new DataStorage();
    const results = await storage.purgeDataBefore(cutoffDate, { dryRun });
    
    logger.success(`\n${dryRun ? 'Dry run completed' : 'Purge completed'}:`);
    logger.info(`Sessions: ${results.sessionsDeleted}`);
    logger.info(`Contracts: ${results.contractsDeleted}`);
    logger.info(`Metrics: ${results.metricsDeleted}`);
    logger.info(`Analytics: ${results.analyticsDeleted}`);
    
    if (results.errors.length > 0) {
      logger.warning(`Errors encountered: ${results.errors.length}`);
    }
    
  } catch (error) {
    logger.error(`Purge operation failed: ${error.message}`);
  }
}

async function getStorageStats() {
  logger.cyan('\n📊 STORAGE STATISTICS');
  logger.gray('-'.repeat(60));
  
  const storage = new DataStorage();
  const stats = await storage.getStorageStats();
  
  logger.info(`Storage Mode: ${stats.storageMode}`);
  logger.info(`Data Directory: ${stats.dataDirectory}`);
  logger.info(`Total Sessions: ${stats.totalSessions}`);
  logger.info(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  if (stats.oldestSession) {
    logger.info(`Oldest Session: ${new Date(stats.oldestSession).toLocaleString()}`);
    logger.info(`Newest Session: ${new Date(stats.newestSession).toLocaleString()}`);
  }
  
  logger.info(`Networks Covered: ${stats.networkCoverage.join(', ') || 'None'}`);
  logger.info(`Test Types: ${stats.testTypes.join(', ') || 'None'}`);
}

async function exportDataForAnalytics() {
  logger.cyan('\n📈 DATA EXPORT FOR ANALYTICS');
  logger.gray('-'.repeat(60));
  
  const format = await question('Export format (json/csv) [json]: ') || 'json';
  const dateRangeInput = await question('Date range (YYYY-MM-DD to YYYY-MM-DD) or leave empty for all: ');
  const networksInput = await question('Networks (comma-separated) or leave empty for all: ');
  
  const options = {
    includeRawData: true,
    includeAggregated: true
  };
  
  if (dateRangeInput.trim()) {
    const dates = dateRangeInput.split(' to ');
    if (dates.length === 2) {
      options.dateRange = {
        start: new Date(dates[0]),
        end: new Date(dates[1])
      };
    }
  }
  
  if (networksInput.trim()) {
    options.networks = networksInput.split(',').map(n => n.trim());
  }
  
  try {
    const storage = new DataStorage();
    const exportPath = await storage.exportForAnalytics(format, options);
    
    logger.success(`\n📊 Export completed successfully!`);
    logger.info(`File: ${exportPath}`);
    logger.info('You can now import this data into your analytics tools.');
    
  } catch (error) {
    logger.error(`Export failed: ${error.message}`);
  }
}

async function createIsolatedSession() {
  logger.cyan('\n🏷️ CREATE ISOLATED TEST SESSION');
  logger.gray('-'.repeat(60));
  
  const sessionName = await question('Enter session name (e.g., "performance-comparison-v1"): ');
  
  if (!sessionName.trim()) {
    logger.warning('No session name provided.');
    return;
  }
  
  // Validate session name (no special characters)
  const validName = sessionName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  if (validName !== sessionName) {
    logger.info(`Session name sanitized to: ${validName}`);
  }
  
  const retentionDays = parseInt(await question('Retention days (default 30): ')) || 30;
  const autoArchive = (await question('Enable auto-archive? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
  
  try {
    const isolatedStorage = DataStorage.createIsolated(validName, {
      retentionDays,
      autoArchive
    });
    
    await isolatedStorage.init();
    
    logger.success(`\n✅ Isolated session "${validName}" created successfully!`);
    logger.info(`Data will be stored separately in: data/isolated/${validName}/`);
    logger.info(`Retention: ${retentionDays} days`);
    logger.info(`Auto-archive: ${autoArchive ? 'Enabled' : 'Disabled'}`);
    logger.info('');
    logger.info('Usage example:');
    logger.info(`const storage = DataStorage.createIsolated('${validName}');`);
    logger.info('await storage.init();');
    
  } catch (error) {
    logger.error(`Failed to create isolated session: ${error.message}`);
  }
}

async function archiveSession() {
  const sessionId = await question('\n📦 Enter session ID to archive: ');
  
  if (!sessionId.trim()) {
    logger.warning('No session ID provided.');
    return;
  }
  
  try {
    const storage = new DataStorage();
    const success = await storage.archiveSession(sessionId);
    
    if (success) {
      logger.success(`✅ Session ${sessionId} archived successfully!`);
    } else {
      logger.error(`❌ Failed to archive session ${sessionId}`);
    }
    
  } catch (error) {
    logger.error(`Archive operation failed: ${error.message}`);
  }
}

async function autoArchiveOldSessions() {
  const retentionDays = parseInt(await question('\n📦 Archive sessions older than how many days? [30]: ')) || 30;
  
  try {
    const storage = new DataStorage({ retentionDays });
    await storage.autoArchiveOldSessions();
    
    logger.success('✅ Auto-archive completed!');
    
  } catch (error) {
    logger.error(`Auto-archive failed: ${error.message}`);
  }
}

async function switchStorageMode() {
  logger.cyan('\n⚙️ STORAGE MODE CONFIGURATION');
  logger.gray('-'.repeat(60));
  
  logger.info('Available storage modes:');
  logger.info('1. mixed - Default behavior with both global and isolated options');
  logger.info('2. isolated - Separate directory for each session');
  logger.info('3. global - All data in global directory');
  
  const modeChoice = await question('Select mode (1-3): ');
  const modes = ['mixed', 'isolated', 'global'];
  const selectedMode = modes[parseInt(modeChoice) - 1];
  
  if (!selectedMode) {
    logger.warning('Invalid selection.');
    return;
  }
  
  let sessionName = null;
  if (selectedMode === 'isolated') {
    sessionName = await question('Enter session name for isolated mode: ');
    if (!sessionName.trim()) {
      logger.warning('Session name required for isolated mode.');
      return;
    }
  }
  
  logger.info(`\n📝 Example configuration for ${selectedMode} mode:`);
  logger.info('```javascript');
  if (selectedMode === 'isolated') {
    logger.info(`const storage = DataStorage.createIsolated('${sessionName}');`);
  } else if (selectedMode === 'global') {
    logger.info('const storage = DataStorage.createGlobal();');
  } else {
    logger.info('const storage = new DataStorage(); // Default mixed mode');
  }
  logger.info('await storage.init();');
  logger.info('```');
}

async function main() {
  while (true) {
    try {
      await displayMainMenu();
      const choice = await question('\n🔧 Select option (0-13): ');
      
      switch (choice) {
        case '0':
          logger.info('Goodbye!');
          rl.close();
          return;
          
        case '1':
          await listAllSessions();
          break;
          
        case '2':
          await viewSessionDetails();
          break;
          
        case '3':
          await archiveSession();
          break;
          
        case '4':
          await createIsolatedSession();
          break;
          
        case '5':
          await purgeDataBeforeDate(true); // Dry run
          break;
          
        case '6':
          await purgeDataBeforeDate(false); // Execute
          break;
          
        case '7':
          await autoArchiveOldSessions();
          break;
          
        case '8':
          await getStorageStats();
          break;
          
        case '9':
          await exportDataForAnalytics();
          break;
          
        case '10':
          // CSV export is handled by exportDataForAnalytics based on format choice
          logger.info('Use option 9 and select CSV format.');
          break;
          
        case '11':
          logger.info('Feature coming soon: Export specific sessions');
          break;
          
        case '12':
          await switchStorageMode();
          break;
          
        case '13':
          await switchStorageMode();
          break;
          
        default:
          logger.warning('Invalid option. Please try again.');
          break;
      }
      
      // Wait for user to press enter before continuing
      if (choice !== '0') {
        await question('\nPress Enter to continue...');
      }
      
    } catch (error) {
      logger.error(`Operation failed: ${error.message}`);
      await question('\nPress Enter to continue...');
    }
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };