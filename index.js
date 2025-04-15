const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const url = require('url');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected WebSocket clients
const clients = {};

wss.on('connection', ws => {
    console.log('Client connected to WebSocket');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'register' && data.playerId) {
                clients[data.playerId] = ws;
                console.log(`WebSocket registered playerId: ${data.playerId}`);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        for (const playerId in clients) {
            if (clients[playerId] === ws) {
                delete clients[playerId];
                console.log(`WebSocket disconnected playerId: ${playerId}`);
                break;
            }
        }
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

app.get('/', (req, res) => {
    res.send('Paystack Webhook and WebSocket Server is running!');
});

let rewards = {};

app.post('/paystack-webhook', async (req, res) => {
    const event = req.body;
    console.log('Received Paystack webhook event:', event);

    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const metadata = event.data.metadata || {};
        let playerId = 'unknown';
        let productId = 'unknown';

        if (metadata.referrer) {
            try {
                const parsedUrl = url.parse(metadata.referrer, true);
                playerId = parsedUrl.query.player_id || 'unknown';
                productId = parsedUrl.query.product_id || 'unknown';
            } catch (error) {
                console.error('Error parsing referrer URL:', error);
            }
        }

        console.log(`Charge success for playerId: ${playerId}, productId: ${productId}, reference: ${reference}`);

        try {
            const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            });

            if (verifyRes.data.data.status === 'success') {
                console.log(`Payment verified for playerId: ${playerId}`);

                if (clients[playerId] && clients[playerId].readyState === WebSocket.OPEN) {
                    clients[playerId].send(JSON.stringify({ type: 'payment_success', productId: productId }));
                    console.log(`WebSocket message sent to playerId: ${playerId}`);
                } else {
                    console.log(`WebSocket not open for playerId: ${playerId}`);
                    rewards[playerId] = productId;
                }

                return res.status(200).send('Payment verified and notification sent (if client connected)');
            } else {
                console.log(`Payment verification failed for reference: ${reference}`);
                return res.status(400).send('Payment verification failed');
            }
        } catch (err) {
            console.error('Error verifying payment:', err);
            return res.status(500).send('Error verifying payment');
        }
    }

    res.status(200).send('Event received');
});

app.get('/check-reward/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    console.log(`Checking reward for playerId: ${playerId}`);
    if (rewards[playerId]) {
        const productId = rewards[playerId];
        delete rewards[playerId];
        return res.json({ success: true, productId });
    }
    return res.json({ success: false });
});

// Start HTTP and WebSocket on the same port
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
