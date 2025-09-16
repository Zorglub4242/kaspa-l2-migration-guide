#!/usr/bin/env node

/**
 * Fully Automated Metabase Setup
 * Creates admin account, adds database, and sets up dashboard
 */

const axios = require('axios');
const path = require('path');
const chalk = require('chalk');

const METABASE_URL = 'http://localhost:3000';

// Configuration
const ADMIN_EMAIL = 'admin@blockchain.local';
const ADMIN_PASSWORD = 'Blockchain123!';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'User';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupMetabase() {
    console.log(chalk.cyan.bold('\n🚀 Automated Metabase Setup\n'));

    try {
        // Step 1: Get setup token
        console.log('1️⃣  Getting setup token...');
        const propertiesResponse = await axios.get(`${METABASE_URL}/api/session/properties`);
        const setupToken = propertiesResponse.data['setup-token'];

        if (!setupToken) {
            console.log(chalk.yellow('Metabase is already set up!'));
            console.log('Use the existing admin credentials to login.');
            return;
        }

        console.log(chalk.green('✓ Got setup token'));

        // Step 2: Create admin user
        console.log('\n2️⃣  Creating admin account...');
        const setupData = {
            token: setupToken,
            user: {
                email: ADMIN_EMAIL,
                first_name: ADMIN_FIRST_NAME,
                last_name: ADMIN_LAST_NAME,
                password: ADMIN_PASSWORD,
                password_confirm: ADMIN_PASSWORD,
                site_name: "Blockchain Analytics"
            },
            database: null,  // We'll add database after setup
            prefs: {
                site_name: "Blockchain Analytics",
                site_locale: "en",
                allow_tracking: false
            }
        };

        const setupResponse = await axios.post(`${METABASE_URL}/api/setup`, setupData);
        const sessionToken = setupResponse.data.id;

        console.log(chalk.green('✓ Admin account created'));
        console.log(chalk.gray(`  Email: ${ADMIN_EMAIL}`));
        console.log(chalk.gray(`  Password: ${ADMIN_PASSWORD}`));

        // Set session token for future requests
        axios.defaults.headers.common['X-Metabase-Session'] = sessionToken;

        // Step 3: Wait a moment for Metabase to finish setup
        console.log('\n3️⃣  Waiting for Metabase to initialize...');
        await sleep(3000);

        // Step 4: Add SQLite database
        console.log('\n4️⃣  Adding Blockchain Test Results database...');
        const dbPath = '/blockchain-data/test-results.db';  // Use Docker mount path directly

        const databaseData = {
            name: "Blockchain Test Results",
            engine: "sqlite",
            details: {
                db: dbPath
            },
            is_full_sync: true,
            is_on_demand: false,
            auto_run_queries: true
        };

        const dbResponse = await axios.post(`${METABASE_URL}/api/database`, databaseData);
        const databaseId = dbResponse.data.id;

        console.log(chalk.green('✓ Database added (ID: ' + databaseId + ')'));

        // Step 5: Create dashboard
        console.log('\n5️⃣  Creating analytics dashboard...');
        const dashboardData = {
            name: "🚀 Blockchain Test Analytics",
            description: "Comprehensive analytics for blockchain testing",
            parameters: []
        };

        const dashResponse = await axios.post(`${METABASE_URL}/api/dashboard`, dashboardData);
        const dashboardId = dashResponse.data.id;

        console.log(chalk.green('✓ Dashboard created (ID: ' + dashboardId + ')'));

        // Step 6: Create sample questions
        console.log('\n6️⃣  Creating dashboard cards...');

        const queries = [
            {
                name: "Network Performance Overview",
                sql: `SELECT network_name, COUNT(*) as total_tests,
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as success_rate,
                      ROUND(AVG(gas_used), 0) as avg_gas
                      FROM test_results GROUP BY network_name`,
                display: "table"
            },
            {
                name: "EVM Compatibility Score",
                sql: `SELECT network_name,
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as score
                      FROM test_results WHERE test_type = 'evm-compatibility'
                      GROUP BY network_name ORDER BY score DESC`,
                display: "bar"
            },
            {
                name: "Recent Test Activity",
                sql: `SELECT DATE(start_time) as date, COUNT(*) as tests,
                      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed
                      FROM test_results WHERE start_time >= date('now', '-7 days')
                      GROUP BY DATE(start_time) ORDER BY date`,
                display: "line"
            }
        ];

        for (const query of queries) {
            try {
                // Create question
                const cardData = {
                    name: query.name,
                    dataset_query: {
                        type: "native",
                        native: { query: query.sql },
                        database: databaseId
                    },
                    display: query.display,
                    visualization_settings: {}
                };

                const cardResponse = await axios.post(`${METABASE_URL}/api/card`, cardData);
                const cardId = cardResponse.data.id;

                // Add to dashboard
                await axios.post(`${METABASE_URL}/api/dashboard/${dashboardId}/cards`, {
                    cardId: cardId,
                    row: 0,
                    col: 0,
                    size_x: 8,
                    size_y: 4
                });

                console.log(chalk.green(`  ✓ Added: ${query.name}`));
            } catch (err) {
                console.log(chalk.yellow(`  ⚠ Skipped: ${query.name}`));
            }
        }

        // Success!
        console.log(chalk.green.bold('\n✨ Setup Complete!\n'));
        console.log(chalk.cyan('📊 Access your dashboard at:'));
        console.log(chalk.white.bold(`   ${METABASE_URL}/dashboard/${dashboardId}\n`));
        console.log(chalk.cyan('🔑 Login credentials:'));
        console.log(chalk.white(`   Email: ${ADMIN_EMAIL}`));
        console.log(chalk.white(`   Password: ${ADMIN_PASSWORD}\n`));

    } catch (error) {
        console.error(chalk.red('\n❌ Setup failed:'));
        console.error(chalk.red(error.response?.data?.message || error.message));

        if (error.response?.status === 403) {
            console.log(chalk.yellow('\nMetabase might already be configured.'));
            console.log(chalk.yellow('Try logging in at: ' + METABASE_URL));
        }
    }
}

// Run setup
setupMetabase();