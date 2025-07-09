# TraceFlow

TraceFlow is an advanced AI-driven platform developed for Enda Tao to optimize territorial activity tracking, timesheet management, and receipt book traceability. This solution integrates secure authentication, geolocation, real-time updates, and AI-powered analytics to enhance operational efficiency and accountability across roles such as Super Admin, Admin, Director, Regional Manager, Supervisor, Purchase Team, Stock Manager, and HR. Built as a final-year project, TraceFlow delivers a scalable, secure, and user-centric experience through web and mobile interfaces.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Overview
TraceFlow is a comprehensive platform designed to digitize and streamline Enda Tao’s operational workflows. It provides robust tools for managing timesheets, tracking agent visits with geolocation, and ensuring secure receipt book traceability through QR codes and OTP validation. Leveraging AI for anomaly detection and timesheet optimization, TraceFlow offers role-specific dashboards, real-time notifications, and multilingual support (English, French, Arabic) to empower stakeholders with actionable insights and efficient processes.

---

## Key Features
- **Timesheet Management**:
  - Create, edit, validate, and delete timesheets with role-based access.
  - AI-generated suggestions (up to 5 per request) for optimized scheduling.
  - Filter timesheets by week, year, or role (e.g., Supervisor, HR).
- **Visit Tracking**:
  - Log visits using QR code scanning and OTP validation.
  - Real-time geolocation via Google Maps for agent tracking, route optimization, and nearby agent detection.
  - Location-based filtering by regions, governorates, and delegations.
- **Receipt Book Traceability**:
  - Secure tracking of receipt books and stubs via QR codes and OTP.
  - Transfer history, stock management, and validation for Purchase Team and Stock Manager roles.
  - Audit trails for all transactions.
- **AI-Powered Analytics**:
  - Anomaly detection with a 0.95 confidence threshold for visits and timesheets.
  - Automated report generation for Directors and Admins.
- **Dynamic Dashboards**:
  - Role-specific interfaces with interactive KPIs and visualizations.
  - Supports dark mode and multilingual interfaces (English, French, Arabic).
- **Real-Time Notifications**:
  - WebSocket-based alerts for timesheet approvals, visit logs, and receipt book transfers.
  - Configurable notification rules for all roles.
- **Secure Authentication**:
  - Keycloak with OAuth2 and Google Auth integration.
  - Token lifespans: Access (15 minutes), Refresh (1 day), SSO Session (1 day, idle: 9 hours).
- **Rate Limiting**:
  - Sensitive operations: 10 requests per 10 minutes.
  - OTP and refresh token limits for enhanced security.
- **Logging**:
  - Comprehensive logging with 30-day retention.
  - Log statistics, filters, and health metrics for Super Admin oversight.

---

## System Architecture
TraceFlow is built on a modular, scalable architecture to ensure performance and maintainability:
- **Frontend (Web)**: React with TypeScript, Vite, and Tailwind CSS for responsive, role-based dashboards.
- **Frontend (Mobile)**: Flutter for cross-platform Android and iOS applications.
- **Backend**: Node.js with Express.js, managing API requests, authentication, and WebSocket communication.
- **Database**: PostgreSQL for relational data storage, with Redis for caching.
- **AI Engine**: Ollama with Mistral model for anomaly detection and timesheet suggestions.
- **Authentication**: Keycloak for SSO, integrated with Google OAuth2 for Maps and Calendar.
- **Infrastructure**: Docker for containerization, NGINX for reverse proxy, and PM2 for process management.

---

## Technology Stack
| **Category**            | **Technologies**                                                                 |
|-------------------------|---------------------------------------------------------------------------------|
| **Frontend (Web)**      | React, TypeScript, Vite, Tailwind CSS                                           |
| **Frontend (Mobile)**   | Flutter, Dart                                                                   |
| **Backend**             | Node.js, Express.js                                                             |
| **Database**            | PostgreSQL, Redis                                                               |
| **Authentication**      | Keycloak, Google OAuth2                                                         |
| **AI Engine**           | Ollama (Mistral model)                                                          |
| **Real-Time**           | WebSockets                                                                      |
| **API Documentation**   | Swagger with Redoc                                                              |
| **Testing**             | Jest, Postman, Flutter Test                                                     |
| **Infrastructure**      | Docker, NGINX, PM2                                                              |
| **External Services**   | Google Maps, Google Calendar, WBM.tn SMS (v3, v5), Gmail SMTP                   |
| **Logging**             | Custom logger with 30-day retention, log filters, and metrics                   |
| **CSV Processing**      | UTF-8 encoding (fallback: win1252), comma-delimited, JSON config                |

---

## Installation

### Prerequisites
- **Node.js**: Version 22.14 or later
- **PostgreSQL**: pgAdmin4 version 9
- **Redis**: Latest stable version
- **Docker**: For Keycloak and Redis containers
- **Flutter**: Version 3.29, Dart 3.7
- **Git**: For repository cloning

