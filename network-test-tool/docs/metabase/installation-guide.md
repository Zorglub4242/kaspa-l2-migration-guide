# Metabase Installation Guide
## Multiple deployment options for blockchain analytics

### 🎯 Overview

This guide provides multiple installation methods for Metabase to work with your blockchain test data, from simple Docker deployment to manual JAR installation.

---

## 📋 Prerequisites

### System Requirements
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 1GB free space for Metabase + your SQLite database
- **OS**: Windows, macOS, or Linux

### Dependencies (choose one)
- **Option A**: Docker + Docker Compose (recommended)
- **Option B**: Java 11+ (for JAR installation)

---

## 🚀 Method 1: Docker Deployment (Recommended)

### Prerequisites Check
```bash
# Check if Docker is installed
docker --version

# Check if Docker Compose is available
docker-compose --version
```

### Quick Start
```bash
# Navigate to your project directory
cd C:\Sources\ethereum-to-kasplex-guide\network-test-tool

# Start Metabase with our script
node scripts/start-metabase.js
```

### Manual Docker Setup
If the script doesn't work, run manually:

```bash
# Pull and start Metabase
docker-compose up -d

# Check if running
docker-compose ps

# View logs
docker-compose logs -f metabase
```

### Configuration
The `docker-compose.yml` file includes:
- **Port**: 3000 (Metabase web interface)
- **Data Volume**: `./data:/blockchain-data` (read-only access to your SQLite database)
- **Persistence**: `./metabase-data:/metabase-data` (Metabase configuration storage)
- **Memory**: 2GB limit, 1GB reserved

### Stopping/Restarting
```bash
# Stop Metabase
docker-compose down

# Restart
docker-compose restart metabase

# Stop and remove (resets configuration)
docker-compose down -v
```

---

## ☕ Method 2: Java JAR Installation

### Prerequisites Check
```bash
# Check Java version (need 11+)
java -version

# If not installed, download from:
# https://adoptium.net/
```

### Installation
```bash
# Navigate to project directory
cd C:\Sources\ethereum-to-kasplex-guide\network-test-tool

# Start with JAR method
node scripts/start-metabase-jar.js
```

### Manual JAR Setup
If the script fails:

```bash
# Download Metabase JAR (one-time)
curl -O https://downloads.metabase.com/v0.48.6/metabase.jar

# Set environment variables
export MB_DB_TYPE=h2
export MB_DB_FILE=./metabase-data/metabase.db
export MB_SITE_NAME="Blockchain Test Analytics"

# Start Metabase
java -jar metabase.jar
```

### Windows JAR Setup
```cmd
# Download using PowerShell
Invoke-WebRequest -Uri "https://downloads.metabase.com/v0.48.6/metabase.jar" -OutFile "metabase.jar"

# Set environment variables
set MB_DB_TYPE=h2
set MB_DB_FILE=.\metabase-data\metabase.db
set MB_SITE_NAME=Blockchain Test Analytics

# Start Metabase
java -jar metabase.jar
```

---

## 🔧 Initial Configuration

### 1. First Access
1. Open http://localhost:3000 in your browser
2. Wait for Metabase to finish initializing (may take 2-3 minutes)
3. You'll see the welcome screen

### 2. Admin Account Setup
1. **Name**: Your full name
2. **Email**: Your email address
3. **Password**: Choose a secure password
4. **Company**: Your organization name (optional)

### 3. Database Connection
1. **Skip** the initial data source setup
2. Go to **⚙️ Admin** → **Databases** → **Add database**
3. Select **SQLite** as database type
4. Configure connection:

#### Docker Installation
```
Display Name: Blockchain Test Results
Database File: /blockchain-data/test-results.db
```

#### JAR Installation
```
Display Name: Blockchain Test Results
Database File: [FULL PATH TO]/data/test-results.db
```

**Windows Example**: `C:\Sources\ethereum-to-kasplex-guide\network-test-tool\data\test-results.db`
**macOS/Linux Example**: `/Users/yourname/projects/network-test-tool/data/test-results.db`

5. Click **Save** and wait for connection test

### 4. Data Exploration
- Metabase will scan your database schema
- Browse tables: **contract_deployments**, **test_results**, **network_results**
- Review suggested questions and insights

---

## 🔍 Verification Steps

