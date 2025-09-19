// Comparison page JavaScript
let comparisonData = [];
let currentSort = { column: 'usdCost', direction: 'asc' };
let selectedNetworks = [];
let runId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Get params from URL
    const urlParams = new URLSearchParams(window.location.search);

    // Check if this is a run-specific comparison
    runId = urlParams.get('runId');
    if (runId) {
        // Update title to show run-specific comparison
        document.querySelector('.subtitle').textContent = `Comparing costs for Run ID ${runId} across all networks`;

        // Hide gas amount control for run-specific comparison
        document.querySelector('.controls').style.display = 'none';
    } else {
        // Get selected networks from URL params
        const networksParam = urlParams.get('networks');
        if (networksParam) {
            selectedNetworks = networksParam.split(',').map(n => n.trim());
        }
    }

    // Load comparison data
    await loadComparison();

    // Setup sorting
    setupSorting();
});

// Load comparison data
async function loadComparison(gasAmount = null) {
    try {
        showLoading(true);

        let url;
        if (runId) {
            // Load run-specific comparison
            url = `/api/comparison/run/${runId}`;
        } else {
            // Load general comparison
            const gas = gasAmount || document.getElementById('gasAmount')?.value || 1000000;
            url = `/api/comparison?gasAmount=${gas}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            comparisonData = data.comparisons;
            displayComparison(comparisonData);
        } else {
            showError('Failed to load comparison data');
        }
    } catch (error) {
        console.error('Failed to load comparison:', error);
        showError('Error loading comparison data');
    } finally {
        showLoading(false);
    }
}

// Display comparison data
function displayComparison(data) {
    const tbody = document.getElementById('comparisonTableBody');
    const table = document.getElementById('comparisonTable');

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No data available</td></tr>';
        table.style.display = 'table';
        return;
    }

    // Sort data
    const sortedData = sortData(data, currentSort.column, currentSort.direction);

    // Find cheapest and most expensive
    const costs = sortedData.map(d => parseFloat(d.usdCost));
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    tbody.innerHTML = '';
    table.style.display = 'table';

    sortedData.forEach((item, index) => {
        const row = document.createElement('tr');
        const cost = parseFloat(item.usdCost);

        // Apply highlighting
        if (cost === minCost) {
            row.classList.add('cheapest');
        } else if (cost === maxCost) {
            row.classList.add('expensive');
        }

        // Highlight selected networks or actual run network
        if (item.isActualNetwork) {
            row.classList.add('current-network');
        } else if (selectedNetworks.includes(item.network) || selectedNetworks.includes(item.networkId)) {
            row.classList.add('current-network');
        }

        row.innerHTML = `
            <td><strong>${item.network}</strong></td>
            <td>${item.type || 'testnet'}</td>
            <td>${item.token}</td>
            <td>$${formatPrice(item.tokenPrice)}</td>
            <td>${formatGasPrice(item.gasPrice)}</td>
            <td><strong>$${item.usdCost}</strong></td>
            <td>${formatGasPrice(item.mainnetGasPrice)}</td>
            <td><strong>$${item.mainnetUsdCost || item.usdCost}</strong></td>
        `;

        tbody.appendChild(row);
    });
}

// Setup sorting functionality
function setupSorting() {
    const headers = document.querySelectorAll('th.sortable');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;

            // Update sort direction
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            // Update header classes
            headers.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');

            // Re-display sorted data
            displayComparison(comparisonData);
        });
    });
}

// Sort data
function sortData(data, column, direction) {
    const sorted = [...data].sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // Handle numeric values
        if (['tokenPrice', 'gasPrice', 'mainnetGasPrice', 'tokenCost', 'usdCost', 'mainnetUsdCost'].includes(column)) {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        }

        // Handle string values
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return sorted;
}

// Update comparison with new gas amount
function updateComparison() {
    const gasAmount = document.getElementById('gasAmount').value;
    loadComparison(gasAmount);
}

// Export comparison data
async function exportComparison(format) {
    try {
        const gasAmount = document.getElementById('gasAmount').value || 1000000;

        if (format === 'csv') {
            exportToCSV(comparisonData, gasAmount);
        } else if (format === 'pdf') {
            exportToPDF(comparisonData, gasAmount);
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export comparison data');
    }
}

// Export to CSV
function exportToCSV(data, gasAmount) {
    const headers = ['Network', 'Type', 'Token', 'Price/Token', 'Testnet Gas', 'Testnet USD', 'Mainnet Gas', 'Mainnet USD'];
    const rows = data.map(item => [
        item.network,
        item.type || 'testnet',
        item.token,
        item.tokenPrice,
        item.gasPrice,
        item.usdCost,
        item.mainnetGasPrice || item.gasPrice,
        item.mainnetUsdCost || item.usdCost
    ]);

    const csvContent = [
        `Network Cost Comparison - Gas Amount: ${gasAmount}`,
        '',
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    downloadFile(csvContent, `network-comparison-${Date.now()}.csv`, 'text/csv');
}

// Export to PDF (HTML format)
function exportToPDF(data, gasAmount) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Network Cost Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .info { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .cheapest { background-color: #d4edda; }
        .expensive { background-color: #f8d7da; }
    </style>
</head>
<body>
    <h1>Network Cost Comparison Report</h1>
    <div class="info">
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Gas Amount:</strong> ${gasAmount.toLocaleString()}</p>
        <p><strong>Networks Compared:</strong> ${data.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>Network</th>
                <th>Type</th>
                <th>Token</th>
                <th>Price/Token</th>
                <th>Testnet Gas</th>
                <th>Testnet USD</th>
                <th>Mainnet Gas</th>
                <th>Mainnet USD</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(item => {
                const cost = parseFloat(item.usdCost);
                const minCost = Math.min(...data.map(d => parseFloat(d.usdCost)));
                const maxCost = Math.max(...data.map(d => parseFloat(d.usdCost)));
                const className = cost === minCost ? 'cheapest' : cost === maxCost ? 'expensive' : '';

                return `
                <tr class="${className}">
                    <td>${item.network}</td>
                    <td>${item.type || 'testnet'}</td>
                    <td>${item.token}</td>
                    <td>$${item.tokenPrice}</td>
                    <td>${item.gasPrice} Gwei</td>
                    <td><strong>$${item.usdCost}</strong></td>
                    <td>${item.mainnetGasPrice || item.gasPrice} Gwei</td>
                    <td><strong>$${item.mainnetUsdCost || item.usdCost}</strong></td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>
</body>
</html>`;

    downloadFile(htmlContent, `network-comparison-${Date.now()}.html`, 'text/html');
}

// Download file helper
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

// Helper functions
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const tbody = document.getElementById('comparisonTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc3545;">${message}</td></tr>`;
    document.getElementById('comparisonTable').style.display = 'table';
}

function formatPrice(price) {
    if (!price || price === 0) return '0.00';
    if (price < 0.01) return price.toFixed(4);
    if (price < 1) return price.toFixed(3);
    return price.toFixed(2);
}

function formatGasPrice(price) {
    if (!price) return 'N/A';
    if (price < 1) return `${price.toFixed(4)}`;
    if (price < 1000) return `${price.toFixed(2)}`;
    if (price < 1000000) return `${(price / 1000).toFixed(2)}K`;
    return `${(price / 1000000).toFixed(2)}M`;
}