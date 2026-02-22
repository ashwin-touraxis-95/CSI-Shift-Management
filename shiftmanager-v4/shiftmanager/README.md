# 🇿🇦 ShiftManager — South Africa Operations

A locally-hosted shift management web app for 20–50 agents. Built with React + Node.js + SQLite.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Gmail Login | Agents sign in with Google — no passwords needed |
| ⏱ Clock In/Out | One-click clocking from any device on the local network |
| 📅 Weekly Schedule | Visual grid matching your existing spreadsheet layout |
| 👥 Live Availability | Real-time board showing who is online/offline right now |
| 📋 Clock Logs | Management-only view with full history + duration calc |
| ✏️ Shift Manager | Create/edit/delete shifts up to 2 months in advance |
| 📅 Bulk Shifts | Create 30 weekday shifts in one click |
| ⚙️ Team Manager | Assign departments + promote agents to managers |

---

## 🚀 Quick Start

### 1. Install & Run (Demo Mode — No Google Setup Needed)

```bash
chmod +x setup.sh start.sh
./setup.sh
./start.sh
```

Open **http://localhost:3000** in your browser.

**Demo Login:**
- Go to "Demo Mode" on the login page
- Enter `manager@demo.com` → full manager access
- Enter any other email → agent access

---

### 2. Enable Real Google OAuth (Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google+ API**
3. Go to **Credentials** → **Create OAuth 2.0 Client ID**
4. Set Authorized JavaScript origins: `http://localhost:3000`
5. Set Authorized redirect URIs: `http://localhost:3000`
6. Copy your **Client ID**

Create a `.env` file in `backend/`:
```
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
SESSION_SECRET=some-random-secret-string
```

Create a `.env` file in `frontend/`:
```
REACT_APP_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Restart the app with `./start.sh`

---

## 📁 Project Structure

```
shiftmanager/
├── backend/
│   ├── server.js          # Express + Socket.io API
│   ├── db.js              # SQLite setup + schema
│   ├── shiftmanager.db    # Auto-created database
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js           # Gmail OAuth login
│   │   │   ├── Dashboard.js       # Clock in/out + today's view
│   │   │   ├── Schedule.js        # Weekly grid view
│   │   │   ├── Availability.js    # Live availability board
│   │   │   ├── ClockLogs.js       # Management clock history
│   │   │   ├── ManageShifts.js    # Create/edit shifts
│   │   │   └── Team.js            # User role management
│   │   ├── components/
│   │   │   └── Layout.js          # Sidebar navigation
│   │   └── context/
│   │       └── AuthContext.js     # Auth state
│   └── package.json
├── setup.sh
├── start.sh
└── README.md
```

---

## 🌐 Network Access

To allow agents to clock in from their own devices on the same WiFi:

1. Find your server's local IP (e.g., `192.168.1.100`)
2. Share the URL: `http://192.168.1.100:3000`
3. Agents can bookmark this on their phones/computers

---

## 👥 Roles

| Role | Can Do |
|---|---|
| **Agent** | Login, clock in/out, view own schedule, see availability board |
| **Manager** | Everything above + view all clock logs, manage shifts, manage team |

To make someone a manager: go to **Team** page → edit their role.

---

## 🏢 Departments

- CS (Customer Service)
- Sales
- Travel Agents
- Trainees
- Management

---

## 🔒 Security Notes

- All data stays on your local server — nothing goes to the cloud
- Clock logs are only visible to managers
- Sessions expire after 24 hours
- For production use, add HTTPS with a tool like [Caddy](https://caddyserver.com/)
