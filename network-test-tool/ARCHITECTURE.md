# 🏗️ Network Test Tool - Architecture Documentation

## System Overview

The Network Test Tool is a comprehensive blockchain testing framework designed for multi-network compatibility testing, performance analysis, and protocol validation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │   CLI.js    │  │  npm scripts │  │   Reports    │  │   API    ││
│  │ Interactive │  │   Commands   │  │   Server     │  │ Exports  ││
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └─────┬────┘│
│         └─────────────────┴──────────────────┴────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         TEST ORCHESTRATION LAYER                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      TestRunner (lib/test-runner.js)           │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │  • Test Queue Management    • Retry Logic                      │ │
│  │  • Network Coordination     • Result Aggregation               │ │
│  │  • Parallel Execution       • Session Management               │ │
│  └───────────┬────────────────────────────────────────────────────┘ │
│              │                                                       │
│  ┌───────────┴───────────┬────────────────┬─────────────────────┐  │
│  │                       │                │                     │  │
│  ▼                       ▼                ▼                     ▼  │
│┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
││ EVM Test    │ │ DeFi Test    │ │ Load Test    │ │ Finality     ││
││ Runner      │ │ Runner       │ │ Runner       │ │ Test Runner  ││
│└─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                          CORE SERVICES LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
││  Contract    │ │   Database   │ │  Resource    │ │    Retry     ││
││  Registry    │ │   Manager    │ │    Pool      │ │   Manager    ││
│├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤│
││• Deploy      │ │• SQLite DB   │ │• Provider    │ │• Exponential ││
││• Health Check│ │• Migrations  │ │  Pool        │ │  Backoff     ││
││• Verify      │ │• Queries     │ │• Signer Pool │ │• Max Retries ││
│└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│                                                                      │
│┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
││   Network    │ │     Gas      │ │   Progress   │ │   Analytics  ││
││   Config     │ │   Manager    │ │   Tracker    │ │    Engine    ││
│├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤│
││• RPC URLs    │ │• Dynamic     │ │• Real-time   │ │• Metrics     ││
││• Chain IDs   │ │  Pricing     │ │  Updates     │ │• Time Series ││
││• Gas Prices  │ │• Fallbacks   │ │• ETAs        │ │• Aggregation ││
│└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │  Kasplex L2  │     │   Igra L2    │     │   Ethereum   │       │
│  │  Chain ID:   │     │  Chain ID:   │     │   Sepolia    │       │
│  │   167012     │     │    19416     │     │  Chain ID:   │       │
│  │              │     │              │     │   11155111   │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. User Interface Layer

#### CLI Interface (`cli.js`)
```
┌─────────────────────────────────┐
│         CLI Interface           │
├─────────────────────────────────┤
│  • Interactive Menu System      │
│  • Command Parser              │
│  • Option Validation           │
│  • Progress Display            │
└─────────────────────────────────┘
```

**Key Features:**
- Interactive menu-driven interface
- Command-line argument parsing
- Real-time progress updates
- Error handling and user feedback

#### Report Server
```
┌─────────────────────────────────┐
│        Report Server            │
├─────────────────────────────────┤
│  • JSReport Integration         │
│  • Template Engine (Handlebars) │
│  • HTML/PDF Generation         │
│  • Real-time Dashboard         │
└─────────────────────────────────┘
```

### 2. Test Orchestration Layer

#### Test Runner Architecture
```
┌────────────────────────────────────────┐
│           Test Runner                  │
├────────────────────────────────────────┤
│  Input: Test Configuration             │
│    • Networks[]                        │
│    • TestTypes[]                       │
│    • Options{}                         │
├────────────────────────────────────────┤
│  Process:                              │
│    1. Build Test Queue                 │
│    2. Initialize Resources             │
│    3. Execute Tests (Parallel/Serial)  │
│    4. Handle Retries                   │
│    5. Aggregate Results               │
├────────────────────────────────────────┤
│  Output: Test Results                  │
│    • Success Rate                      │
│    • Gas Usage                         │
│    • Performance Metrics              │
│    • Detailed Logs                     │
└────────────────────────────────────────┘
```

