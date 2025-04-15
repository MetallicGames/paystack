const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PAYSTACK_SECRET_KEY = 'sk_test_09cfe71e3817b2d633226f5491691f20eccd57f3';
const port = 3000;

app.use(bodyParser.json());

app.post('/paystack-webhook', (req, res) => {
    const event = req.body;
    
    // Verify the webhook signature
    const signature = req.headers['x-paystack-signature'];
    const payload = JSON.stringify(req.body);
    
    // Verify that the signature matches the Paystack signature
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY);
    hmac.update(payload);
    
    if (hmac.digest('hex') !== signature) {
        return res.status(400).send('Invalid signature');
    }

    // Extract event details
    const transaction = event.data;

    if (transaction.status === 'success') {
        // Handle the successful payment here
        const playerId = transaction.metadata.player_id;
        const productId = transaction.metadata.product_id;

        // You can store this information in your database to track payments
        // or process the reward for the player.

        // Send a success response
        res.status(200).send('Payment verified successfully');
        
        // Trigger a reward to the player in Unity
        // You can implement further logic to notify Unity via a network call
    } else {
        res.status(400).send('Payment not successful');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