### Steps
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/traceflow.git
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
   - Create a PostgreSQL database named `traceflow_db`.
   - Execute schema migrations:
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

## Configuration
Configuration is managed through `.env` files included in the repository. Below are key settings for each component:

### Backend `.env`
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
  - Admin Credentials: Configured for administrative access
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
  - Configured with app-specific credentials for email notifications
- **SMS**:
  - WBM.tn API (v5): `https://wbm.tn/wbmonitor/send/webapi/v5/`
  - API Key: `9c5362a406e609d0ecc6f9a0e129c0a6`
  - WBM.tn API (v3): `https://wbm.tn/wbmonitor/send/webapi/v3/send_ack.php`
  - Username: `enda-cash`
  - Password: Configured for secure access
- **Rate Limiting**:
  - Sensitive Operations: 10 requests per 10 minutes
  - OTP: 10 requests per 10 minutes
  - Refresh Tokens: 5 requests per 10 minutes
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
- **Initialization Controls**:
  - Enabled for database, SMTP, SMS, Redis, Google Services, WebSocket, and more

### Frontend `.env`
- **API**:
  - URL: `http://192.168.1.21:5000/api`
  - Timeout: 30 seconds
  - Access Token Lifespan: 15 minutes
- **Keycloak**: Matches backend configuration
- **Google APIs**: Configured for Maps and Calendar integration
- **Permissions** (Selected Examples):
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

### Mobile Configuration
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

### Additional Setup
- **Keycloak**:
  - Access Admin Console at `http://localhost:8080`.
  - Configure `TraceFlow` realm, clients, and role mappings.
- **Google APIs**:
  - Enable Maps and Calendar APIs in Google Cloud Console.
  - Update `.env` files with credentials.
- **SSL (Production)**:
  - Configure paths: `/etc/ssl/private/key.pem`, `/etc/ssl/certs/cert.pem`.
- **Vault**:
  - Address: `http://127.0.0.1:8200`
  - Token: Configured for secure secret management.
- **mDNS**: Enabled for local network discovery.

---

## Usage
- **Web Application**:
  - Start backend server:
    ```bash
    cd Back
    npm start
    ```
  - Start frontend development server:
    ```bash
    cd ../Front
    npm run dev
    ```
  - Access: `http://localhost:5173`
- **Mobile Application**:
  - Launch Flutter app:
    ```bash
    cd Mobile
    flutter run
    ```

### Example Workflows
- **Log a Visit**:
  - Use the mobile app to scan an agent’s QR code, enter OTP, and complete a checklist (e.g., “Transfer a receipt book”).
  - View real-time agent locations on Google Maps.
- **Manage Timesheets**:
  - Access the web interface to create timesheets, review AI suggestions, and validate submissions.
  - Filter timesheets by week, year, or user role.
- **Track Receipt Books**:
  - Scan QR codes to transfer books or collect stubs.
  - Validate transfers or view history (Purchase Team/Stock Manager).
- **Generate Reports**:
  - Schedule or download AI-driven reports (up to 5 downloads per session).
  - Review anomaly detection results for operational insights.

---

## API Documentation
- Access Swagger documentation at: `http://localhost:5000/api-docs`
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

## Testing
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
  - Use Postman collections located in `Back/tests`.
- **Test Coverage**:
  - Target 80%+ coverage for critical modules using Jest and Flutter Test.

---

## Deployment
- **Development Environment**:
  - Set `NODE_ENV=development` in backend `.env`.
  - Start services:
    ```bash
    docker-compose up -d
    ```
- **Production Environment**:
  - Set `NODE_ENV=production` and update `PROD_URL`.
  - Configure NGINX as a reverse proxy:
    ```bash
    nginx -s reload
    ```
  - Manage Node.js processes with PM2:
    ```bash
    pm2 start Back/app.js --name traceflow-backend
    ```
  - Deploy with Docker:
    ```bash
    docker-compose -f docker-compose.prod.yml up -d
    ```
  - Enable HTTPS using SSL certificates (e.g., Let’s Encrypt).

---

## Contributing
Contributions are welcome to enhance TraceFlow’s functionality and reliability.
- **Issues**: Submit bug reports or feature requests via GitHub Issues.
- **Pull Requests**:
  - Fork the repository.
  - Create a feature branch: `git checkout -b feature/your-feature`.
  - Commit changes and submit a pull request for review.
- **Guidelines**:
  - Adhere to ESLint, TypeScript, and Dart coding standards.
  - Include unit tests for new features.
  - Provide detailed pull request descriptions.

---

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Support
For inquiries, bug reports, or feature requests, please use GitHub Issues. Additional support resources are available through the platform’s official channels.

---

TraceFlow is a robust, AI-driven solution tailored for Enda Tao, delivering efficiency, traceability, and scalability for modern operational needs.
