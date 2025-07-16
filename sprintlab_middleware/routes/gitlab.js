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

// Endpoint para obter configuração do projeto
router.get("/project-config", async (req, res) => {
  const { teamId, channelId } = req.query;

  try {
    const config = await tryProjectConfigs(teamId, channelId, async (projectId, token, host) => {
      return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
    });

    res.json(config);
  } catch (err) {
    console.error(" Erro ao buscar configuração:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar configuração." });
  }
});

// Endpoint para listar boards
router.get("/boards", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Faltam parâmetros teamId e channelId" });
  }

  try {
    const boardsData = await tryProjectConfigs(teamId, channelId, async (projectId, token, host) => {
      const baseUrl = `https://${host}`;
      const res = await axios.get(
        `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/boards`,
        { headers: { "PRIVATE-TOKEN": token } }
      );
      return res.data;
    });

    res.json(boardsData);
  } catch (err) {
    console.error(" Erro ao buscar boards:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar boards." });
  }
});

// Buscar issues organizadas por board
router.get("/", async (req, res) => {
  const { teamId, channelId, boardId } = req.query;

  if (!teamId || !channelId || !boardId) {
    return res.status(400).json({ error: "Faltam parâmetros obrigatórios (teamId, channelId, boardId)" });
  }

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(teamId, channelId, async (projectId, token, host) => {
      const baseUrl = `https://${host}`;
      await axios.get(`${baseUrl}/api/v4/projects/${projectId}`, {
        headers: { "PRIVATE-TOKEN": token }
      });
      return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
    });

    const baseUrl = `https://${gitlab_host}`;
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const labelsRes = await axios.get(`${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/labels`, { headers });
    const labelColors = {};
    labelsRes.data.forEach(label => labelColors[label.name] = label.color);

    const projectRes = await axios.get(`${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}`, { headers });

    const listsRes = await axios.get(`${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/boards/${boardId}/lists`, { headers });

    const boardData = {};
    const labelSet = new Set();

    for (const list of listsRes.data) {
      const columnName = list.label?.name || list.list_type || "Sem Nome";
      boardData[columnName] = [];

      if (list.label) {
        labelSet.add(list.label.name);

        const issuesRes = await axios.get(
          `${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?labels=${encodeURIComponent(list.label.name)}&state=opened&per_page=100`,
          { headers }
        );

        boardData[columnName] = issuesRes.data.filter(issue => issue.state === "opened");
      }
    }

    const allOpenRes = await axios.get(`${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?state=opened&per_page=100`, { headers });
    const openIssues = allOpenRes.data.filter(issue => issue.labels.every(label => !labelSet.has(label)));
    if (openIssues.length > 0) boardData["Open"] = openIssues;

    const closedRes = await axios.get(`${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?state=closed&per_page=100`, { headers });
    boardData["Closed"] = closedRes.data;

    const orderedBoard = {};
    if (boardData["Open"]) orderedBoard["Open"] = boardData["Open"];
    for (const [name, issues] of Object.entries(boardData)) {
      if (name !== "Open" && name !== "Closed") orderedBoard[name] = issues;
    }
    if (boardData["Closed"]) orderedBoard["Closed"] = boardData["Closed"];

    res.json({
      project_name: projectRes.data.name,
      project_id: gitlab_project_id,
      project_web_url: projectRes.data.web_url,
      board: orderedBoard,
      label_colors: labelColors
    });

  } catch (err) {
    console.error("Erro ao carregar issues da board:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar issues da board." });
  }
});

// Outros endpoints
const getBaseUrl = (host) => `https://${host}`;

router.get("/users", async (req, res) => {
  const { projectId, token, host } = req.query;
  const baseUrl = getBaseUrl(host);
  try {
    const response = await axios.get(`${baseUrl}/api/v4/projects/${projectId}/users`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar utilizadores." });
  }
});

router.get("/labels", async (req, res) => {
  const { projectId, token, host } = req.query;
  const baseUrl = getBaseUrl(host);
  try {
    const response = await axios.get(`${baseUrl}/api/v4/projects/${projectId}/labels`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar labels." });
  }
});

router.get("/milestones", async (req, res) => {
  const { projectId, token, host } = req.query;
  const baseUrl = getBaseUrl(host);
  try {
    const response = await axios.get(`${baseUrl}/api/v4/projects/${projectId}/milestones`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar milestones." });
  }
});

router.get("/project-metadata", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(teamId, channelId, async (projectId, token, host) => {
      const baseUrl = getBaseUrl(host);
      await axios.get(`${baseUrl}/api/v4/projects/${projectId}`, {
        headers: { "PRIVATE-TOKEN": token }
      });
      return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
    });

    const baseUrl = getBaseUrl(gitlab_host);
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const [assigneesRes, labelsRes, milestonesRes] = await Promise.all([
      axios.get(`${baseUrl}/api/v4/projects/${gitlab_project_id}/users`, { headers, params: { per_page: 100 } }),
      axios.get(`${baseUrl}/api/v4/projects/${gitlab_project_id}/labels`, { headers, params: { per_page: 100 } }),
      axios.get(`${baseUrl}/api/v4/projects/${gitlab_project_id}/milestones`, { headers, params: { per_page: 100 } })
    ]);

    res.json({
      assignees: assigneesRes.data.sort((a,b) => a.name.localeCompare(b.name)),
      labels: labelsRes.data.sort((a,b) => a.name.localeCompare(b.name)),
      milestones: milestonesRes.data.sort((a,b) => a.title.localeCompare(b.title))
    });
  } catch (err) {
    console.error(" Erro ao buscar metadados:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar metadados do projeto." });
  }
});




