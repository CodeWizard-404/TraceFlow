const express = require('express');
const { sendGenericSMS, sendCustomSMS } = require('../services/smsService');
const router = express.Router();

router.post('/send-generic', async (req, res) => {
    try {
        const { destNum, msg, label, ref } = req.body;
        const result = await sendGenericSMS(destNum, msg, label, ref);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/send-custom', async (req, res) => {
    try {
        const { custMsg, label, ref } = req.body;
        const result = await sendCustomSMS(custMsg, label, ref);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;