#### Test Execution Flow
```
Start
  │
  ├─→ Load Configuration
  │     └─→ Networks, Tests, Options
  │
  ├─→ Initialize Services
  │     ├─→ Database Connection
  │     ├─→ Contract Registry
  │     └─→ Resource Pools
  │
  ├─→ Build Test Queue
  │     └─→ For each Network × TestType
  │
  ├─→ Execute Tests
  │     ├─→ [Parallel Mode]
  │     │     └─→ Promise.all(tests)
  │     └─→ [Serial Mode]
  │           └─→ Sequential execution
  │
  ├─→ Handle Failures
  │     ├─→ Retry Failed Tests Only
  │     └─→ Max Retries Check
  │
  ├─→ Generate Reports
  │     └─→ HTML, JSON, CSV
  │
  └─→ Cleanup & Exit
```

### 3. Core Services Layer

#### Database Schema
```sql
┌─────────────────────────────────────────┐
│           DATABASE SCHEMA               │
├─────────────────────────────────────────┤
│                                         │
│  contract_deployments                   │
│  ├── id (INTEGER PRIMARY KEY)          │
│  ├── chain_id (INTEGER)                │
│  ├── contract_type (TEXT)              │
│  ├── contract_name (TEXT)              │
│  ├── address (TEXT)                    │
│  ├── deployed_at (DATETIME)            │
│  └── is_active (BOOLEAN)               │
│                                         │
│  test_sessions                          │
│  ├── id (INTEGER PRIMARY KEY)          │
│  ├── session_id (TEXT)                 │
│  ├── started_at (DATETIME)             │
│  ├── network_names (TEXT)              │
│  └── test_types (TEXT)                 │
│                                         │
│  test_results                           │
│  ├── id (INTEGER PRIMARY KEY)          │
│  ├── session_id (INTEGER FK)           │
│  ├── chain_id (INTEGER)                │
│  ├── test_type (TEXT)                  │
│  ├── test_name (TEXT)                  │
│  ├── success (BOOLEAN)                 │
│  ├── gas_used (INTEGER)                │
│  └── error_message (TEXT)              │
│                                         │
│  contract_health_checks                 │
│  ├── id (INTEGER PRIMARY KEY)          │
│  ├── contract_id (INTEGER FK)          │
│  ├── check_time (DATETIME)             │
│  ├── is_healthy (BOOLEAN)              │
│  └── error_details (TEXT)              │
│                                         │
└─────────────────────────────────────────┘
```

#### Service Components

##### Contract Registry Service
```javascript
class ContractRegistry {
  // Deployment Management
  deployContract(chainId, contractType, signer)
  getContract(chainId, contractType)

  // Health Monitoring
  checkHealth(chainId, contractAddress)
  getHealthyContracts(chainId)

  // Database Operations
  saveDeployment(deployment)
  loadFromDatabase(chainId)
}
```

##### Resource Pool Service
```javascript
class ResourcePool {
  // Provider Management
  getProvider(network)
  releaseProvider(provider)

  // Signer Management
  getSigner(config, index)
  releaseSigner(signer)

  // Connection Pooling
  maintainConnections()
  cleanupStale()
}
```

##### Retry Manager Service
```javascript
class RetryManager {
  // Retry Logic
  executeWithRetry(fn, maxRetries, chainId)
  calculateBackoff(attempt)

  // Network-Specific Settings
  getMaxRetries(chainId, testType)
  getRetryDelay(chainId)
}
```

### 4. Test Runners

#### EVM Test Runner
```
┌─────────────────────────────────────────┐
│         EVM Test Runner                 │
├─────────────────────────────────────────┤
│  Tests:                                 │
│  • Precompiles (5 tests)               │
│    - ecrecover, sha256, ripemd160      │
│    - modexp, identity                  │
│  • Assembly Operations (8 tests)        │
│    - SLOAD, SSTORE, DELEGATECALL      │
│    - CREATE, CREATE2, SELFDESTRUCT    │
│  • CREATE2 Factory (5 tests)           │
│    - Deployment, verification          │
│    - External calls                    │
├─────────────────────────────────────────┤
│  Features:                              │
│  • Selective retry (failed tests only)  │
│  • Gas optimization                     │
│  • Comprehensive logging                │
└─────────────────────────────────────────┘
```