// Atualizar uma issue existente no GitLab
router.put("/:issueIid", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;
  const { title, description, due_date, assignee_id, labels, milestone_id, state_event } = req.body;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(
      teamId, channelId,
      async (projectId, token, host) => {
        const baseUrl = `https://${host}`;
        await axios.get(`${baseUrl}/api/v4/projects/${projectId}/issues/${issueIid}`, {
          headers: { "PRIVATE-TOKEN": token }
        });
        return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
      }
    );

    const baseUrl = `https://${gitlab_host}`;
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const response = await axios.put(
      `${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues/${issueIid}`,
      {
        title,
        description,
        due_date,
        assignee_id,
        labels,
        milestone_id,
        state_event
      },
      { headers }
    );

    res.json({ message: "Issue atualizada!", data: response.data });

  } catch (err) {
    console.error("Erro ao atualizar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao atualizar a issue." });
  }
});


router.get('/project-name', async (req, res) => {
  const { teamId, channelId } = req.query;

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

    if (!gitlab_project_id || !gitlab_token || !gitlab_host) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const baseUrl = `https://${gitlab_host}`;
    const gitlabRes = await axios.get(`${baseUrl}/api/v4/projects/${gitlab_project_id}`, {
      headers: { 'PRIVATE-TOKEN': gitlab_token }
    });

    const project = gitlabRes.data;

    if (!project.name) {
      return res.status(500).json({ error: 'Nome do projeto não encontrado' });
    }

    res.json({ name: project.name });

  } catch (err) {
    console.error('Erro ao buscar nome do projeto:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


router.get("/:issueIid", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(
      teamId, channelId,
      async (projectId, token, host) => {
        const baseUrl = `https://${host}`;
        await axios.get(`${baseUrl}/api/v4/projects/${projectId}/issues/${issueIid}`, {
          headers: { "PRIVATE-TOKEN": token }
        });
        return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
      }
    );

    const baseUrl = `https://${gitlab_host}`;
    const response = await axios.get(
      `${baseUrl}/api/v4/projects/${gitlab_project_id}/issues/${issueIid}`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(response.data);
  } catch (err) {
    console.error(" Erro ao buscar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar detalhes da issue." });
  }
});


router.get("/:issueIid/related_merge_requests", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const { gitlab_project_id, gitlab_token, gitlab_host } = await tryProjectConfigs(
      teamId, channelId,
      async (projectId, token, host) => {
        const baseUrl = `https://${host}`;
        await axios.get(`${baseUrl}/api/v4/projects/${projectId}/issues/${issueIid}/related_merge_requests`, {
          headers: { "PRIVATE-TOKEN": token }
        });
        return { gitlab_project_id: projectId, gitlab_token: token, gitlab_host: host };
      }
    );

    const baseUrl = `https://${gitlab_host}`;
    const response = await axios.get(
      `${baseUrl}/api/v4/projects/${gitlab_project_id}/issues/${issueIid}/related_merge_requests`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(response.data);

  } catch (err) {
    console.error(" Erro ao buscar related MRs:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar related merge requests." });
  }
});


// Criar uma nova Issue
router.post("/", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { title, description, due_date, assignee_id, milestone_id, labels } = req.body;

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

    const body = {
      title,
      description,
      labels: labels?.join(","),
      assignee_id,
      milestone_id,
      due_date,
    };

    const response = await axios.post(
      `${baseUrl}/api/v4/projects/${gitlab_project_id}/issues`,
      body,
      { headers }
    );

    res.json(response.data);

  } catch (err) {
    console.error(" Erro ao criar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao criar issue." });
  }
});



module.exports = router;
