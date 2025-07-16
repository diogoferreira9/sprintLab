const express = require("express");
const router = express.Router();

// Endpoint para verificar o role
router.post("/verify-role", async (req, res) => {
    try {
      const { userPrincipalName } = req.body;
  
      console.log("[Teams] Requisição recebida para verificar role:", userPrincipalName); // log da entrada
  
      if (!userPrincipalName) {
        console.warn("[Teams] Erro: userPrincipalName não fornecido.");
        return res.status(400).json({ error: "Missing userPrincipalName" });
      }
  
      const normalizedUser = userPrincipalName.toLowerCase();
      const isOwner = owners.includes(normalizedUser);
      const role = isOwner ? "owner" : "member";
  
      console.log(`[Teams] Utilizador ${userPrincipalName} é ${role}.`); // log do resultado
  
      return res.json({ role });
    } catch (err) {
      console.error("[Teams] Erro interno ao verificar role:", err);
      res.status(500).json({ error: "Erro interno ao verificar role" });
    }
});

module.exports = router;
