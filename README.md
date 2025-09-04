# 🌟 TraceFlow: AI-Powered Efficiency for Enda Tao 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v22.14+-green?logo=node.js)](https://nodejs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-v3.29-blue?logo=flutter)](https://flutter.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v9+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)

**TraceFlow** is a state-of-the-art, AI-driven platform developed for **Enda Tao** to streamline territorial activity tracking, timesheet management, and receipt book traceability. Created as a final-year project, TraceFlow empowers roles such as Super Admin, Admin, Director, Regional Manager, Supervisor, Purchase Team, Stock Manager, and HR with secure authentication, geolocation, real-time updates, and AI-powered analytics. Featuring dynamic dashboards, multilingual support (English, French, Arabic), and seamless integrations, TraceFlow delivers operational excellence in a scalable, user-centric package. 🌍

---

## 📑 Table of Contents
- [🌟 Overview](#-overview)
- [🔥 Key Features](#-key-features)
- [🏗️ System Architecture](#-system-architecture)
- [🛠️ Technology Stack](#-technology-stack)
- [🚀 Getting Started](#-getting-started)
- [⚙️ Configuration](#-configuration)
- [🎮 Usage](#-usage)
- [📚 API Documentation](#-api-documentation)
- [🧪 Testing](#-testing)
- [🚀 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [📬 Support](#-support)

---

## 🌟 Overview
TraceFlow revolutionizes Enda Tao’s operational workflows by digitizing and optimizing key processes. It integrates:
- **Timesheet Management**: Streamlined creation, validation, and AI-driven scheduling. 📅
- **Visit Tracking**: Real-time geolocation and QR code-based logging. 📍
- **Receipt Book Traceability**: Secure tracking with QR codes and OTP. 📚
- **AI Analytics**: Anomaly detection and actionable insights. 🤖
- **Dynamic Dashboards**: Role-specific, multilingual interfaces. 📊
- **Real-Time Notifications**: WebSocket-driven alerts for instant updates. 🔔

Built for scalability and security, TraceFlow leverages modern technologies to ensure efficiency, traceability, and accountability.

---

## 🔥 Key Features
- **Timesheet Management** 📅
  - Create, edit, validate, and delete timesheets with role-based access.
  - AI-generated suggestions (up to 5 per request) for optimized scheduling.
  - Filter by week, year, or role (e.g., Supervisor, HR).
- **Visit Tracking** 📍
  - Log visits via QR code scanning and OTP validation.
  - Google Maps integration for real-time agent tracking, route optimization, and nearby agent detection.
  - Filter by regions, governorates, or delegations.
- **Receipt Book Traceability** 📚
  - Secure tracking with QR codes and OTP for books and stubs.
  - Transfer history, stock management, and validation for Purchase Team and Stock Manager roles.
  - Comprehensive audit trails.
- **AI-Powered Analytics** 🤖
  - Anomaly detection with a 0.95 confidence threshold.
  - Automated report generation for Directors and Admins.
- **Dynamic Dashboards** 📊
  - Interactive, role-specific KPIs with dark mode support.
  - Multilingual: English, French, Arabic.
- **Real-Time Notifications** 🔔
  - WebSocket-based alerts for timesheet approvals, visit logs, and receipt transfers.
  - Configurable notification rules.
- **Secure Authentication** 🔒
  - Keycloak with OAuth2 and Google Auth integration.
  - Token lifespans: Access (15 min), Refresh (1 day), SSO Session (1 day, idle: 9 hours).
- **Rate Limiting** ⚡
  - Sensitive operations: 10 requests/10 min.
  - OTP and refresh token limits for security.
- **Logging** 📜
  - 30-day retention with log statistics, filters, and health metrics.
  - Max page size: 500, default: 50.

> **Tip**: TraceFlow supports up to 5 file downloads per session for reports and logs.

---

## 🏗️ System Architecture
TraceFlow’s modular architecture ensures scalability and maintainability:
- **Frontend (Web)**: React with TypeScript, Vite, and Tailwind CSS for responsive dashboards.
- **Frontend (Mobile)**: Flutter for cross-platform Android/iOS apps.
- **Backend**: Node.js with Express.js for API, authentication, and WebSocket communication.
- **Database**: PostgreSQL for relational data, Redis for caching.
- **AI Engine**: Ollama with Mistral model for analytics and suggestions.
- **Authentication**: Keycloak for SSO, Google OAuth2 for Maps and Calendar.
- **Infrastructure**: Docker for containerization, NGINX for reverse proxy, PM2 for process management.

<details>
<summary>📊 Architecture Diagram</summary>
<p align="center">
  <img src="https://via.placeholder.com/600x300.png?text=TraceFlow+Architecture+Diagram" alt="TraceFlow Architecture Diagram" />
</p>
</details>

---

## 🛠️ Technology Stack
TraceFlow leverages a modern, robust tech stack, showcased with GitHub-style badges for clarity and visual appeal:

| **Category**            | **Technologies**                                                                 |
|-------------------------|---------------------------------------------------------------------------------|
| **Frontend (Web)**      | [![React](https://img.shields.io/badge/React-v18-61DAFB?logo=react)](https://reactjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-v5-3178C6?logo=typescript)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-v4-646CFF?logo=vite)](https://vitejs.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-38B2AC?logo=tailwind-css)](https://tailwindcss.com/) |
| **Frontend (Mobile)**   | [![Flutter](https://img.shields.io/badge/Flutter-v3.29-02569B?logo=flutter)](https://flutter.dev/) [![Dart](https://img.shields.io/badge/Dart-v3.7-0175C2?logo=dart)](https://dart.dev/) |
| **Backend**             | [![Node.js](https://img.shields.io/badge/Node.js-v22.14-339933?logo=node.js)](https://nodejs.org/) [![Express.js](https://img.shields.io/badge/Express.js-v4-000000?logo=express)](https://expressjs.com/) |
| **Database**            | [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v9-4169E1?logo=postgresql)](https://www.postgresql.org/) [![Redis](https://img.shields.io/badge/Redis-Latest-DC382D?logo=redis)](https://redis.io/) |
| **Authentication**      | [![Keycloak](https://img.shields.io/badge/Keycloak-SSO-4B5EAA?logo=keycloak)](https://www.keycloak.org/) [![Google OAuth2](https://img.shields.io/badge/Google_OAuth2-v2-4285F4?logo=google)](https://developers.google.com/identity) |
| **AI Engine**           | [![Ollama](https://img.shields.io/badge/Ollama-Mistral-FF6F61?logo=ai)](https://ollama.ai/) |
| **Real-Time**           | [![WebSockets](https://img.shields.io/badge/WebSockets-Enabled-FFCA28?logo=websocket)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) |
| **API Docs**            | [![Swagger](https://img.shields.io/badge/Swagger-Redoc-85EA2D?logo=swagger)](https://swagger.io/) |
| **Testing**             | [![Jest](https://img.shields.io/badge/Jest-v29-99424F?logo=jest)](https://jestjs.io/) [![Postman](https://img.shields.io/badge/Postman-API-F76935?logo=postman)](https://www.postman.com/) [![Flutter Test](https://img.shields.io/badge/Flutter_Test-v3-02569B?logo=flutter)](https://flutter.dev/docs/testing) |
| **Infrastructure**      | [![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)](https://www.docker.com/) [![NGINX](https://img.shields.io/badge/NGINX-Reverse_Proxy-009639?logo=nginx)](https://nginx.org/) [![PM2](https://img.shields.io/badge/PM2-Process_Mgr-2B037A?logo=pm2)](https://pm2.keymetrics.io/) |
| **External Services**   | [![Google Maps](https://img.shields.io/badge/Google_Maps-API-4285F4?logo=google-maps)](https://developers.google.com/maps) [![Google Calendar](https://img.shields.io/badge/Google_Calendar-API-4285F4?logo=google)](https://developers.google.com/calendar) [![WBM.tn SMS](https://img.shields.io/badge/WBM.tn-v3/v5-FF5733)](https://wbm.tn/) [![Gmail SMTP](https://img.shields.io/badge/Gmail-SMTP-D14836?logo=gmail)](https://support.google.com/mail) |
| **Logging**             | Custom logger (30-day retention, log filters, metrics) |
| **CSV Processing**      | UTF-8 (fallback: win1252), comma-delimited, JSON config |

---

## 🚀 Getting Started

### Prerequisites
- [![Node.js](https://img.shields.io/badge/Node.js-v22.14+-339933?logo=node.js)](https://nodejs.org/) Node.js v22.14 or later
- [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v9-4169E1?logo=postgresql)](https://www.postgresql.org/) PostgreSQL with pgAdmin4 v9
- [![Redis](https://img.shields.io/badge/Redis-Latest-DC382D?logo=redis)](https://redis.io/) Redis (latest stable)
- [![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)](https://www.docker.com/) Docker for Keycloak and Redis
- [![Flutter](https://img.shields.io/badge/Flutter-v3.29-02569B?logo=flutter)](https://flutter.dev/) Flutter v3.29, Dart 3.7
- [![Git](https://img.shields.io/badge/Git-Clone-F05032?logo=git)](https://git-scm.com/) Git for repository access

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/CodeWizard-404/traceflow.git
   cd traceflow
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd Back
   npm install
   ```

3. **Install Frontend (Web) Dependencies**:
   ```bash
   cd ../Front
   npm install
   ```

4. **Install Mobile Dependencies**:
   ```bash
   cd ../Mobile
   flutter pub get
   ```

5. **Set Up Database**:
   - Create a PostgreSQL database: `traceflow_db`.
   - Run migrations:
     ```bash
     cd Back
     npm run migrate
     ```

6. **Start Docker Containers**:
   - Launch Keycloak and Redis:
     ```bash
     docker-compose up -d
     ```

---

## ⚙️ Configuration
Configuration is managed via `.env` files included in the repository. Key settings are detailed below:

### Backend `.env`
<details>
<summary>🔍 View Backend Configuration</summary>

- **Database**:
  - Host: `localhost:5432`
  - User: `postgres`
  - Password: `admin`
  - Database: `traceflow_db`
- **URLs**:
  - Development: `http://localhost`
  - Production: `https://localhost`
  - Frontend: `http://localhost:5173`, `http://192.168.1.21:5173`, `http://192.168.1.100`
  - Login: `http://localhost:5173/login`
  - Redirect: `http://localhost:5000/api/auth/callback`
- **Keycloak**:
  - URL: `http://localhost:8080`
  - Realm: `TraceFlow`
  - Client ID: `traceflow-backend`
  - Client Secret: `9FQJDVvEU3MZvB9CGxuM50IcTVOapED7`
  - Admin: Configured for administrative access
- **Google APIs**:
  - Maps API Key: `AIzaSyDkbpHSSJc-fsV5fcwYkSxk0Mq0RNCAb7g`
  - Calendar Client ID: `803294683158-1o22qb2cda9c5mgvj5dhn8pdcn11jo45.apps.googleusercontent.com`
  - Calendar Redirect URI: `http://localhost:5000/api/auth/google-calendar-auth/callback`
- **Redis**:
  - Host: `localhost:6379`
  - Cluster: Disabled
- **Ollama (AI)**:
  - URL: `http://localhost:11434/api`
  - Model: `mistral`
  - Timeout: 5 minutes
  - Max Retries: 3
  - Anomaly Threshold: 0.95
  - Max Timesheet Suggestions: 5
- **SMTP**:
  - Host: `smtp.gmail.com:587`
  - Configured with app-specific credentials
- **SMS**:
  - WBM.tn API (v5): `https://wbm.tn/wbmonitor/send/webapi/v5/`
  - API Key: `9c5362a406e609d0ecc6f9a0e129c0a6`
  - WBM.tn API (v3): `https://wbm.tn/wbmonitor/send/webapi/v3/send_ack.php`
  - Username: `enda-cash`
  - Password: Configured for secure access
- **Rate Limiting**:
  - Sensitive Operations: 10 requests/10 min
  - OTP: 10 requests/10 min
  - Refresh Tokens: 5 requests/10 min
- **Logging**:
  - Level: `info`
  - Retention: 30 days
  - Secret: Configured for secure logging
  - Sample Rate: 1
- **CSV Processing**:
  - Encoding: `utf8` (fallback: `win1252`)
  - Delimiter: `,`
  - Config Path: `./config/csv-config.json`
- **Roles**:
  - Super Admin, Admin, Director, Regional Manager, Supervisor, Purchase Team, Stock Manager, HR
- **Initialization**:
  - Enabled: Database, SMTP, SMS, Redis, Google Services, WebSocket, etc.
- **Vault**:
  - Address: `http://127.0.0.1:8200`
  - Token: Configured for secret management
- **mDNS**: Enabled for local discovery
</details>

### Frontend `.env`
<details>
<summary>🔍 View Frontend Configuration</summary>

- **API**:
  - URL: `http://192.168.1.21:5000/api`
  - Timeout: 30 seconds
  - Access Token Lifespan: 15 minutes
- **Keycloak**: Matches backend configuration
- **Google APIs**: Configured for Maps and Calendar
- **Permissions** (Selected):
  - **Users**: `access_all_users`, `create_users`, `update_users`, `delete_users`
  - **Timesheets**: `access_all_timesheets`, `validate_timesheets`, `suggest_timesheets`
  - **Visits**: `scan_visits`, `log_visits`, `sync_calendar`
  - **Receipt Books**: `transfer_receipt_books`, `validate_receipt_stubs`, `access_receipt_book_history`
  - **Agents**: `access_agents_by_location`, `update_agents_location`, `access_nearby_agents`
  - **Notifications**: `trigger_notifications`, `manage_notification_rules`
  - **Logs**: `view_logs`, `archive_logs`, `export_logs`, `view_logger_metrics`
  - **Reports**: `generate_report`, `schedule_report`, `download_report`
  - **AI**: `access_ai_anomaly_detection`, `manage_ai_config`
- **Roles**: Matches backend roles
- **Checklist Items**:
  - `Transfer a receipt book`
  - `Collect receipt stub`
</details>

### Mobile Configuration
<details>
<summary>🔍 View Mobile Configuration</summary>

- **Base URL**: `http://192.168.1.21:5000/api`
- **Keycloak**:
  - URL: `http://localhost:8080`
  - Realm: `TraceFlow`
  - Client ID: `traceflow-backend`
  - Client Secret: `9FQJDVvEU3MZvB9CGxuM50IcTVOapED7`
  - Redirect URI: `http://localhost:8080/realms/TraceFlow/broker/google/endpoint`
- **Google**:
  - Web Client ID: `803294683158-1o22qb2cda9c5mgvj5dhn8pdcn11jo45.apps.googleusercontent.com`
  - Android Client ID: `803294683158-jf323a7qjjo3nfblgl2nao9il1fgroia.apps.googleusercontent.com`
  - iOS Client ID: `803294683158-47b4jojal7je374cr7n4qh7ra47pcttq.apps.googleusercontent.com`
</details>

### Additional Setup
- **Keycloak**:
  - Admin Console: `http://localhost:8080`
  - Configure `TraceFlow` realm, clients, and roles.
- **Google APIs**:
  - Enable Maps and Calendar APIs in Google Cloud Console.
  - Update `.env` files with credentials.
- **SSL (Production)**:
  - Paths: `/etc/ssl/private/key.pem`, `/etc/ssl/certs/cert.pem`
- **Vault**:
  - Address: `http://127.0.0.1:8200`
  - Token: Configured for secure secrets.

---

## 🎮 Usage
- **Web Application**:
  - Start backend:
    ```bash
    cd Back
    npm start
    ```
  - Start frontend:
    ```bash
    cd ../Front
    npm run dev
    ```
  - Access: `http://localhost:5173`
- **Mobile Application**:
  - Run Flutter app:
    ```bash
    cd Mobile
    flutter run
    ```

### Example Workflows
- **Log a Visit** 📍:
  - Scan QR code, enter OTP, complete checklist (e.g., “Transfer a receipt book”).
  - View agent locations on Google Maps.
- **Manage Timesheets** 📅:
  - Create timesheets, review AI suggestions, and validate via web interface.
  - Filter by week, year, or role.
- **Track Receipt Books** 📚:
  - Scan QR codes to transfer books or collect stubs.
  - Validate transfers or view history.
- **Generate Reports** 📊:
  - Schedule AI-driven reports or download (max 5 per session).
  - Analyze anomalies (0.95 threshold).

---

## 📚 API Documentation
- Access Swagger docs: `http://localhost:5000/api-docs`
- Key Endpoints:
  - **Users**: `/api/users`, `/api/roles/assign`, `/api/users/by-role`
  - **Timesheets**: `/api/timesheets`, `/api/timesheets/suggest`, `/api/timesheets/validate`
  - **Visits**: `/api/visits`, `/api/visits/scan`, `/api/visits/sync-calendar`
  - **Receipt Books**: `/api/receipt-books`, `/api/receipt-books/transfer`, `/api/receipt-books/history`
  - **Agents**: `/api/agents`, `/api/agents/locations`, `/api/agents/nearby`
  - **Notifications**: `/api/notifications`, `/api/notifications/rules`
  - **Logs**: `/api/logs`, `/api/logs/export`, `/api/logs/statistics`
  - **Reports**: `/api/reports/generate`, `/api/reports/schedule`

---

## 🧪 Testing
- **Unit Tests**:
  - Backend:
    ```bash
    cd Back
    npm test
    ```
  - Mobile:
    ```bash
    cd Mobile
    flutter test
    ```
- **API Tests**:
  - Use Postman collections in `Back/tests`.
- **Coverage**:
  - Target 80%+ coverage for critical modules.

---

## 🚀 Deployment
- **Development**:
  - Set `NODE_ENV=development`.
  - Start services:
    ```bash
    docker-compose up -d
    ```
- **Production**:
  - Set `NODE_ENV=production` and update `PROD_URL`.
  - Configure NGINX:
    ```bash
    nginx -s reload
    ```
  - Manage Node.js with PM2:
    ```bash
    pm2 start Back/app.js --name traceflow-backend
    ```
  - Deploy with Docker:
    ```bash
    docker-compose -f docker-compose.prod.yml up -d
    ```
  - Enable HTTPS with SSL certificates.

---

## 🤝 Contributing
Contributions are welcome to enhance TraceFlow’s capabilities.
- **Issues**: Report bugs or suggest features via [GitHub Issues](https://github.com/CodeWizard-404/traceflow/issues).
- **Pull Requests**:
  - Fork the repository.
  - Create a branch: `git checkout -b feature/your-feature`.
  - Commit changes and submit a pull request.
- **Guidelines**:
  - Follow ESLint, TypeScript, and Dart standards.
  - Include unit tests.
  - Provide detailed PR descriptions.

---

## 📜 License
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## 📬 Support
For inquiries or issues, please use [GitHub Issues](https://github.com/CodeWizard-404/traceflow/issues). Additional support is available through the platform’s official channels.

---

**TraceFlow** – Empowering Enda Tao with AI-driven efficiency, traceability, and scalability. 🌍
