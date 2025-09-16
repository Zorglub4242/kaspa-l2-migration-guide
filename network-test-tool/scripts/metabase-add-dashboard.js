#!/usr/bin/env node

/**
 * Add Database and Dashboard to existing Metabase
 */

const axios = require('axios');
const chalk = require('chalk');

const METABASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@blockchain.local';
const ADMIN_PASSWORD = 'Blockchain123!';

async function addDashboard() {
    console.log(chalk.cyan.bold('\n📊 Adding Database and Dashboard to Metabase\n'));

    try {
        // Step 1: Login
        console.log('1️⃣  Logging in...');
        const loginResponse = await axios.post(`${METABASE_URL}/api/session`, {
            username: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        const sessionToken = loginResponse.data.id;
        axios.defaults.headers.common['X-Metabase-Session'] = sessionToken;
        console.log(chalk.green('✓ Logged in successfully'));

        // Step 2: Add Database
        console.log('\n2️⃣  Adding database...');
        const databaseData = {
            name: "Blockchain Test Results",
            engine: "sqlite",
            details: {
                db: "/blockchain-data/test-results.db"
            },
            is_full_sync: true,
            auto_run_queries: true
        };

        let databaseId;
        try {
            const dbResponse = await axios.post(`${METABASE_URL}/api/database`, databaseData);
            databaseId = dbResponse.data.id;
            console.log(chalk.green('✓ Database added (ID: ' + databaseId + ')'));
        } catch (err) {
            // Database might already exist, try to find it
            const databases = await axios.get(`${METABASE_URL}/api/database`);
            const existing = databases.data.find(db => db.name === "Blockchain Test Results");
            if (existing) {
                databaseId = existing.id;
                console.log(chalk.yellow('⚠ Database already exists (ID: ' + databaseId + ')'));
            } else {
                throw err;
            }
        }

        // Step 3: Create Dashboard
        console.log('\n3️⃣  Creating dashboard...');
        const dashboardData = {
            name: "🚀 Blockchain Test Analytics",
            description: "Comprehensive analytics for blockchain testing"
        };

        const dashResponse = await axios.post(`${METABASE_URL}/api/dashboard`, dashboardData);
        const dashboardId = dashResponse.data.id;
        console.log(chalk.green('✓ Dashboard created (ID: ' + dashboardId + ')'));

        // Step 4: Add Cards
        console.log('\n4️⃣  Adding analytics cards...');
        const queries = [
            {
                name: "📈 Network Overview",
                sql: `SELECT network_name as "Network",
                      COUNT(*) as "Total Tests",
                      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as "Passed",
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as "Success %",
                      ROUND(AVG(gas_used), 0) as "Avg Gas"
                      FROM test_results GROUP BY network_name`,
                display: "table",
                size: { x: 16, y: 4 }
            },
            {
                name: "🎯 EVM Compatibility",
                sql: `SELECT network_name as "Network",
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as "Score"
                      FROM test_results WHERE test_type = 'evm-compatibility'
                      GROUP BY network_name ORDER BY "Score" DESC`,
                display: "bar",
                size: { x: 8, y: 4 }
            },
            {
                name: "💰 DeFi Protocols",
                sql: `SELECT network_name as "Network",
                      ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as "Score"
                      FROM test_results WHERE test_type = 'defi-protocols'
                      GROUP BY network_name ORDER BY "Score" DESC`,
                display: "bar",
                size: { x: 8, y: 4 }
            },
            {
                name: "📊 7-Day Trend",
                sql: `SELECT DATE(start_time) as "Date", COUNT(*) as "Tests",
                      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as "Passed"
                      FROM test_results WHERE start_time >= date('now', '-7 days')
                      GROUP BY DATE(start_time) ORDER BY "Date"`,
                display: "line",
                size: { x: 16, y: 4 }
            },
            {
                name: "⚠️ Recent Failures",
                sql: `SELECT test_name as "Test", network_name as "Network",
                      COUNT(*) as "Failures", SUBSTR(error_message, 1, 50) as "Error"
                      FROM test_results WHERE success = 0 AND error_message IS NOT NULL
                      GROUP BY test_name, network_name ORDER BY "Failures" DESC LIMIT 10`,
                display: "table",
                size: { x: 16, y: 5 }
            }
        ];

        let row = 0;
        for (const query of queries) {
            try {
                // Create card
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
                const col = query.size.x === 16 ? 0 : (queries.indexOf(query) % 2) * 8;

                await axios.post(`${METABASE_URL}/api/dashboard/${dashboardId}/cards`, {
                    cardId: cardId,
                    row: row,
                    col: col,
                    size_x: query.size.x,
                    size_y: query.size.y
                });

                console.log(chalk.green(`  ✓ Added: ${query.name}`));

                // Update row position
                if (query.size.x === 16 || col === 8) {
                    row += query.size.y;
                }
            } catch (err) {
                console.log(chalk.yellow(`  ⚠ Failed: ${query.name} - ${err.message}`));
            }
        }

        // Success!
        console.log(chalk.green.bold('\n✨ Dashboard Ready!\n'));
        console.log(chalk.cyan('📊 View your dashboard at:'));
        console.log(chalk.white.bold(`   ${METABASE_URL}/dashboard/${dashboardId}\n`));
        console.log(chalk.gray('Login: admin@blockchain.local / Blockchain123!'));

    } catch (error) {
        console.error(chalk.red('\n❌ Failed:'));
        console.error(chalk.red(error.response?.data?.message || error.message));
    }
}

// Run
addDashboard();