const INITIAL_BALANCE = 100000;
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

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
        let results;
        if (timeframe) {
            const historicalData = await fetchHistoricalData(pair, timeframe, startTimestamp, endTimestamp);
            results = analyzeTimeframe(historicalData, timeframe);
        } else {
            results = await analyzeAllTimeframes(pair, startTimestamp, endTimestamp);
        }
        const endTime = performance.now();
        const analysisTime = (endTime - startTime) / 1000; // Convert to seconds

        displayResults(results, analysisTime, timeframe);
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

async function analyzeAllTimeframes(pair, startTimestamp, endTimestamp) {
    let bestResult = null;
    for (const timeframe of TIMEFRAMES) {
        const historicalData = await fetchHistoricalData(pair, timeframe, startTimestamp, endTimestamp);
        const result = analyzeTimeframe(historicalData, timeframe);
        if (!bestResult || result.totalProfit > bestResult.totalProfit) {
            bestResult = result;
        }
    }
    return bestResult;
}

function analyzeTimeframe(data, timeframe) {
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
    const formattedTrades = optimalTrades.map(trade => ({
        buy: {
            timestamp: new Date(data[trade.entry].timestamp).toISOString(),
            price: data[trade.entry].close
        },
        sell: {
            timestamp: new Date(data[trade.exit].timestamp).toISOString(),
            price: data[trade.exit].close
        },
        profit: (data[trade.exit].close - data[trade.entry].close) / data[trade.entry].close * INITIAL_BALANCE,
        profitPercentage: ((data[trade.exit].close - data[trade.entry].close) / data[trade.entry].close) * 100
    }));

    const totalProfit = formattedTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const averageProfitPercentage = formattedTrades.reduce((sum, trade) => sum + trade.profitPercentage, 0) / formattedTrades.length;
    const bestTrade = formattedTrades.reduce((best, trade) => trade.profitPercentage > best.profitPercentage ? trade : best, formattedTrades[0]);

    const buyHoldInfo = calculateBuyHoldProfit(data);

    return {
        timeframe,
        optimalTrades: formattedTrades,
        totalProfit,
        averageProfitPercentage,
        bestTrade,
        buyHoldInfo,
        entriesAndExitsTested,
        combinationsTested
    };
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

function displayResults(results, analysisTime, specifiedTimeframe) {
    const resultsDiv = document.getElementById('results');
    const winningTimeframeDiv = document.getElementById('winning-timeframe');
    const optimalTradesDiv = document.getElementById('optimal-trades');
    const buyHoldDiv = document.getElementById('buy-hold');
    const statsDiv = document.getElementById('analysis-stats');

    resultsDiv.classList.remove('hidden');

    // Display Winning Timeframe
    winningTimeframeDiv.innerHTML = `
        <h3>Winning Timeframe</h3>
        <p>${specifiedTimeframe ? 'Timeframe Selected' : results.timeframe}</p>
    `;

    // Display Optimal Trades Summary
    if (results.optimalTrades.length > 0) {
        let tradesHtml = `
            <h3>Optimal Trades Summary</h3>
            <p>Number of Trades: ${results.optimalTrades.length}</p>
            <p>Total Profit: $${results.totalProfit.toFixed(2)} (${(results.totalProfit / INITIAL_BALANCE * 100).toFixed(2)}%)</p>
            <p>Average Trade Profit: ${results.averageProfitPercentage.toFixed(2)}%</p>
            <p>Best Individual Trade:</p>
            <ul>
                <li>Buy: ${results.bestTrade.buy.timestamp} at $${results.bestTrade.buy.price.toFixed(2)}</li>
                <li>Sell: ${results.bestTrade.sell.timestamp} at $${results.bestTrade.sell.price.toFixed(2)}</li>
                <li>Profit: $${results.bestTrade.profit.toFixed(2)} (${results.bestTrade.profitPercentage.toFixed(2)}%)</li>
            </ul>
            <h4>All Trades:</h4>
        `;

        results.optimalTrades.forEach((trade, index) => {
            tradesHtml += `
                <div class="trade">
                    <p>Trade ${index + 1}:</p>
                    <p>Buy: ${trade.buy.timestamp} at $${trade.buy.price.toFixed(2)}</p>
                    <p>Sell: ${trade.sell.timestamp} at $${trade.sell.price.toFixed(2)}</p>
                    <p>Profit: $${trade.profit.toFixed(2)} (${trade.profitPercentage.toFixed(2)}%)</p>
                </div>
            `;
        });

        optimalTradesDiv.innerHTML = tradesHtml;
    } else {
        optimalTradesDiv.innerHTML = '<p>No profitable trades found.</p>';
    }

    // Display Buy and Hold Info
    buyHoldDiv.innerHTML = `
        <h3>Buy and Hold</h3>
        <p>Start Date: ${results.buyHoldInfo.startDate}</p>
        <p>End Date: ${results.buyHoldInfo.endDate}</p>
        <p>Start Price: $${results.buyHoldInfo.startPrice.toFixed(2)}</p>
        <p>End Price: $${results.buyHoldInfo.endPrice.toFixed(2)}</p>
        <p>Profit: $${results.buyHoldInfo.profit.toFixed(2)} (${results.buyHoldInfo.profitPercentage.toFixed(2)}%)</p>
    `;

    // Display Analysis Statistics
    statsDiv.innerHTML = `
        <h3>Analysis Statistics</h3>
        <p>Entries and Exits Tested: ${results.entriesAndExitsTested.toLocaleString()}</p>
        <p>Trade Combinations Tested: ${results.combinationsTested.toLocaleString()}</p>
        <p>Time to Complete Analysis: ${analysisTime.toFixed(2)} seconds</p>
    `;
}