### Check Metabase Status
```bash
# Check if Metabase is running
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

### Verify Database Connection
1. Go to **Admin** → **Databases**
2. Click on "Blockchain Test Results"
3. Click **Test connection**
4. Should show: ✅ Connection successful

### Test Data Access
1. Go to **Browse Data**
2. Select "Blockchain Test Results"
3. Click on **test_results** table
4. Should show your blockchain test data

---

## 🛠️ Troubleshooting

### Docker Issues

#### "Docker not found"
```bash
# Install Docker Desktop
# Windows: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
# macOS: https://desktop.docker.com/mac/main/amd64/Docker.dmg
# Linux: Follow distribution-specific instructions
```

#### "Port 3000 already in use"
```bash
# Find what's using port 3000
netstat -tulpn | grep :3000

# Kill the process or change Metabase port
# Edit docker-compose.yml: "3001:3000"
```

#### "Cannot access SQLite database"
```bash
# Check file permissions
ls -la data/test-results.db

# Make readable (Linux/macOS)
chmod 644 data/test-results.db

# Check Docker volume mounting
docker exec -it blockchain-metabase ls -la /blockchain-data/
```

### JAR Installation Issues

#### "Java not found"
```bash
# Install OpenJDK 11+
# Windows: Download from https://adoptium.net/
# macOS: brew install openjdk@11
# Linux: sudo apt-get install openjdk-11-jdk
```

#### "Permission denied" (Linux/macOS)
```bash
# Make JAR executable
chmod +x metabase.jar

# Run with explicit Java path
/usr/bin/java -jar metabase.jar
```

#### "Out of memory"
```bash
# Increase JVM memory
java -Xmx2g -jar metabase.jar
```

### Database Connection Issues

#### "Database file not found"
- **Check path**: Ensure full absolute path to test-results.db
- **Check permissions**: Database file must be readable
- **Run tests**: Generate data by running blockchain tests first

#### "Connection timeout"
- **Check file locks**: Close any other applications using the SQLite file
- **Restart Metabase**: Stop and start Metabase service
- **Check disk space**: Ensure sufficient free space

### Performance Issues

#### "Metabase slow to load"
```bash
# Increase memory allocation
# Docker: Edit docker-compose.yml JAVA_OPTS: "-Xmx2g"
# JAR: java -Xmx2g -jar metabase.jar
```

#### "Queries timing out"
```bash
# Optimize SQLite database
sqlite3 data/test-results.db "VACUUM;"
sqlite3 data/test-results.db "ANALYZE;"
```

---

## 🔒 Security Considerations

### Network Access
- **Default**: Metabase listens on all interfaces (0.0.0.0:3000)
- **Secure**: Bind to localhost only for local access
- **Production**: Use reverse proxy (nginx) with SSL

### Database Security
- **Read-only**: Mount SQLite database as read-only in Docker
- **Backup**: Regular backups of both SQLite and Metabase configuration
- **Access**: Control who has admin access to Metabase

### User Management
- **Admin account**: Use strong password
- **User accounts**: Create limited accounts for team members
- **Groups**: Organize users into groups with appropriate permissions

---

## 📈 Next Steps

### After Installation
1. ✅ **Import dashboard templates** (see templates/ folder)
2. ✅ **Create user accounts** for your team
3. ✅ **Set up data refresh** schedule
4. ✅ **Configure alerts** for important metrics

### Learning Resources
- **Metabase Documentation**: https://www.metabase.com/docs/
- **SQL Query Guide**: docs/metabase/templates/
- **Dashboard Examples**: Explore pre-built queries
- **Best Practices**: docs/metabase/best-practices.md

---

## 💾 Backup and Maintenance

### Backup Configuration
```bash
# Docker: Backup Metabase data
cp -r metabase-data metabase-data-backup-$(date +%Y%m%d)

# JAR: Application database is in metabase-data/
tar -czf metabase-backup-$(date +%Y%m%d).tar.gz metabase-data/
```

### Updating Metabase
```bash
# Docker: Pull latest image
docker-compose pull metabase
docker-compose up -d

# JAR: Download new version
curl -O https://downloads.metabase.com/latest/metabase.jar
```

### Database Maintenance
```bash
# Optimize SQLite performance
sqlite3 data/test-results.db "VACUUM; ANALYZE;"

# Check database size
ls -lh data/test-results.db
```

---

*Ready to start analyzing your blockchain test data with professional dashboards!*