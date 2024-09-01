const axios = require('axios');

exports.handler = async function(event, context) {
  const { symbol, interval, startTime, endTime, limit } = event.queryStringParameters;
  
  const url = `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;

  try {
    const response = await axios.get(url);
    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return {
      statusCode: error.response ? error.response.status : 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};