#### DeFi Test Runner
```
┌─────────────────────────────────────────┐
│         DeFi Test Runner                │
├─────────────────────────────────────────┤
│  Protocol Tests:                        │
│  • ERC20 Token Operations              │
│  • DEX Trading (Uniswap V2 style)      │
│  • Lending Protocol                     │
│  • Yield Farming                        │
│  • NFT Collections (ERC721)            │
│  • Multi-Signature Wallet              │
├─────────────────────────────────────────┤
│  Features:                              │
│  • Database-driven contracts            │
│  • Health checks before tests          │
│  • Complex interaction scenarios       │
└─────────────────────────────────────────┘
```

### 5. Data Flow

#### Test Execution Data Flow
```
User Input
    │
    ▼
CLI Parser ──────→ Configuration
    │                    │
    ▼                    ▼
Test Runner ←────── Database
    │                    ▲
    ├──→ EVM Tests ──────┤
    ├──→ DeFi Tests ─────┤
    ├──→ Load Tests ─────┤
    └──→ Finality ───────┘
              │
              ▼
         Test Results
              │
    ┌─────────┴─────────┐
    ▼                   ▼
Database            Reports
Storage            Generation
```

#### Contract Management Flow
```
Contract Deployment
        │
        ▼
Contract Registry
        │
        ├──→ Save to Database
        │         │
        │         ▼
        │    contract_deployments
        │         │
        │         ▼
        │    Health Checks
        │         │
        │         ▼
        │    contract_health_checks
        │
        └──→ Return Contract Instance
                  │
                  ▼
            Test Execution
```

### 6. Network Integration

#### Network Configuration
```javascript
{
  kasplex: {
    chainId: 167012,
    rpc: "https://rpc.kasplextest.xyz",
    gasPrice: "dynamic",
    fallbackGasPrice: 2001,
    blockTime: 1000,
    confirmations: 1
  },
  igra: {
    chainId: 19416,
    rpc: "https://rpc.testnet.igra.network",
    gasPrice: "fixed",
    fixedGasPrice: 2000,
    blockTime: 1000,
    confirmations: 1
  },
  sepolia: {
    chainId: 11155111,
    rpc: ["primary", "fallback"],
    gasPrice: "dynamic",
    blockTime: 12000,
    confirmations: 6
  }
}
```

### 7. Error Handling Strategy

#### Error Hierarchy
```
Error
  │
  ├─→ NetworkError
  │     ├─→ ConnectionError
  │     ├─→ TimeoutError
  │     └─→ RPCError
  │
  ├─→ ContractError
  │     ├─→ DeploymentError
  │     ├─→ ExecutionError
  │     └─→ VerificationError
  │
  └─→ TestError
        ├─→ AssertionError
        ├─→ GasError
        └─→ ValidationError
```

#### Error Recovery Flow
```
Error Detected
      │
      ├─→ Is Retryable?
      │      │
      │      ├─→ Yes ──→ Apply Backoff
      │      │              │
      │      │              ▼
      │      │          Retry Test
      │      │              │
      │      │              ├─→ Success ──→ Continue
      │      │              │
      │      │              └─→ Failed ──→ Max Retries?
      │      │                                │
      │      │                                ├─→ No ──→ Retry
      │      │                                │
      │      │                                └─→ Yes ──→ Log & Continue
      │      │
      │      └─→ No ──→ Log Error ──→ Continue/Abort
      │
      └─→ Log to Database
```

### 8. Performance Optimizations

#### Resource Pooling
```
┌─────────────────────────────────────────┐
│          Resource Pool                  │
├─────────────────────────────────────────┤
│                                         │
│  Provider Pool (per network)            │
│  ┌─────┬─────┬─────┬─────┬─────┐      │
│  │ P1  │ P2  │ P3  │ P4  │ P5  │      │
│  └─────┴─────┴─────┴─────┴─────┘      │
│     ▲                                   │
│     │ Round-robin allocation            │
│     │                                   │
│  Signer Pool (shared)                   │
│  ┌─────┬─────┬─────┬─────┬─────┐      │
│  │ S1  │ S2  │ S3  │ S4  │ S5  │      │
│  └─────┴─────┴─────┴─────┴─────┘      │
│                                         │
└─────────────────────────────────────────┘
```

