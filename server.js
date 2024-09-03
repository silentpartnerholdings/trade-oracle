const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

const API_KEY = '0vn0Ey2owPVWT18Ok8Z25vqQPxcf0Eu7A5gjuMqmGxgAR1ICodKaJGDzTTh7HNs8';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/api/historical-data', async (req, res) => {
    const { pair, timeframe, startTime, endTime } = req.query;
    const url = `https://api.binance.us/api/v3/klines?symbol=${pair}&interval=${timeframe}&startTime=${startTime}&endTime=${endTime}&limit=1000`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-MBX-APIKEY': API_KEY
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from Binance.US:', error.message);
        res.status(500).json({ error: 'Failed to fetch data from Binance.US' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});