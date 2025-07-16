# SprintLab

**SprintLab** is an integration solution between Microsoft Teams and GitLab, designed to enable Agile and efficient project management through a modern and intuitive interface.  
It allows you to view, create, and edit issues directly within Teams, while also providing real-time dashboards to track project progress.

---

## ⚙️ Configuration 

🔗 **SprintLab Demo Team in Microsoft Teams**

### Setup Steps:

1. Access the Teams channel mentioned above and add a new **tab**.
2. Select **SprintLab** from the list of apps and fill in the required information:
   - **GitLab Instance URL**
   - **GitLab Project ID**
   - **GitLab Personal Access Token**  
     (Note: This is a personal token generated in GitLab with permission to access the GitLab API.)
3. Click **Validate Configuration** to check the connection.
4. Then, click **Save** to permanently link the project to the Teams channel.

---

## 📋 Board

SprintLab's board follows the **Agile methodology**, displaying issues organized into columns (e.g., To Do, Doing, Done).

Features include:
- Create new issues
- Edit existing issues
- Move issues across columns via drag-and-drop
- Real-time synchronization with GitLab using the REST API

All actions on the board are instantly reflected in the linked GitLab project, ensuring continuous synchronization and full project control.

---

## 📈 Dashboard

The Dashboard section provides an **analytical view** of the project:

### Gantt Chart
- Timeline view of issues based on their milestone and due dates
- Includes advanced filters by:
  - **Work Packages**
  - **Assignees**

### Advanced Statistics
- Key project performance indicators, such as:
  - Number of open and closed issues
  - Total number of issues
  - Issues without milestones
  - Evolution of issues and milestones over time

These tools support strategic project management by offering relevant data for decision-making.

---

## 🎯 Try SprintLab

Feel free to test the solution and link GitLab projects within the demo Teams channel.
