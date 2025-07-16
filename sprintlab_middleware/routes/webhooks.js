const express = require("express");
const router = express.Router();

router.post("/gitlab", async (req, res) => {
    const event = req.body;
    console.log("🔔 Webhook do GitLab recebido:", event);

    res.status(200).json({ message: "Webhook processado!" });
});

module.exports = router;
