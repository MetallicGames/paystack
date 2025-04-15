const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;  // Use environment variable
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Root route for confirming the server is up
app.get('/', (req, res) => {
    res.send('Paystack Webhook Server is running!');
});

let rewards = {}; // Temporary in-memory storage

app.post('/paystack-webhook', async (req, res) => {
    const event = req.body;
    console.log('Received Paystack webhook event:', event); // Log the incoming event

    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const metadata = event.data.metadata || {};
        const playerId = metadata.player_id || 'unknown';
        const productId = metadata.product_id || 'unknown';

        console.log(`Charge success for playerId: ${playerId}, productId: ${productId}, reference: ${reference}`);

        try {
            const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            });

            console.log('Payment verification response:', verifyRes.data); // Log verification response

            if (verifyRes.data.data.status === 'success') {
                rewards[playerId] = productId;
                console.log(`Payment verified and reward granted to player ${playerId} for product ${productId}`);
                return res.status(200).send('Payment verified and reward granted');
            } else {
                console.log(`Payment verification failed for reference: ${reference}`);
                return res.status(400).send('Payment verification failed');
            }
        } catch (err) {
            console.error('Error verifying payment:', err); // Log any error during verification
            return res.status(500).send('Error verifying payment');
        }
    } else {
        console.log('Received non-charge.success event:', event.event); // Log if the event is not charge.success
    }

    res.status(200).send('Event received');
});

app.get('/check-reward/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    console.log(`Checking reward for playerId: ${playerId}`);

    if (rewards[playerId]) {
        const productId = rewards[playerId];
        console.log(`Reward found for playerId: ${playerId}, granting productId: ${productId}`);
        delete rewards[playerId];
        return res.json({ success: true, productId });
    }

    res.json({ success: false });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
