# SprintLab

**SprintLab** is an integration tool between **GitLab** and **Microsoft Teams**, designed to enhance Agile project management by synchronizing data, generating real-time dashboards, and allowing seamless task updates directly from Teams.

## ⚙️ Key Features

- **GitLab API Integration:** Retrieve project data, issues, labels, and milestones without using webhooks.
- **Visual Dashboards:** Automatically generated **Kanban** and **Gantt** charts viewable inside Microsoft Teams.
- **Advanced Metrics:** Productivity stats per sprint, assignee, or work package (milestone).
- **Bidirectional Updates:** Any task updates made in Teams are reflected directly in GitLab.

## 🔧 Technologies Used

- **Backend:** Node.js with Express.js
- **Frontend (Teams Plugin):** React + TypeScript
- **Data Visualization:** Chart.js and custom logic for Gantt views
- **Database:** PostgreSQL
- **Deployment:** Fly.io
- **GitLab Integration:** GitLab's official REST API
- **Teams Integration:** Custom app (no Microsoft Graph API used)

## 📡 Main API Endpoints

- `GET /project-config`: Fetch GitLab project configuration linked to a Teams channel
- `GET /boards`: List all GitLab issue boards for the project
- `GET /`: Retrieve issues organized by board columns
- `GET /labels`, `/milestones`, `/users`: Fetch project metadata
- `PUT /:issueIid`: Update a GitLab issue from Teams
- `GET /project-name`: Retrieve the GitLab project name

## 🏁 How It Works

1. The Teams plugin connects to the backend middleware via REST.
2. The middleware queries GitLab and transforms issue data into visual structures (Kanban, Gantt).
3. Users can filter, view, and edit tasks directly within Microsoft Teams.
4. All updates made through Teams are instantly pushed to GitLab.

## 🧪 Testing & Results

- Supports multiple GitLab projects and Teams channels
- Stable sync performance without relying on webhooks
- Average response time: < 500ms for standard queries
- Fully functional without requiring local database triggers

## 🚀 Roadmap

- Real-time notifications via Teams
- Automated sprint-based statistics
- Multi-workspace and cross-project support
- Candidate for **PMI Portugal Project Management Awards 2025**

---

**SprintLab** is a lightweight, scalable, and secure solution tailored for modern development teams working with both GitLab and Microsoft Teams.

> “Empower your team with a unified view of your Agile workflows.”

---
