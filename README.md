🌍 TraceFlow: Empowering Enda Tao with AI-Driven Efficiency
TraceFlow is a cutting-edge, AI-powered platform built for Enda Tao to revolutionize territorial activity tracking, timesheet management, and receipt book traceability. Crafted as a final-year project by Ghaith Othmani and Sofien Laghouanem, TraceFlow combines secure authentication, geolocation, real-time updates, and AI analytics to streamline operations for supervisors, regional managers, HR teams, and more. With dynamic dashboards, multilingual support, and robust integrations, TraceFlow is your go-to solution for operational excellence.

🚀 Why TraceFlow?
TraceFlow transforms complex workflows into seamless, digital experiences:

Track Everything: From agent visits to receipt book transfers, all in real-time.
AI-Powered Insights: Detect anomalies and optimize timesheets with intelligent suggestions.
Secure & Scalable: Built with Keycloak, Google OAuth2, and a modular architecture.
User-Friendly: Intuitive web and mobile interfaces in English, French, and Arabic.
Real-Time: WebSocket-driven notifications for instant updates.


📑 Table of Contents

Key Features
Architecture
Technologies
Getting Started
Configuration
Usage
API Documentation
Testing
Deployment
Contributing
License
Acknowledgements
Contact Us


🌟 Key Features

Timesheet Management 📅
Create, edit, validate, or delete timesheets.
AI-driven suggestions (up to 5 per request) for optimized scheduling.
Role-based access for Supervisors, Regional Managers, and HR.


Visit Tracking 📍
Log visits with QR code scanning and OTP validation.
Real-time geolocation via Google Maps for agent tracking and route optimization.
Nearby agent detection and location-based filtering (regions, governorates, delegations).


Receipt Book Traceability 📚
Secure tracking with QR codes and OTP for receipt books and stubs.
Transfer history and stock management for Purchase Team and Stock Managers.
Validate transfers and archive stubs with detailed audit trails.


AI Analytics 🤖
Anomaly detection with a 0.95 threshold for visits and timesheets.
Generate actionable reports and insights for Directors and Admins.


Dynamic Dashboards 📊
Role-specific, interactive visualizations with KPIs.
Supports dark mode and multilingual interfaces (English, French, Arabic).


Real-Time Notifications 🔔
WebSocket-based alerts for timesheet approvals, visit logs, and receipt transfers.
Configurable notification rules for all roles.


Secure Authentication 🔒
Keycloak with OAuth2 and Google Auth integration.
Token lifespans: Access (15 min), Refresh (1 day), SSO Session (1 day, idle: 9 hours).


Rate Limiting ⚡
Sensitive operations: 10 requests/10 min.
OTP and refresh token limits for enhanced security.


Logging 📜
Comprehensive logging with 30-day retention.
Log statistics, filters, and health metrics for Super Admins.




🏗️ Architecture
TraceFlow is built on a modular, scalable architecture:

Frontend (Web): React with TypeScript, Vite, and Tailwind CSS for responsive, role-based dashboards.
Frontend (Mobile): Flutter for cross-platform Android and iOS apps.
Backend: Node.js with Express.js, handling APIs, authentication, and WebSockets.
Database: PostgreSQL for relational data, Redis for caching.
AI: Ollama with Mistral model for anomaly detection and timesheet suggestions.
Authentication: Keycloak for SSO, Google OAuth2 for Maps and Calendar.
Infrastructure: Docker for containerization, NGINX for reverse proxy, PM2 for process management.


🛠️ Technologies



Category
Tools



Frontend (Web)
React, TypeScript, Vite, Tailwind CSS


Frontend (Mobile)
Flutter, Dart


Backend
Node.js, Express.js


Database
PostgreSQL, Redis


Authentication
Keycloak, Google OAuth2


AI
Ollama (Mistral model)


Real-Time
WebSockets


API Docs
Swagger with Redoc


Testing
Jest, Postman, Flutter Test


Infrastructure
Docker, NGINX, PM2


External APIs
Google Maps, Google Calendar, WBM.tn SMS (v3, v5), Gmail SMTP


Logging
Custom logger with 30-day retention, log filters, and metrics