#### Parallel Execution
```
Test Queue
    │
    ├─→ Network 1 Tests ──→ Worker 1
    ├─→ Network 2 Tests ──→ Worker 2
    └─→ Network 3 Tests ──→ Worker 3
              │
              ▼
         Parallel Execution
              │
              ▼
         Result Aggregation
```

### 9. Monitoring & Analytics

#### Metrics Collection
```
┌─────────────────────────────────────────┐
│         Metrics Pipeline                │
├─────────────────────────────────────────┤
│                                         │
│  Raw Data Collection                    │
│     │                                   │
│     ├─→ Transaction Metrics             │
│     ├─→ Gas Usage                       │
│     ├─→ Latency Measurements           │
│     └─→ Error Rates                    │
│                │                        │
│                ▼                        │
│  Time Series Storage                    │
│     │                                   │
│     ├─→ 1-minute aggregates            │
│     ├─→ 5-minute aggregates            │
│     └─→ Hourly summaries               │
│                │                        │
│                ▼                        │
│  Analytics Engine                       │
│     │                                   │
│     ├─→ Performance Trends              │
│     ├─→ Anomaly Detection              │
│     └─→ Predictive Analysis            │
│                │                        │
│                ▼                        │
│  Report Generation                      │
│                                         │
└─────────────────────────────────────────┘
```

### 10. Security Considerations

#### Security Layers
```
┌─────────────────────────────────────────┐
│         Security Architecture           │
├─────────────────────────────────────────┤
│                                         │
│  Input Validation                       │
│     • Parameter sanitization            │
│     • Type checking                     │
│     • Range validation                  │
│                                         │
│  Key Management                         │
│     • Environment variables only        │
│     • Never logged or displayed         │
│     • Memory cleanup after use         │
│                                         │
│  Network Security                       │
│     • HTTPS only for RPC               │
│     • Request signing                   │
│     • Rate limiting                    │
│                                         │
│  Database Security                      │
│     • SQL injection prevention          │
│     • Parameterized queries            │
│     • Access control                   │
│                                         │
└─────────────────────────────────────────┘
```

## Deployment Architecture

### Local Development
```
Developer Machine
    │
    ├─→ Node.js Runtime
    ├─→ SQLite Database
    ├─→ Local File System
    └─→ Network Connections
           │
           └─→ Testnet RPCs
```

### CI/CD Pipeline
```
GitHub Repository
    │
    ├─→ GitHub Actions
    │      │
    │      ├─→ Install Dependencies
    │      ├─→ Run Tests
    │      ├─→ Generate Reports
    │      └─→ Archive Results
    │
    └─→ Deployment
           │
           ├─→ Docker Container
           └─→ Cloud Instance
```

## Future Architecture Enhancements

### Planned Improvements

1. **Microservices Architecture**
   - Separate test runners as microservices
   - Message queue for test orchestration
   - Distributed execution across multiple nodes

2. **Cloud Integration**
   - AWS/GCP deployment options
   - Cloud database (PostgreSQL/MongoDB)
   - Serverless functions for report generation

3. **Real-time Monitoring**
   - WebSocket connections for live updates
   - Grafana/Prometheus integration
   - Alert system for failures

4. **API Gateway**
   - RESTful API for external integration
   - GraphQL endpoint for flexible queries
   - Webhook notifications

5. **Enhanced Security**
   - Hardware wallet support
   - Multi-signature test execution
   - Audit logging

---

## Conclusion

The Network Test Tool architecture is designed for:
- **Modularity**: Each component is independent and replaceable
- **Scalability**: Can handle multiple networks and thousands of tests
- **Reliability**: Comprehensive error handling and retry mechanisms
- **Performance**: Resource pooling and parallel execution
- **Maintainability**: Clear separation of concerns and well-defined interfaces

This architecture ensures the tool can evolve with changing requirements while maintaining stability and performance.