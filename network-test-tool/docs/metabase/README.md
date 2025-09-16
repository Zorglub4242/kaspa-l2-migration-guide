# Blockchain Analytics with Metabase
## Professional dashboards for your blockchain test data

### 🚀 Quick Start (15 minutes)

Transform your blockchain test results into professional analytics dashboards with Metabase.

#### Prerequisites
- ✅ Docker and Docker Compose installed
- ✅ Your blockchain test tool running (generates SQLite data)
- ✅ 2GB available RAM for Metabase

#### 1. Start Metabase
```bash
# From your network-test-tool directory
node scripts/start-metabase.js
```

#### 2. Initial Setup
1. Open http://localhost:3000 in your browser
2. Create admin account (first time only)
3. Skip the data source setup (we'll add it manually)

#### 3. Add Your Blockchain Database
1. Click **⚙️ Admin** → **Databases** → **Add database**
2. Select **SQLite** as database type
3. Configure connection:
   ```
   Display Name: Blockchain Test Results
   Database File: /blockchain-data/test-results.db
   ```
4. Click **Save** and test connection

#### 4. Explore Your Data
- Metabase will automatically scan your database schema
- Browse **Contract Deployments**, **Test Results**, **Network Performance**
- Let Metabase suggest initial questions and dashboards

---

### 📊 What You Get

#### **Instant Analytics**
- 🔍 **Interactive Dashboards**: Click to drill down from summaries to details
- 📈 **Professional Charts**: Bar charts, time series, heatmaps, KPI cards
- 🔄 **Real-time Data**: Dashboards update as you run new tests
- 📱 **Mobile Ready**: View analytics on any device

#### **Blockchain-Specific Insights**
- **EVM Compatibility**: Track 18 EVM tests across networks
- **DeFi Protocol Performance**: Monitor token, DEX, lending operations
- **Network Comparison**: Gas costs, success rates, performance metrics
- **Cost Optimization**: Identify most efficient networks for different operations

#### **User-Friendly Features**
- **No SQL Required**: Visual query builder for non-technical users
- **Export Ready**: PDF, Excel, PNG exports for reports
- **Sharing**: Send dashboard links to stakeholders
- **Alerts**: Email notifications when metrics change

---

### 🎯 Your System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Your Current  │    │   JSReports     │    │    Metabase     │
│   Dashboard     │    │    Studio       │    │   Analytics     │
│   (Port 5488)   │    │   (Port 5489)   │    │   (Port 3000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   SQLite DB     │
                    │ (test-results)  │
                    └─────────────────┘
```

**Benefits:**
- ✅ **No disruption**: Keep your existing dashboard
- ✅ **Enhanced capabilities**: Add professional analytics
- ✅ **Single data source**: Same SQLite database
- ✅ **User choice**: Simple reports OR interactive analytics

---

### 📈 Sample Dashboards

#### **Contract Deployment Dashboard**
- Total contracts deployed by network
- Success rate trends over time
- Gas usage optimization opportunities
- Health status monitoring

#### **Test Results Analytics**
- EVM compatibility scores (current: 100% on Igra)
- DeFi protocol performance matrix
- Network efficiency rankings
- Error pattern analysis

#### **Executive Summary**
- KPI cards for system health
- Network comparison metrics
- Cost optimization insights
- Performance trending

---

### 🔧 Management Commands

#### **Start/Stop Metabase**
```bash
# Start (includes health checks)
node scripts/start-metabase.js

# Stop
docker-compose down

# View logs
docker-compose logs metabase

# Restart
docker-compose restart metabase
```

#### **Data Management**
```bash
# Backup Metabase configuration
docker-compose exec metabase backup

# View database size
ls -lh data/test-results.db

# Check Metabase health
curl http://localhost:3000/api/health
```

#### **Troubleshooting**
```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs -f metabase

# Reset Metabase (removes dashboards!)
docker-compose down -v
rm -rf metabase-data
```

---

### 📚 Documentation Structure

```
docs/metabase/
├── README.md (this file)
├── quick-start.md (detailed setup)
├── database-connection.md (SQLite configuration)
├── dashboard-templates.md (pre-built dashboards)
├── user-guides/
│   ├── test-engineers.md
│   ├── devops-teams.md
│   └── management.md
└── integration/
    ├── existing-dashboard.md
    └── api-automation.md
```

---

### 🎉 Next Steps

1. **✅ Complete initial setup** (above)
2. **📊 Import dashboard templates** (see dashboard-templates.md)
3. **👥 Create user accounts** for your team
4. **🔗 Integrate with existing workflow** (see integration guide)
5. **📈 Customize dashboards** for your specific needs

---

### 💡 Tips for Success

#### **For Test Engineers**
- Use drill-down to investigate failed tests
- Set up alerts for success rate drops
- Compare gas usage across networks

#### **For DevOps Teams**
- Monitor system health dashboards
- Track deployment success trends
- Set up automated reporting

#### **For Management**
- Focus on executive summary dashboards
- Export reports for stakeholder meetings
- Track cost optimization metrics

---

### 🆘 Need Help?

- 📖 **Full Documentation**: See docs/metabase/ folder
- 🐛 **Troubleshooting**: docs/metabase/troubleshooting.md
- 💬 **Questions**: Check existing dashboard at http://localhost:5488
- 🚀 **Advanced**: docs/metabase/advanced-configuration.md

---

*🎯 Goal: Transform your blockchain test data into professional insights in 15 minutes*