CSV Processing
UTF-8 encoding (fallback: win1252), comma-delimited



🚀 Getting Started
Prerequisites

Node.js: v22.14 or later
PostgreSQL: pgAdmin4 v9
Redis: Latest stable version
Docker: For Keycloak and Redis
Flutter: v3.29, Dart 3.7
Git: For repository cloning

Installation

Clone the Repository:
git clone https://github.com/yourusername/traceflow.git
cd traceflow


Install Backend Dependencies:
cd Back
npm install


Install Frontend (Web) Dependencies:
cd ../Front
npm install


Install Mobile Dependencies:
cd ../Mobile
flutter pub get


Set Up Database:

Create a PostgreSQL database: traceflow_db.
Run migrations:cd Back
npm run migrate




Start Docker Containers:

Run Keycloak and Redis:docker-compose up -d






⚙️ Configuration
The .env files are included in the repository. Below are key configurations for each component:
Backend .env

Database:
Host: localhost:5432
User: postgres
Password: admin
Database: traceflow_db


URLs:
Dev: http://localhost
Prod: https://localhost
Frontend: http://localhost:5173, http://192.168.1.21:5173, http://192.168.1.100


Keycloak:
URL: http://localhost:8080
Realm: TraceFlow
Client ID: traceflow-backend
Client Secret: 9FQJDVvEU3MZvB9CGxuM50IcTVOapED7
Admin: admin:admin


Google APIs:
Maps API Key: AIzaSyDkbpHSSJc-fsV5fcwYkSxk0Mq0RNCAb7g
Calendar Client ID: 803294683158-1o22qb2cda9c5mgvj5dhn8pdcn11jo45.apps.googleusercontent.com
Redirect URI: http://localhost:5000/api/auth/google-calendar-auth/callback


Redis:
Host: localhost:6379
Cluster: Disabled


Ollama (AI):
URL: http://localhost:11434/api
Model: mistral
Timeout: 5 min
Max Retries: 3
Anomaly Threshold: 0.95
Max Timesheet Suggestions: 5


SMTP:
Host: smtp.gmail.com:587
User: sofienlaghouanem.2.0@gmail.com
Password: App-specific (e.g., zggw thic dbfm lzev)


SMS:
WBM.tn API (v5): https://wbm.tn/wbmonitor/send/webapi/v5/
API Key: 9c5362a406e609d0ecc6f9a0e129c0a6
WBM.tn API (v3): https://wbm.tn/wbmonitor/send/webapi/v3/send_ack.php
Username: enda-cash
Password: i9ehsSdhOLD


Rate Limiting:
Sensitive: 10 requests/10 min
OTP: 10 requests/10 min
Refresh: 5 requests/10 min


Logging:
Level: info
Retention: 30 days
Secret: Configured for secure logging
Sample Rate: 1


CSV:
Encoding: utf8 (fallback: win1252)
Delimiter: ,
Config: ./config/csv-config.json


Roles:
Super Admin, Admin, Director, Regional Manager, Supervisor, Purchase Team, Stock Manager, HR


Initialization:
Database, SMTP, SMS, Redis, Google Services, Socket, and more enabled by default.



Frontend .env

API:
URL: http://192.168.1.21:5000/api
Timeout: 30 seconds
Access Token Age: 15 min


Keycloak: Matches backend
Google: Maps and Calendar integration
Permissions (Examples):
Users: access_all_users, create_users, update_users
Timesheets: access_all_timesheets, validate_timesheets
Visits: scan_visits, sync_calendar
Receipt Books: transfer_receipt_books, validate_receipt_stubs
Agents: access_agents_by_location, update_agents_location
Notifications: trigger_notifications, manage_notification_rules
Logs: view_logs, archive_logs, export_logs


Roles: Matches backend roles
Checklist Items:
Transfer a receipt book
Collect receipt stub



Mobile Configuration

Base URL: http://192.168.1.21:5000/api
Keycloak:
URL: http://localhost:8080
Realm: TraceFlow
Client ID: traceflow-backend
Client Secret: 9FQJDVvEU3MZvB9CGxuM50IcTVOapED7


