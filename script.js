const INITIAL_BALANCE = 100000;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('trade-form');
    form.addEventListener('submit', handleSubmit);
});

async function handleSubmit(event) {
    event.preventDefault();
    const pair = document.getElementById('pair').value.toUpperCase();
    const timeframe = document.getElementById('timeframe').value;
    const startDate = document.getElementById('start-date').value;
    const startTime = document.getElementById('start-time').value;
    const endDate = document.getElementById('end-date').value;
    const endTime = document.getElementById('end-time').value;

    const startTimestamp = new Date(`${startDate}T${startTime}:00Z`).getTime();
    const endTimestamp = new Date(`${endDate}T${endTime}:00Z`).getTime();

    try {
        const startTime = performance.now();
        const historicalData = await fetchHistoricalData(pair, timeframe, startTimestamp, endTimestamp);
        const { optimalTrades, entriesAndExitsTested, combinationsTested } = findOptimalTrades(historicalData);
        const buyHoldInfo = calculateBuyHoldProfit(historicalData);
        const endTime = performance.now();
        const analysisTime = (endTime - startTime) / 1000; // Convert to seconds

        displayResults(optimalTrades, buyHoldInfo, entriesAndExitsTested, combinationsTested, analysisTime);
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please check the console for details.');
    }
}

async function fetchHistoricalData(pair, timeframe, startTime, endTime) {
    const url = `https://api.binance.us/api/v3/klines?symbol=${pair}&interval=${timeframe}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.map(candle => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
    }));
}

function findOptimalTrades(data) {
    const n = data.length;
    const entriesAndExitsTested = n * (n - 1);
    const combinationsTested = (n * (n - 1)) / 2;

    // Initialize dynamic programming arrays
    const dp = new Array(n).fill(0);
    const trades = new Array(n).fill(null);

    for (let i = 1; i < n; i++) {
        // Check if not trading is better than the previous best
        if (dp[i-1] > dp[i]) {
            dp[i] = dp[i-1];
            trades[i] = trades[i-1];
        }

        for (let j = 0; j < i; j++) {
            const buyPrice = data[j].close;
            const sellPrice = data[i].close;
            const profit = (sellPrice - buyPrice) / buyPrice * INITIAL_BALANCE;

            // Only consider profitable trades
            if (profit > 0) {
                const potentialProfit = dp[j] + profit;
                if (potentialProfit > dp[i]) {
                    dp[i] = potentialProfit;
                    trades[i] = trades[j] ? [...trades[j], { entry: j, exit: i }] : [{ entry: j, exit: i }];
                }
            }
        }
    }

    // Get the optimal trades from the last element of the trades array
    const optimalTrades = trades[n - 1] || [];

    // Convert trade indices to actual trade objects
    const formattedTrades = optimalTrades.flatMap(trade => [
        {
            action: 'BUY',
            timestamp: new Date(data[trade.entry].timestamp).toISOString(),
            price: data[trade.entry].close
        },
        {
            action: 'SELL',
            timestamp: new Date(data[trade.exit].timestamp).toISOString(),
            price: data[trade.exit].close
        }
    ]);

    return { optimalTrades: formattedTrades, entriesAndExitsTested, combinationsTested };
}

function calculateBuyHoldProfit(data) {
    const startData = data[0];
    const endData = data[data.length - 1];
    const profit = (endData.close - startData.close) / startData.close * INITIAL_BALANCE;
    const profitPercentage = (profit / INITIAL_BALANCE) * 100;

    return {
        startDate: new Date(startData.timestamp).toISOString(),
        endDate: new Date(endData.timestamp).toISOString(),
        startPrice: startData.close,
        endPrice: endData.close,
        profit: profit,
        profitPercentage: profitPercentage
    };
}

function displayResults(optimalTrades, buyHoldInfo, entriesAndExitsTested, combinationsTested, analysisTime) {
    const resultsDiv = document.getElementById('results');
    const optimalTradesDiv = document.getElementById('optimal-trades');
    const buyHoldDiv = document.getElementById('buy-hold');
    const statsDiv = document.getElementById('analysis-stats');

    resultsDiv.classList.remove('hidden');

    if (optimalTrades.length > 0) {
        let totalProfit = 0;
        let tradesHtml = '<h3>Optimal Trades</h3>';

        for (let i = 0; i < optimalTrades.length; i += 2) {
            const buyTrade = optimalTrades[i];
            const sellTrade = optimalTrades[i + 1];
            const profit = (sellTrade.price - buyTrade.price) / buyTrade.price * INITIAL_BALANCE;
            totalProfit += profit;

            tradesHtml += `
                <div class="trade">
                    <p>Buy: ${buyTrade.timestamp} at $${buyTrade.price.toFixed(2)}</p>
                    <p>Sell: ${sellTrade.timestamp} at $${sellTrade.price.toFixed(2)}</p>
                    <p>Profit: $${profit.toFixed(2)}</p>
                </div>
            `;
        }

        const totalProfitPercentage = (totalProfit / INITIAL_BALANCE) * 100;
        tradesHtml += `<p>Total Profit: $${totalProfit.toFixed(2)} (${totalProfitPercentage.toFixed(2)}%)</p>`;

        optimalTradesDiv.innerHTML = tradesHtml;
    } else {
        optimalTradesDiv.innerHTML = '<p>No profitable trades found.</p>';
    }

    buyHoldDiv.innerHTML = `
        <h3>Buy and Hold</h3>
        <p>Start Date: ${buyHoldInfo.startDate}</p>
        <p>End Date: ${buyHoldInfo.endDate}</p>
        <p>Start Price: $${buyHoldInfo.startPrice.toFixed(2)}</p>
        <p>End Price: $${buyHoldInfo.endPrice.toFixed(2)}</p>
        <p>Profit: $${buyHoldInfo.profit.toFixed(2)} (${buyHoldInfo.profitPercentage.toFixed(2)}%)</p>
    `;

    statsDiv.innerHTML = `
        <h3>Analysis Statistics</h3>
        <p>Entries and Exits Tested: ${entriesAndExitsTested.toLocaleString()}</p>
        <p>Trade Combinations Tested: ${combinationsTested.toLocaleString()}</p>
        <p>Time to Complete Analysis: ${analysisTime.toFixed(2)} seconds</p>
    `;
}