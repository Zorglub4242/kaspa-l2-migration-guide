#!/usr/bin/env node

/**
 * Metabase Dashboard Auto-Setup Script
 * Automatically creates saved questions and dashboards from SQL templates
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const METABASE_URL = 'http://localhost:3000';
const TEMPLATES_DIR = path.join(__dirname, '..', 'docs', 'metabase', 'templates');

class MetabaseDashboardSetup {
    constructor() {
        this.sessionToken = null;
        this.databaseId = null;
        this.dashboardId = null;
        this.spinner = ora();
    }

    async setup() {
        try {
            console.log(chalk.cyan.bold('\n🚀 Metabase Dashboard Auto-Setup\n'));

            // Check if Metabase is running
            await this.checkMetabaseHealth();

            // Get session token (you'll need to provide credentials)
            await this.authenticate();

            // Find the database
            await this.findDatabase();

            // Create dashboard
            await this.createDashboard();

            // Load and create questions from templates
            await this.loadTemplateQueries();

            console.log(chalk.green.bold('\n✅ Dashboard setup complete!'));
            console.log(chalk.yellow(`\n📊 View your dashboard at: ${METABASE_URL}/dashboard/${this.dashboardId}\n`));

        } catch (error) {
            this.spinner.fail(chalk.red(`Setup failed: ${error.message}`));
            process.exit(1);
        }
    }

    async checkMetabaseHealth() {
        this.spinner.start('Checking Metabase connection...');
        try {
            const response = await axios.get(`${METABASE_URL}/api/health`);
            if (response.data.status === 'ok') {
                this.spinner.succeed('Metabase is running');
            }
        } catch (error) {
            throw new Error('Metabase is not running. Start it with: npm run analytics');
        }
    }

    async authenticate() {
        this.spinner.start('Authenticating with Metabase...');

        // Check if setup is needed first
        try {
            const hasSetup = await axios.get(`${METABASE_URL}/api/session/properties`);
            if (!hasSetup.data['setup-token']) {
                // Already setup, need login
                console.log(chalk.yellow('\nMetabase requires login credentials.'));
                console.log(chalk.cyan('Please provide your Metabase admin credentials:\n'));

                // For automated setup, you could read from env vars
                const email = process.env.METABASE_EMAIL || 'admin@blockchain.local';
                const password = process.env.METABASE_PASSWORD || 'blockchain123';

                console.log(chalk.gray(`Using email: ${email}`));
                console.log(chalk.gray('Set METABASE_EMAIL and METABASE_PASSWORD env vars to customize\n'));

                try {
                    const loginResponse = await axios.post(`${METABASE_URL}/api/session`, {
                        username: email,
                        password: password
                    });

                    this.sessionToken = loginResponse.data.id;
                    axios.defaults.headers.common['X-Metabase-Session'] = this.sessionToken;
                    this.spinner.succeed('Authenticated successfully');
                } catch (loginError) {
                    throw new Error('Login failed. Please check credentials or login manually first.');
                }
            } else {
                // First time setup needed
                this.spinner.info('First time setup detected. Please complete setup in browser first.');
                throw new Error('Please complete initial Metabase setup at http://localhost:3000');
            }
        } catch (error) {
            if (error.message.includes('Please complete initial')) {
                throw error;
            }
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async findDatabase() {
        this.spinner.start('Finding Blockchain Test Results database...');

        try {
            const response = await axios.get(`${METABASE_URL}/api/database`);
            const databases = response.data;

            // Find our SQLite database
            const blockchainDb = databases.find(db =>
                db.name.toLowerCase().includes('blockchain') ||
                db.name.toLowerCase().includes('test')
            );

            if (blockchainDb) {
                this.databaseId = blockchainDb.id;
                this.spinner.succeed(`Found database: ${blockchainDb.name} (ID: ${this.databaseId})`);
            } else {
                throw new Error('Blockchain Test Results database not found. Please add it manually first.');
            }
        } catch (error) {
            throw new Error(`Database search failed: ${error.message}`);
        }
    }

    async createDashboard() {
        this.spinner.start('Creating Blockchain Analytics Dashboard...');

        try {
            const dashboardData = {
                name: "🚀 Blockchain Test Analytics",
                description: "Comprehensive analytics for EVM compatibility and DeFi protocol testing"
            };

            const response = await axios.post(`${METABASE_URL}/api/dashboard`, dashboardData);
            this.dashboardId = response.data.id;
            this.spinner.succeed(`Created dashboard (ID: ${this.dashboardId})`);
        } catch (error) {
            throw new Error(`Dashboard creation failed: ${error.message}`);
        }
    }

    async loadTemplateQueries() {
        const templates = [
            { file: 'evm-compatibility-queries.sql', name: 'EVM Compatibility' },
            { file: 'defi-protocol-queries.sql', name: 'DeFi Protocols' }
        ];

        for (const template of templates) {
            await this.processTemplate(template);
        }
    }

    async processTemplate(template) {
        const filePath = path.join(TEMPLATES_DIR, template.file);
        this.spinner.start(`Processing ${template.name} queries...`);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const queries = this.parseQueries(content);

            let created = 0;
            for (const query of queries) {
                try {
                    await this.createQuestion(query, template.name);
                    created++;
                } catch (err) {
                    console.log(chalk.yellow(`  ⚠ Skipped: ${query.name}`));
                }
            }

            this.spinner.succeed(`${template.name}: Created ${created} questions`);
        } catch (error) {
            this.spinner.fail(`Failed to process ${template.name}: ${error.message}`);
        }
    }

    parseQueries(content) {
        const queries = [];
        const queryBlocks = content.split(/^--\s+\d+\./gm);

        for (const block of queryBlocks) {
            if (!block.trim()) continue;

            // Extract query name from first comment line
            const nameMatch = block.match(/^([^\n]+)/);
            const name = nameMatch ? nameMatch[1].trim() : 'Unnamed Query';

            // Extract SQL (everything after SELECT until next query or end)
            const sqlMatch = block.match(/SELECT[\s\S]+?(?=^--|$)/m);
            if (sqlMatch) {
                queries.push({
                    name: name,
                    sql: sqlMatch[0].trim()
                });
            }
        }

        return queries;
    }

    async createQuestion(query, category) {
        const cardData = {
            name: `${category} - ${query.name}`,
            dataset_query: {
                type: "native",
                native: {
                    query: query.sql
                },
                database: this.databaseId
            },
            display: "table",
            visualization_settings: {},
            collection_id: null
        };

        try {
            // Create the question
            const cardResponse = await axios.post(`${METABASE_URL}/api/card`, cardData);
            const cardId = cardResponse.data.id;

            // Add to dashboard
            const dashcardData = {
                dashboard_id: this.dashboardId,
                card_id: cardId,
                size_x: 6,
                size_y: 4,
                row: 0,
                col: 0
            };

            await axios.post(`${METABASE_URL}/api/dashboard/${this.dashboardId}/cards`, dashcardData);

        } catch (error) {
            // Silently skip if question already exists
            if (!error.response?.data?.message?.includes('already exists')) {
                throw error;
            }
        }
    }
}

// Alternative: Export dashboard configuration
async function exportDashboardConfig() {
    const config = {
        name: "Blockchain Test Analytics Dashboard",
        description: "Pre-configured dashboard for blockchain test analysis",
        cards: [
            // Overview Section
            {
                name: "Overall EVM Compatibility Score",
                sql: `SELECT network_name, COUNT(*) as total_tests,
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
                      FROM test_results WHERE test_type = 'evm-compatibility'
                      GROUP BY network_name ORDER BY success_rate DESC`,
                visualization: "bar",
                size: { x: 8, y: 4 }
            },
            {
                name: "DeFi Protocol Health Matrix",
                sql: `SELECT network_name, test_name as protocol,
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
                      FROM test_results WHERE test_type = 'defi-protocols'
                      GROUP BY network_name, test_name ORDER BY network_name, success_rate DESC`,
                visualization: "table",
                size: { x: 8, y: 6 }
            },
            {
                name: "Test Execution Trends",
                sql: `SELECT DATE(start_time) as date, COUNT(*) as tests,
                      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed
                      FROM test_results WHERE start_time >= date('now', '-7 days')
                      GROUP BY DATE(start_time) ORDER BY date`,
                visualization: "line",
                size: { x: 16, y: 4 }
            },
            {
                name: "Gas Usage Analysis",
                sql: `SELECT network_name, test_type,
                      ROUND(AVG(gas_used), 0) as avg_gas,
                      ROUND(MIN(gas_used), 0) as min_gas,
                      ROUND(MAX(gas_used), 0) as max_gas
                      FROM test_results WHERE success = 1
                      GROUP BY network_name, test_type`,
                visualization: "table",
                size: { x: 8, y: 4 }
            },
            {
                name: "Network Comparison KPIs",
                sql: `SELECT network_name,
                      COUNT(*) as total_tests,
                      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed_tests,
                      COUNT(DISTINCT test_type) as test_types,
                      ROUND(AVG(duration), 2) as avg_duration_ms
                      FROM test_results GROUP BY network_name`,
                visualization: "scalar",
                size: { x: 4, y: 2 }
            }
        ]
    };

    // Save as JSON for manual import
    const configPath = path.join(__dirname, '..', 'metabase-dashboard-config.json');
    await fs.writeJson(configPath, config, { spaces: 2 });

    console.log(chalk.green.bold('\n✅ Dashboard configuration exported!'));
    console.log(chalk.yellow(`\n📁 Configuration saved to: ${configPath}`));
    console.log(chalk.cyan('\nTo use this configuration:'));
    console.log('1. Open Metabase at http://localhost:3000');
    console.log('2. Create a new dashboard');
    console.log('3. Add SQL queries from the configuration file');
    console.log('4. Arrange cards according to the size specifications\n');
}

// Run the setup
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--export')) {
        // Just export configuration
        exportDashboardConfig().catch(console.error);
    } else {
        // Try automated setup
        console.log(chalk.yellow('\n⚠️  Note: Automated setup requires Metabase to be configured.'));
        console.log(chalk.cyan('If this is your first time, complete Metabase setup in browser first.\n'));
        console.log(chalk.gray('Alternatively, run with --export flag to get manual configuration.\n'));

        const setup = new MetabaseDashboardSetup();
        setup.setup().catch(error => {
            console.error(chalk.red(`\n❌ ${error.message}`));
            console.log(chalk.yellow('\n💡 Try: node scripts/setup-metabase-dashboard.js --export'));
            console.log(chalk.yellow('   This will create a configuration file for manual setup.\n'));
        });
    }
}

module.exports = MetabaseDashboardSetup;