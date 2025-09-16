const { TestDatabase } = require('./database');
const ethers = require('ethers');
const chalk = require('chalk');

/**
 * Contract Registry Service
 * Manages contract deployments and health checks in the database
 */
class ContractRegistry {
  constructor(dbPath = null) {
    this.db = new TestDatabase(dbPath);
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.db.initialize();
      this.initialized = true;
    }
  }

  /**
   * Generate a unique deployment ID
   */
  generateDeploymentId(networkName, contractName) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${networkName}-${contractName}-${timestamp}-${randomId}`.toLowerCase();
  }

  /**
   * Save a contract deployment to the database
   */
  async saveDeployment(deploymentData) {
    await this.initialize();

    const deploymentId = this.generateDeploymentId(
      deploymentData.networkName,
      deploymentData.contractName
    );

    try {
      // Mark previous versions as inactive
      if (deploymentData.markPreviousInactive !== false) {
        const updateStmt = this.db.db.prepare(`
          UPDATE contract_deployments
          SET is_active = FALSE
          WHERE chain_id = ? AND contract_type = ? AND contract_name = ? AND is_active = TRUE
        `);
        updateStmt.run(deploymentData.chainId, deploymentData.contractType, deploymentData.contractName);
      }

      // Insert new deployment
      const insertStmt = this.db.db.prepare(`
        INSERT INTO contract_deployments (
          deployment_id, network_name, chain_id, contract_name, contract_type,
          contract_address, transaction_hash, block_number, gas_used, gas_price,
          deployed_at, deployer_address, constructor_args, abi, bytecode_hash,
          version, is_active, verified, health_status, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Convert BigNumbers and ensure all values are primitives
      const blockNumber = deploymentData.blockNumber?.toString ?
        deploymentData.blockNumber.toString() :
        (deploymentData.blockNumber || 0);

      const gasUsed = deploymentData.gasUsed?.toString ?
        deploymentData.gasUsed.toString() :
        (deploymentData.gasUsed || 0);

      const gasPrice = deploymentData.gasPrice?.toString ?
        deploymentData.gasPrice.toString() :
        (deploymentData.gasPrice || '0');

      const result = insertStmt.run(
        deploymentId,
        deploymentData.networkName,
        Number(deploymentData.chainId),
        deploymentData.contractName,
        deploymentData.contractType || 'unknown',
        deploymentData.contractAddress,
        deploymentData.transactionHash,
        Number(blockNumber),
        Number(gasUsed),
        String(gasPrice),
        new Date().toISOString(),
        deploymentData.deployerAddress,
        JSON.stringify(deploymentData.constructorArgs || []),
        JSON.stringify(deploymentData.abi || {}),
        deploymentData.bytecodeHash || '',
        deploymentData.version || '1.0.0',
        deploymentData.isActive !== false ? 1 : 0,
        deploymentData.verified || false ? 1 : 0,
        'healthy',
        JSON.stringify(deploymentData.metadata || {})
      );

      console.log(chalk.green(`✅ Saved deployment ${deploymentId} to database`));
      return { deploymentId, success: true };
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save deployment: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get active contract by type and name
   */
  async getActiveContract(chainId, contractType, contractName) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      SELECT * FROM contract_deployments
      WHERE chain_id = ? AND contract_type = ? AND contract_name = ? AND is_active = TRUE
      LIMIT 1
    `);

    const result = stmt.get(chainId, contractType, contractName);

    if (result) {
      // Parse JSON fields
      result.constructor_args = JSON.parse(result.constructor_args || '[]');
      result.abi = JSON.parse(result.abi || '{}');
      result.metadata = JSON.parse(result.metadata || '{}');
    }

    return result;
  }

  /**
   * Get all active contracts by network and type
   */
  async getActiveContractsByType(chainId, contractType) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      SELECT * FROM contract_deployments
      WHERE chain_id = ? AND contract_type = ? AND is_active = TRUE
      ORDER BY contract_name
    `);

    const results = stmt.all(chainId, contractType);
    const contracts = {};

    for (const row of results) {
      // Parse JSON fields
      row.constructor_args = JSON.parse(row.constructor_args || '[]');
      row.abi = JSON.parse(row.abi || '{}');
      row.metadata = JSON.parse(row.metadata || '{}');

      // Create a mapping by contract name for easy access
      contracts[row.contract_name] = row;
    }

    return contracts;
  }

  /**
   * Get all contracts for a network
   */
  async getAllContractsByNetwork(chainId) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      SELECT * FROM contract_deployments
      WHERE chain_id = ? AND is_active = TRUE
      ORDER BY contract_type, contract_name
    `);

    const results = stmt.all(chainId);

    for (const row of results) {
      row.constructor_args = JSON.parse(row.constructor_args || '[]');
      row.abi = JSON.parse(row.abi || '{}');
      row.metadata = JSON.parse(row.metadata || '{}');
    }

    return results;
  }

  /**
   * Get contract ABI
   */
  async getContractABI(deploymentId) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      SELECT abi FROM contract_deployments WHERE deployment_id = ?
    `);

    const result = stmt.get(deploymentId);
    return result ? JSON.parse(result.abi || '{}') : null;
  }

  /**
   * Check health of a single contract
   */
  async checkContractHealth(deployment, provider) {
    const startTime = Date.now();
    let status = 'healthy';
    let errorMessage = null;
    let checks = [];

    try {
      // Check 1: Contract code exists at address (with retry for network issues)
      let code;
      let retries = 3;

      for (let i = 0; i < retries; i++) {
        try {
          code = await provider.getCode(deployment.contract_address);
          break;
        } catch (error) {
          if (i === retries - 1) throw error;
          console.log(`⚠️ Retry ${i + 1}/${retries} for contract code check: ${deployment.contract_address}`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
        }
      }

      if (code === '0x' || code === '0x0') {
        throw new Error(`No contract code at address ${deployment.contract_address}`);
      }
      checks.push({ name: 'code_exists', passed: true, codeLength: code.length });

      // Check 2: Try to get current block (network connectivity)
      const blockNumber = await provider.getBlockNumber();
      checks.push({ name: 'network_accessible', passed: true, blockNumber });

      // Check 3: Estimate gas for a simple call (if ABI available)
      if (deployment.abi && Array.isArray(deployment.abi)) {
        const viewFunctions = deployment.abi.filter(
          item => item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
        );

        if (viewFunctions.length > 0) {
          const contract = new ethers.Contract(
            deployment.contract_address,
            deployment.abi,
            provider
          );

          // Try to call the first view function
          const testFunc = viewFunctions[0];
          try {
            if (testFunc.inputs.length === 0) {
              await contract[testFunc.name]();
              checks.push({ name: 'view_function_call', passed: true, function: testFunc.name });
            }
          } catch (err) {
            // View function failed, but contract might still be healthy
            checks.push({ name: 'view_function_call', passed: false, function: testFunc.name, error: err.message });
          }
        }
      }

    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
      checks.push({ name: 'health_check', passed: false, error: error.message });
    }

    const responseTime = Date.now() - startTime;

    // Save health check to database
    await this.saveHealthCheck({
      deploymentId: deployment.deployment_id,
      status,
      responseTime,
      errorMessage,
      checks
    });

    // Update contract health status
    await this.updateHealthStatus(deployment.deployment_id, status);

    return {
      healthy: status === 'healthy',
      status,
      responseTime,
      checks,
      error: errorMessage
    };
  }

  /**
   * Verify health of multiple contracts
   */
  async verifyContractsHealth(contracts, provider) {
    const results = {};
    let allHealthy = true;

    for (const [name, deployment] of Object.entries(contracts)) {
      if (typeof deployment === 'string') {
        // If just an address, create a minimal deployment object
        const healthResult = await this.checkContractHealth(
          { contract_address: deployment, deployment_id: name },
          provider
        );
        results[name] = healthResult;
      } else {
        const healthResult = await this.checkContractHealth(deployment, provider);
        results[name] = healthResult;
      }

      if (!results[name].healthy) {
        allHealthy = false;
      }
    }

    return { allHealthy, results };
  }

  /**
   * Save a health check record
   */
  async saveHealthCheck(checkData) {
    await this.initialize();

    // First check if the deployment_id exists in the contract_deployments table
    const checkStmt = this.db.db.prepare(`
      SELECT deployment_id FROM contract_deployments WHERE deployment_id = ?
    `);

    const exists = checkStmt.get(checkData.deploymentId);

    // Only save health check if the deployment exists
    if (!exists) {
      // Deployment doesn't exist - this is OK for ad-hoc health checks
      return;
    }

    const stmt = this.db.db.prepare(`
      INSERT INTO contract_health_checks (
        deployment_id, check_time, status, response_time_ms,
        gas_price_at_check, error_message, checks_performed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        checkData.deploymentId,
        new Date().toISOString(),
        checkData.status,
        checkData.responseTime || 0,
        checkData.gasPrice || '0',
        checkData.errorMessage || null,
        JSON.stringify(checkData.checks || [])
      );
    } catch (error) {
      // Health check save failure is not critical
      console.warn(`Warning: Could not save health check: ${error.message}`);
    }
  }

  /**
   * Update contract health status
   */
  async updateHealthStatus(deploymentId, status) {
    await this.initialize();

    // First check if the deployment_id exists
    const checkStmt = this.db.db.prepare(`
      SELECT deployment_id FROM contract_deployments WHERE deployment_id = ?
    `);

    const exists = checkStmt.get(deploymentId);

    // Only update if the deployment exists
    if (!exists) {
      return;
    }

    const stmt = this.db.db.prepare(`
      UPDATE contract_deployments
      SET health_status = ?, last_health_check = ?
      WHERE deployment_id = ?
    `);

    stmt.run(status, new Date().toISOString(), deploymentId);
  }

  /**
   * Mark a deployment as inactive
   */
  async markAsInactive(deploymentId) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      UPDATE contract_deployments
      SET is_active = FALSE
      WHERE deployment_id = ?
    `);

    stmt.run(deploymentId);
  }

  /**
   * Get recent health checks for a deployment
   */
  async getHealthHistory(deploymentId, limit = 10) {
    await this.initialize();

    const stmt = this.db.db.prepare(`
      SELECT * FROM contract_health_checks
      WHERE deployment_id = ?
      ORDER BY check_time DESC
      LIMIT ?
    `);

    const results = stmt.all(deploymentId, limit);

    for (const row of results) {
      row.checks_performed = JSON.parse(row.checks_performed || '[]');
    }

    return results;
  }

  /**
   * Clean up old health check records
   */
  async cleanupOldHealthChecks(daysToKeep = 7) {
    await this.initialize();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.db.prepare(`
      DELETE FROM contract_health_checks
      WHERE check_time < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  /**
   * Get contract deployment statistics
   */
  async getDeploymentStats(chainId = null) {
    await this.initialize();

    let query = `
      SELECT
        COUNT(*) as total_deployments,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_deployments,
        COUNT(CASE WHEN health_status = 'healthy' THEN 1 END) as healthy_deployments,
        COUNT(DISTINCT contract_type) as contract_types,
        SUM(gas_used) as total_gas_used
      FROM contract_deployments
    `;

    const params = [];
    if (chainId) {
      query += ' WHERE chain_id = ?';
      params.push(chainId);
    }

    const stmt = this.db.db.prepare(query);
    return stmt.get(...params);
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

module.exports = { ContractRegistry };