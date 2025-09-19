// Transaction details page JavaScript
let runId = null;
let transactionData = null;
let contractData = null;
let currentTab = 'transactions';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Get run ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    runId = urlParams.get('runId');

    if (!runId) {
        showError('No run ID specified');
        return;
    }

    // Load data for both tabs
    await loadTransactions();
    await loadContracts();
});

// Load transactions for the run
async function loadTransactions() {
    try {
        const response = await fetch(`/api/run/${runId}/transactions`);
        const data = await response.json();

        if (!data.success) {
            showTransactionsError('Failed to load transactions');
            return;
        }

        transactionData = data;
        displayTransactions(data);
        updateRunInfo(data);
        updateStats();

    } catch (error) {
        console.error('Error loading transactions:', error);
        showTransactionsError('Error loading transaction data');
    }
}

// Load contracts for the run
async function loadContracts() {
    try {
        const response = await fetch(`/api/run/${runId}/contracts`);
        const data = await response.json();

        if (!data.success) {
            showContractsError('Failed to load contracts');
            return;
        }

        contractData = data;
        displayContracts(data);
        updateStats();

    } catch (error) {
        console.error('Error loading contracts:', error);
        showContractsError('Error loading contract data');
    }
}

// Display transactions in table
function displayTransactions(data) {
    const tbody = document.getElementById('transactionsTableBody');
    const loading = document.getElementById('transactionsLoading');
    const container = document.getElementById('transactionsContainer');

    loading.style.display = 'none';

    if (!data.transactions || data.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">No transactions found for this run</td></tr>';
        container.style.display = 'block';
        return;
    }

    tbody.innerHTML = '';
    container.style.display = 'block';

    data.transactions.forEach(tx => {
        const row = document.createElement('tr');
        const statusClass = tx.status === 'success' ? 'status-success' : 'status-failure';

        row.innerHTML = `
            <td>
                <div><strong>${tx.test_name || 'N/A'}</strong></div>
                <div style="font-size: 0.85em; color: #666;">${tx.operation_description || tx.test_type || ''}</div>
                ${tx.yamlScript ?
                    `<div style="font-size: 0.8em; margin-top: 4px;">
                        <span style="color: #667eea; cursor: pointer;" onclick="viewYamlScript('${tx.yamlScript}', ${tx.yamlInstructionLine || 'null'})">
                            📄 ${tx.yamlScript}${tx.yamlInstructionLine ? ` (line ${tx.yamlInstructionLine})` : ''}
                        </span>
                    </div>` : ''}
            </td>
            <td><span class="${statusClass}">${tx.status || 'N/A'}</span></td>
            <td>
                ${tx.transaction_hash ?
                    `<a href="${tx.explorerLink || '#'}" target="_blank" class="hash-link">${shortenHash(tx.transaction_hash)}</a>` :
                    'N/A'}
            </td>
            <td>${tx.block_number || 'N/A'}</td>
            <td>${formatNumber(tx.gasUsed)}</td>
            <td>${tx.gasPrice} Gwei</td>
            <td><span class="cost-badge">${tx.totalCost || '0.000000'}</span></td>
            <td><span class="cost-badge" style="background: #17a2b8;">$${tx.totalCostUSD || '0.0000'}</span></td>
            <td><span class="time-badge">${tx.executionTimeMs}ms</span></td>
            <td>
                ${tx.explorerLink ?
                    `<a href="${tx.explorerLink}" target="_blank" class="explorer-link">
                        View in Explorer →
                    </a>` :
                    '-'}
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Display contracts in table
function displayContracts(data) {
    const tbody = document.getElementById('contractsTableBody');
    const loading = document.getElementById('contractsLoading');
    const container = document.getElementById('contractsContainer');

    loading.style.display = 'none';

    if (!data.contracts || data.contracts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No contracts deployed in this run</td></tr>';
        container.style.display = 'block';
        return;
    }

    tbody.innerHTML = '';
    container.style.display = 'block';

    data.contracts.forEach(contract => {
        const row = document.createElement('tr');
        const statusClass = contract.status === 'deployed' ? 'status-success' : 'status-failure';

        row.innerHTML = `
            <td>${contract.contract_name || 'N/A'}</td>
            <td><span class="${statusClass}">${contract.status || 'N/A'}</span></td>
            <td>
                ${contract.contract_address ?
                    `<a href="${contract.addressLink || '#'}" target="_blank" class="hash-link">${shortenHash(contract.contract_address)}</a>` :
                    'N/A'}
            </td>
            <td>
                ${contract.deployment_tx ?
                    `<a href="${contract.txLink || '#'}" target="_blank" class="hash-link">${shortenHash(contract.deployment_tx)}</a>` :
                    'N/A'}
            </td>
            <td>${formatNumber(contract.gasUsed)}</td>
            <td><span class="cost-badge">${contract.deploymentCost}</span></td>
            <td>${formatDate(contract.deployed_at)}</td>
            <td>
                ${contract.addressLink ?
                    `<a href="${contract.addressLink}" target="_blank" class="explorer-link">
                        View Contract →
                    </a>` :
                    '-'}
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Update run information in header
function updateRunInfo(data) {
    const runInfo = document.getElementById('runInfo');
    runInfo.innerHTML = `
        <strong>Run ID:</strong> ${runId} |
        <strong>Network:</strong> ${data.network || 'Unknown'} |
        <strong>Chain ID:</strong> ${data.chainId || 'Unknown'}
        ${data.explorerUrl ? ` | <a href="${data.explorerUrl}" target="_blank" class="explorer-link">Network Explorer →</a>` : ''}
    `;
}

// Update statistics cards
function updateStats() {
    if (transactionData) {
        document.getElementById('totalTx').textContent = transactionData.summary?.total || '0';
        document.getElementById('successRate').textContent =
            transactionData.summary?.total > 0 ?
            `${((transactionData.summary.successful / transactionData.summary.total) * 100).toFixed(1)}%` :
            '0%';
        document.getElementById('totalGas').textContent =
            formatNumber(transactionData.summary?.totalGasUsed || 0);
        document.getElementById('avgTime').textContent =
            `${(transactionData.summary?.avgExecutionTime || 0).toFixed(0)}ms`;
    }

    if (contractData) {
        document.getElementById('totalContracts').textContent = contractData.summary?.total || '0';
        document.getElementById('deploymentCost').textContent =
            `${contractData.summary?.totalDeploymentCost || '0'}`;
    }
}

// Switch between tabs
function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');
}

// Show error messages
function showError(message) {
    const runInfo = document.getElementById('runInfo');
    runInfo.innerHTML = `<span style="color: #dc3545;">${message}</span>`;
}

function showTransactionsError(message) {
    document.getElementById('transactionsLoading').style.display = 'none';
    const errorDiv = document.getElementById('transactionsError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function showContractsError(message) {
    document.getElementById('contractsLoading').style.display = 'none';
    const errorDiv = document.getElementById('contractsError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Helper functions
function shortenHash(hash) {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
}

function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString();
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// View YAML script in viewer page
function viewYamlScript(scriptFile, lineNumber) {
    if (!scriptFile) return;

    // Build URL with query parameters
    let url = `/yaml-viewer?script=${encodeURIComponent(scriptFile)}`;

    if (lineNumber) {
        url += `&line=${lineNumber}`;
    }

    // Open in new tab
    window.open(url, '_blank');
}

// Export functionality (if needed)
function exportTransactions(format) {
    if (!transactionData) return;

    if (format === 'csv') {
        exportTransactionsCSV();
    } else if (format === 'json') {
        exportTransactionsJSON();
    }
}

function exportTransactionsCSV() {
    const headers = ['Test Type', 'Test Name', 'Description', 'Status', 'Transaction Hash', 'Block', 'Gas Used', 'Gas Price', 'Cost (Native)', 'Cost (USD)', 'Execution Time'];
    const rows = transactionData.transactions.map(tx => [
        tx.test_type || '',
        tx.test_name || '',
        tx.operation_description || '',
        tx.status || '',
        tx.transaction_hash || '',
        tx.block_number || '',
        tx.gasUsed || 0,
        tx.gasPrice || 0,
        tx.totalCost || '0',
        `$${tx.totalCostUSD || '0.0000'}`,
        tx.executionTimeMs || 0
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    downloadFile(csvContent, `transactions-${runId}.csv`, 'text/csv');
}

function exportTransactionsJSON() {
    const jsonContent = JSON.stringify(transactionData, null, 2);
    downloadFile(jsonContent, `transactions-${runId}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}