Google:
Web Client ID: 803294683158-1o22qb2cda9c5mgvj5dhn8pdcn11jo45.apps.googleusercontent.com
Android Client ID: 803294683158-jf323a7qjjo3nfblgl2nao9il1fgroia.apps.googleusercontent.com
iOS Client ID: 803294683158-47b4jojal7je374cr7n4qh7ra47pcttq.apps.googleusercontent.com



Additional Setup

Keycloak:
Admin Console: http://localhost:8080
Configure TraceFlow realm, clients, and roles.


Google APIs:
Enable Maps and Calendar APIs in Google Cloud Console.
Update .env files with credentials.


SSL (Production):
Use /etc/ssl/private/key.pem and /etc/ssl/certs/cert.pem.


Vault:
Address: http://127.0.0.1:8200
Token: hvs.lCPmlE349j5fhVNbmHsFCk9S


mDNS: Enabled for local discovery.


🎮 Usage

Web Application:
Start backend:cd Back
npm start


Start frontend:cd ../Front
npm run dev


Access: http://localhost:5173


Mobile Application:
Run Flutter app:cd Mobile
flutter run





Example Workflows

Log a Visit:
Open mobile app, scan agent’s QR code, enter OTP, and complete checklist (e.g., "Transfer a receipt book").
View real-time location on Google Maps.


Manage Timesheets:
Access web interface, create timesheet, review AI suggestions, and validate.
HR and Regional Managers can filter by week/year.


Track Receipt Books:
Scan QR codes to transfer books or collect stubs.
View transfer history or validate transfers (Purchase Team/Stock Manager).


Generate Reports:
Use AI-driven anomaly detection or schedule reports for Directors.
Download up to 5 files per session.




📚 API Documentation

Access Swagger docs at: http://localhost:5000/api-docs
Key Endpoints:
Users: CRUD, role assignments (/api/users, /api/roles/assign)
Timesheets: Create, validate, suggest (/api/timesheets, /api/timesheets/suggest)
Visits: Log, scan, sync (/api/visits, /api/visits/scan)
Receipt Books: Create, transfer, validate (/api/receipt-books, /api/receipt-books/transfer)
Agents: Location tracking, assignments (/api/agents, /api/agents/locations)
Notifications: Trigger, manage rules (/api/notifications, /api/notifications/rules)
Logs: View, archive, export (/api/logs, /api/logs/export)




🧪 Testing

Unit Tests:
Backend:cd Back
npm test


Mobile:cd Mobile
flutter test




API Tests:
Use Postman collections in Back/tests.


Coverage:
Jest for backend, Flutter Test for mobile.
Ensure 80%+ coverage for critical modules.




🚀 Deployment

Development:
Set NODE_ENV=development and use local URLs.
Start services:docker-compose up -d




Production:
Set NODE_ENV=production and update PROD_URL.
Configure NGINX:nginx -s reload


Manage Node.js with PM2:pm2 start Back/app.js --name traceflow-backend


Deploy with Docker:docker-compose -f docker-compose.prod.yml up -d


Enable HTTPS with Let’s Encrypt or provided SSL certificates.




🤝 Contributing
We welcome contributions to make TraceFlow even better!

Issues: Report bugs or suggest features via GitHub Issues.
Pull Requests:
Fork the repo.
Create a branch: git checkout -b feature/your-feature.
Commit changes and submit a pull request.


Standards:
Follow ESLint, TypeScript, and Dart conventions.
Include tests for new features.
Document changes in PR descriptions.




📜 License
MIT License. See LICENSE for details.

🙌 Acknowledgements

Enda Tao: For collaboration and real-world insights.
Academic Supervisor: Mrs. Siwar Louati for guidance.
Company Supervisor: Mr. Tarek Chammem for technical expertise.
Open-Source Community: For React, Flutter, Node.js, PostgreSQL, and more.


📬 Contact Us

Email: support@traceflow.example.com
GitHub Issues: For bugs or feature requests
Developers:
Ghaith Othmani: ghaith.othmani@example.com
Sofien Laghouanem: sofien.laghouanem@example.com


Platform: https://traceflow.example.com


TraceFlow – Your gateway to smarter, faster, and more secure operations for Enda Tao! 🚀
