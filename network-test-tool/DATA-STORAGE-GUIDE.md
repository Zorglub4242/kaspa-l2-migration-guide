# 📊 Data Storage & Analytics Guide

Complete guide for the enhanced data storage system that captures all test operations, metrics, and results in structured JSON format for external analytics.

## 🎯 Overview

The data storage system provides comprehensive data capture with multiple storage modes, session isolation, and advanced data management capabilities:

- **Detailed Recording**: All operations, transactions, deployments, and errors
- **Multiple Storage Modes**: Isolated, global, or mixed storage options  
- **Session Variations**: Keep sessions separate or aggregate for analysis
- **Data Management**: Purging, archiving, and cleanup utilities
- **Analytics Export**: JSON/CSV export for external analysis tools

## 🏗️ Architecture

### Storage Modes

#### 1. Mixed Mode (Default)
```
data/
├── mixed/           # Current session data
├── global/          # Aggregated data across all sessions
└── isolated/        # Individual session directories
    ├── session-a/
    └── session-b/
```

#### 2. Isolated Mode
```
data/isolated/my-test-session/
├── sessions/        # Session metadata
├── contracts/       # Contract deployments
├── metrics/         # Performance metrics
└── analytics/       # Processed analytics
```

#### 3. Global Mode
```
data/global/
├── sessions/        # All session data
├── contracts/       # All contract deployments  
├── metrics/         # All metrics
└── analytics/       # All analytics
```

## 📁 Data Structure

Each test session generates multiple JSON files with detailed information:

### Session Data (`session-{id}.json`)
```json
{
  "sessionId": "session-2025-01-06T10-30-00-000Z-abc123",
  "testType": "defi-dex-trading",
  "startTime": "2025-01-06T10:30:00.000Z",
  "endTime": "2025-01-06T10:35:00.000Z",
  "duration": 300000,
  "networks": [
    {
      "name": "kasplex",
      "chainId": 570861,
      "currency": "KAS"
    }
  ],
  "operations": [...],
  "transactions": [...],
  "deployments": [...],
  "errors": [],
  "metrics": {...}
}
```

### Transaction Data
```json
{
  "transactionId": "op-abc123",
  "timestamp": "2025-01-06T10:30:15.000Z",
  "network": "kasplex",
  "operationType": "dex_swap",
  "transactionHash": "0x123...",
  "gasUsed": 79834,
  "gasPrice": 1.5,
  "executionTime": 1245,
  "status": 1,
  "events": [...]
}
```

### Analytics Data (`analytics-{id}.json`)
```json
{
  "sessionInfo": {...},
  "networkComparison": {
    "kasplex": {
      "transactionCount": 25,
      "averageGasPrice": 1.2,
      "successRate": 100,
      "throughputTPS": 2.89
    }
  },
  "timeSeriesData": {...},
  "costAnalysis": {...}
}
```

## 🚀 Usage Examples

### Basic Usage (Mixed Mode)
```javascript
const { dataStorage } = require('./utils/data-storage');

// Initialize session
await dataStorage.init();
dataStorage.setTestConfiguration('defi-dex', { 
  networks: ['kasplex', 'sepolia'],
  operationCount: 10 
});

// Record deployment
await dataStorage.recordDeployment('kasplex', 'MockERC20', {
  address: '0x123...',
  transactionHash: '0x456...',
  gasUsed: 1200000
});

// Record transaction
await dataStorage.recordTransaction('kasplex', 'token_transfer', {
  hash: '0x789...',
  gasUsed: 21000,
  gasPrice: ethers.utils.parseUnits('1.5', 'gwei'),
  executionTime: 2500
});

// Finalize and save
await dataStorage.finalizeSession({
  customMetric: 'value'
});
```

### Isolated Session
```javascript
const { DataStorage } = require('./utils/data-storage');

// Create isolated storage for specific test
const isolatedStorage = DataStorage.createIsolated('performance-test-v2', {
  retentionDays: 90,
  autoArchive: true
});

await isolatedStorage.init();
// ... run tests ...
await isolatedStorage.finalizeSession();
```

### Global Storage
```javascript
const globalStorage = DataStorage.createGlobal({
  retentionDays: 365
});

await globalStorage.init();
// All sessions saved to global directory
```

## 🛠️ Data Management

### Interactive Data Management
```bash
npm run data:manage
```

This launches an interactive menu with options for:

#### 📋 Session Management
- **List Sessions**: View all recorded sessions
- **Session Details**: Detailed view of specific session  
- **Archive Session**: Move session to archive
- **Create Isolated**: Set up isolated session storage

#### 🧹 Data Cleanup
- **Purge by Date**: Remove data older than specified date
- **Dry Run Purge**: Preview what would be deleted
- **Auto-Archive**: Archive old sessions automatically
- **Storage Stats**: View storage usage and statistics

#### 📈 Analytics Export
- **JSON Export**: Export data for analytics tools
- **CSV Export**: Simplified CSV format for spreadsheets
- **Filtered Export**: Export specific sessions/networks/date ranges

### Programmatic Data Management

