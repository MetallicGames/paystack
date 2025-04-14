// index.js (no crypto signature verification)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_09cfe71e3817b2d633226f5491691f20eccd57f3';
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

let rewards = {}; // Temporary in-memory storage

app.post('/paystack-webhook', async (req, res) => {
    const event = req.body;

    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const metadata = event.data.metadata || {};
        const playerId = metadata.player_id || 'unknown';
        const productId = metadata.product_id || 'unknown';

        try {
            const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            });

            if (verifyRes.data.data.status === 'success') {
                rewards[playerId] = productId;
                return res.status(200).send('Payment verified and reward granted');
            } else {
                return res.status(400).send('Payment verification failed');
            }
        } catch (err) {
            return res.status(500).send('Error verifying payment');
        }
    }

    res.status(200).send('Event received');
});

app.get('/check-reward/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    if (rewards[playerId]) {
        const productId = rewards[playerId];
        delete rewards[playerId];
        return res.json({ success: true, productId });
    }
    res.json({ success: false });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
