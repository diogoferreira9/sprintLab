const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const webhooks = require("./routes/webhooks");
const axios = require("axios");
const gitlabDashboardRoutes = require("./routes/gitlab_dashboard");

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use("/tabs", express.static(path.join(__dirname, "tabs")));
app.get("/tabs/config", (req, res) => {
  res.sendFile(path.join(__dirname, "tabs", "config.html"));
});

app.use("/webhooks", webhooks);
app.use("/gitlab-dashboards", gitlabDashboardRoutes);
const teamsRoutes = require("./routes/teams");
app.use("/teams", teamsRoutes);
const gitlabRoutes = require("./routes/gitlab");
app.use("/gitlab-issues", gitlabRoutes);

// Guardar configuração
app.post("/configure-project", async (req, res) => {
  const { teamId, channelId, host, projectId, token } = req.body;
  console.log("📥 Dados recebidos:", req.body);

  if (!teamId || !channelId || !host || !projectId || !token) {
    return res.status(400).json({ message: "Todos os campos são obrigatórios." });
  }

  try {
    const baseUrl = `https://${host}`;
    const url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues`;

    // Validação do token
    try {
      const gitlabResponse = await axios.get(url, {
        headers: { "PRIVATE-TOKEN": token }
      });

      if (gitlabResponse.status !== 200) {
        return res.status(403).json({ message: "Token inserted does not have access to the GitLab project" });
      }
    } catch (validationError) {
      const status = validationError.response?.status;
      const message = validationError.response?.data?.message || validationError.message;

      console.error("Erro GitLab:", status, message);
      return res.status(403).json({ message: "Token inserted does not have access to the GitLab project" });
    }

    // Verificar duplicados
    const existing = await pool.query(
      `SELECT * FROM projects_config 
       WHERE teams_team_id = $1 AND teams_channel_id = $2 AND gitlab_project_id = $3 AND gitlab_token = $4 AND gitlab_host = $5`,
      [teamId, channelId, projectId, token, host]
    );

    if (existing.rowCount > 0) {
      console.log("ℹJá existe esta configuração exata — não será duplicada.");
      return res.status(200).json({ message: "Connection has been established with success!" });
    }

    // Inserir nova configuração
    await pool.query(
      `INSERT INTO projects_config (
         teams_team_id, teams_channel_id, gitlab_host, gitlab_project_id, gitlab_token
       ) VALUES ($1, $2, $3, $4, $5)`,
      [teamId, channelId, host, projectId, token]
    );

    res.status(200).json({ message: "New configuration saved with success!" });

  } catch (err) {
    console.error("ERRO DETALHADO:", err.message);
    res.status(500).json({ message: "Erro interno ao guardar a configuração." });
  }
});

// Endpoint auxiliar para buscar boards do GitLab (sem rota dedicada)
app.get("/gitlab-boards", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Parâmetros teamId e channelId são obrigatórios." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token, gitlab_host FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2
       ORDER BY updated_at DESC`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Projeto não configurado para este canal." });
    }

    const { gitlab_project_id, gitlab_token, gitlab_host } = result.rows[0];
    const baseUrl = `https://${gitlab_host}`;

    const response = await axios.get(
      `${baseUrl}/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/boards`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(response.data);

  } catch (err) {
    console.error("Erro ao obter boards:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao obter boards do GitLab." });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`Servidor online na porta ${PORT}`);
});