#### Purge Old Data
```javascript
const storage = new DataStorage();

// Dry run - see what would be deleted
const results = await storage.purgeDataBefore(
  new Date('2024-12-01'), 
  { dryRun: true }
);

// Actually delete data older than Dec 1, 2024
const results = await storage.purgeDataBefore(
  new Date('2024-12-01'),
  { 
    dryRun: false,
    preserveArchive: true,
    purgeContracts: true,
    purgeMetrics: true 
  }
);
```

#### Export for External Analytics
```javascript
// Export all data as JSON
const exportPath = await storage.exportForAnalytics('json', {
  includeRawData: true,
  includeAggregated: true
});

// Export specific networks and date range as CSV
const csvPath = await storage.exportForAnalytics('csv', {
  networks: ['kasplex', 'sepolia'],
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
});
```

## 📊 Analytics Integration

### Data Fields Available

The exported data includes comprehensive metrics for analytics:

#### Performance Metrics
- Execution times per operation
- Throughput (transactions per second)
- Success rates by network and operation type
- Gas usage patterns and optimization

#### Cost Analysis  
- Gas costs in native currency and USD
- Cost per operation type
- Network cost comparison
- Historical cost trends

#### Network Comparison
- Cross-network performance differences
- Reliability metrics
- Feature-specific comparisons (slippage, MEV resistance)

### Example Analytics Queries

#### Average Transaction Cost by Network
```sql
SELECT 
  network,
  AVG(gasUsed * gasPrice * 1e-9) as avg_cost_eth,
  COUNT(*) as transaction_count
FROM transactions 
GROUP BY network
ORDER BY avg_cost_eth;
```

#### Success Rate Trends Over Time
```sql
SELECT 
  DATE(timestamp) as date,
  network,
  AVG(CASE WHEN status = 1 THEN 1.0 ELSE 0.0 END) as success_rate
FROM transactions 
GROUP BY date, network
ORDER BY date;
```

#### Gas Efficiency by Operation Type
```sql
SELECT 
  operationType,
  network,
  AVG(gasUsed) as avg_gas,
  MIN(gasUsed) as min_gas,
  MAX(gasUsed) as max_gas
FROM transactions
GROUP BY operationType, network;
```

## 🔧 Configuration Options

### Storage Configuration
```javascript
const storage = new DataStorage({
  storageMode: 'mixed',        // 'isolated', 'global', 'mixed'
  sessionName: 'my-test',      // For isolated mode
  autoArchive: true,           // Auto-archive old sessions
  retentionDays: 30           // Days to keep before archiving
});
```

### Export Configuration
```javascript
const options = {
  sessionIds: ['session-1', 'session-2'],  // Specific sessions
  networks: ['kasplex', 'sepolia'],        // Network filter
  dateRange: { start: date1, end: date2 }, // Date range
  includeRawData: true,                    // Include transaction details
  includeAggregated: true                  // Include computed metrics
};
```

## 📋 File Organization

### Session Files
- `{sessionId}.json` - Complete session data
- `metrics-{sessionId}.json` - Metrics summary  
- `analytics-{sessionId}.json` - Processed analytics
- `export-{timestamp}.json` - Analytics export

### Contract Deployments
- `deployment-{deploymentId}.json` - Individual deployment records

### Archives
- `archive/{date}/` - Archived session data by date
- Automatic archiving based on retention policy

## 🔍 Data Validation

All stored data includes validation and metadata:

```json
{
  "dataVersion": "1.0",
  "timestamp": "2025-01-06T10:30:00.000Z",
  "integrity": {
    "checksum": "sha256:abc123...",
    "recordCount": 150,
    "completeness": "100%"
  }
}
```

## 🚨 Best Practices

### Session Management
1. **Use Isolated Sessions** for important tests that need to remain separate
2. **Set Appropriate Retention** - longer for important benchmarks
3. **Regular Cleanup** - archive or purge old data to manage disk space
4. **Consistent Naming** - use descriptive session names for isolated mode

### Data Export
1. **Filter Appropriately** - export only needed data for faster processing
2. **Regular Exports** - create periodic exports for backup/analysis
3. **Validate Exports** - check export completeness before analysis
4. **Format Selection** - JSON for detailed analysis, CSV for spreadsheets

### Performance
1. **Batch Operations** - record multiple transactions efficiently
2. **Async Operations** - use await properly for data persistence
3. **Error Handling** - storage failures shouldn't crash tests
4. **Monitor Disk Space** - storage can grow large with detailed logging

## 📈 External Analytics Tools

The exported data works well with popular analytics platforms:

### Business Intelligence
- **Tableau**: Import JSON/CSV for network performance dashboards
- **Power BI**: Connect to exported data for cost analysis reports
- **Grafana**: Time-series visualization of performance metrics

### Data Science
- **Jupyter Notebooks**: Python analysis of exported JSON data
- **R Studio**: Statistical analysis of network performance
- **Apache Spark**: Large-scale data processing and analytics

### Databases
- **PostgreSQL**: Import for complex SQL analytics
- **MongoDB**: Store JSON data for flexible querying
- **ClickHouse**: High-performance analytics database

This comprehensive data storage system ensures you have all the detailed information needed for deep analysis of blockchain network performance and DeFi operations.