const express = require("express");
const router = express.Router();
const pool = require("../services/db");
const axios = require("axios");

async function tryProjectConfigs(teamId, channelId, callback) {
  const result = await pool.query(
    `SELECT gitlab_project_id, gitlab_token, gitlab_host FROM projects_config
     WHERE teams_team_id = $1 AND teams_channel_id = $2
     ORDER BY updated_at DESC`,
    [teamId, channelId]
  );

  if (result.rowCount === 0) {
    throw new Error("Configuração não encontrada.");
  }

  let lastError = null;
  for (const row of result.rows) {
    try {
      return await callback(row.gitlab_project_id, row.gitlab_token, row.gitlab_host);
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error("Todas as configurações falharam.");
}

// Endpoint para carregar dados do Gantt Chart
router.get("/gantt-data", async (req, res) => {
  const { teamId, channelId } = req.query;
  console.log("🔍 Gantt API chamada:", { teamId, channelId });

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(
      teamId, channelId,
      async (projectId, token, host) => {
        const baseUrl = `https://${host}`;
        await axios.get(`${baseUrl}/api/v4/projects/${projectId}`, {
          headers: { "PRIVATE-TOKEN": token }
        });
        return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
      }
    );

    const baseUrl = `https://${gitlab_host}`;
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    // Obter info do projeto para web_url
    const projectResponse = await axios.get(
      `${baseUrl}/api/v4/projects/${gitlab_project_id}`,
      { headers }
    );
    const projectWebUrl = projectResponse.data.web_url;

    let allIssues = [];
    let page = 1;
    let moreIssues = true;

    while (moreIssues) {
      const response = await axios.get(
        `${baseUrl}/api/v4/projects/${gitlab_project_id}/issues`,
        {
          headers,
          params: {
            per_page: 100,
            page: page
          }
        }
      );

      const issuesPage = response.data;
      allIssues = allIssues.concat(issuesPage);
      moreIssues = issuesPage.length === 100;
      page++;
    }

    // Formatar issues para o Gantt
    const issuesFormatted = allIssues.map(issue => {
      const startDate = issue.created_at || issue.updated_at;
      const endDate = issue.due_date || null;

      return {
        id: issue.id,
        iid: issue.iid,
        name: `${issue.title} (${issue.assignee?.name || "No Assignee"})`,
        startDate,
        endDate,
        closed_at: issue.closed_at || null,
        milestone: issue.milestone ? { title: issue.milestone.title } : null,
        assignees: issue.assignees || [],
        labels: issue.labels || []
      };
    });

    res.json({
      issues: issuesFormatted,
      projectWebUrl: projectWebUrl
    });

  } catch (err) {
    console.error("Erro no endpoint Gantt:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar dados para Gantt." });
  }
});

module.exports = router;
