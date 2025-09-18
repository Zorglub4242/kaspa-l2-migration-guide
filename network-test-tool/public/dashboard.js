// Dashboard JavaScript
let allRuns = [];
let networks = [];

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadNetworks();
    await loadRuns();
    setupAutoRefresh();
});

// Load available networks
async function loadNetworks() {
    try {
        const response = await fetch('/api/networks');
        const data = await response.json();

        if (data.success) {
            networks = data.networks;
            populateNetworkSelect(networks);
        }
    } catch (error) {
        console.error('Failed to load networks:', error);
    }
}

// Populate network select dropdown
function populateNetworkSelect(networks) {
    const select = document.getElementById('networkSelect');
    select.innerHTML = '';

    networks.forEach(network => {
        const option = document.createElement('option');
        option.value = network.name;
        option.textContent = `${network.name} (${network.symbol})`;
        select.appendChild(option);
    });
}

// Load test runs
async function loadRuns(filters = {}) {
    try {
        showLoading(true);

        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.networks) params.append('networks', filters.networks);
        if (filters.runId) params.append('runId', filters.runId);

        const response = await fetch(`/api/runs?${params}`);
        const data = await response.json();

        if (data.success) {
            allRuns = data.runs;
            displayRuns(allRuns);
            updateStats(allRuns);
        } else {
            showError('Failed to load test runs');
        }
    } catch (error) {
        console.error('Failed to load runs:', error);
        showError('Error loading test runs');
    } finally {
        showLoading(false);
    }
}

// Display runs in table
function displayRuns(runs) {
    const tbody = document.getElementById('runsTableBody');
    const table = document.getElementById('runsTable');
    const noData = document.getElementById('noDataIndicator');

    if (runs.length === 0) {
        table.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    noData.style.display = 'none';
    tbody.innerHTML = '';

    runs.forEach(run => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${run.runId}</td>
            <td>${run.network}</td>
            <td>${run.chainId || 'N/A'}</td>
            <td>${run.testCount}</td>
            <td class="${run.successRate >= 80 ? 'success' : 'error'}">${run.successRate}%</td>
            <td>${formatNumber(run.totalGasUsed)}</td>
            <td>${formatGasPrice(run.avgGasPrice)}</td>
            <td>${formatCost(run.testnetCost, getNetworkSymbol(run.network))}</td>
            <td>$${run.mainnetEstimate ? run.mainnetEstimate.toFixed(2) : 'N/A'}</td>
            <td>${formatDate(run.timestamp)}</td>
            <td><button class="btn btn-sm btn-info" onclick="compareNetworks(${run.runId})">Compare</button></td>
        `;
        tbody.appendChild(row);
    });
}

// Update statistics cards
function updateStats(runs) {
    if (runs.length === 0) {
        document.getElementById('statsContainer').style.display = 'none';
        return;
    }

    document.getElementById('statsContainer').style.display = 'flex';

    const totalRuns = runs.length;
    const totalGas = runs.reduce((sum, run) => sum + run.totalGasUsed, 0);
    const totalCost = runs.reduce((sum, run) => sum + (run.mainnetEstimate || 0), 0);
    const avgSuccess = runs.reduce((sum, run) => sum + parseFloat(run.successRate), 0) / runs.length;

    document.getElementById('totalRuns').textContent = totalRuns;
    document.getElementById('totalGas').textContent = formatNumber(totalGas);
    document.getElementById('totalCost').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('avgSuccess').textContent = `${avgSuccess.toFixed(1)}%`;
}

// Apply filters
function applyFilters() {
    const filters = {
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        networks: getSelectedNetworks(),
        runId: document.getElementById('runIdSearch').value
    };

    loadRuns(filters);
}

// Get selected networks
function getSelectedNetworks() {
    const select = document.getElementById('networkSelect');
    const selected = Array.from(select.selectedOptions).map(opt => opt.value);
    return selected.length > 0 ? selected.join(',') : '';
}

// Reset filters
function resetFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('networkSelect').selectedIndex = -1;
    document.getElementById('runIdSearch').value = '';
    loadRuns();
}

// Refresh data
function refreshData() {
    const filters = {
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        networks: getSelectedNetworks(),
        runId: document.getElementById('runIdSearch').value
    };
    loadRuns(filters);
}

// Compare networks
function compareNetworks(specificRunId = null) {
    const params = new URLSearchParams();

    if (specificRunId) {
        // Compare a specific run across networks
        params.append('runId', specificRunId);
    } else {
        // General comparison with selected networks
        const selectedNetworks = getSelectedNetworks();
        if (selectedNetworks) {
            params.append('networks', selectedNetworks);
        }
    }

    // Open comparison in new tab
    window.open(`/comparison?${params}`, '_blank');
}

// Export data
async function exportData(format) {
    try {
        const params = new URLSearchParams();
        const filters = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            networks: getSelectedNetworks(),
            runId: document.getElementById('runIdSearch').value
        };

        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.networks) params.append('networks', filters.networks);
        if (filters.runId) params.append('runId', filters.runId);

        const url = format === 'csv'
            ? `/api/export/csv?${params}`
            : `/api/export/pdf?${params}`;

        window.open(url, '_blank');
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export data');
    }
}

// Setup auto-refresh
function setupAutoRefresh() {
    // Auto-refresh every 30 seconds
    setInterval(() => {
        refreshData();
    }, 30000);
}

// Helper functions
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const tbody = document.getElementById('runsTableBody');
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #dc3545;">${message}</td></tr>`;
    document.getElementById('runsTable').style.display = 'table';
}

function formatNumber(num) {
    return num ? num.toLocaleString() : '0';
}

function formatGasPrice(price) {
    if (!price) return 'N/A';
    if (price < 1000) return `${price.toFixed(2)} Gwei`;
    if (price < 1000000) return `${(price / 1000).toFixed(2)}K Gwei`;
    return `${(price / 1000000).toFixed(2)}M Gwei`;
}

function formatCost(cost, symbol = 'ETH') {
    if (!cost || cost === 0) return 'N/A';
    if (cost < 0.000001) return `< 0.000001 ${symbol}`;
    if (cost < 1) return `${cost.toFixed(6)} ${symbol}`;
    return `${cost.toFixed(4)} ${symbol}`;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function getNetworkSymbol(networkName) {
    const network = networks.find(n =>
        n.name === networkName ||
        n.id === networkName.toLowerCase()
    );
    return network ? network.symbol : 'ETH';
}