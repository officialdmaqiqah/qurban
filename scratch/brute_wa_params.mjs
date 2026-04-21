// No import needed for Node 18+ built-in fetch

const config = {
    apiKey: 'raRmjxN5P9CI7O63PKtFifPhZliRDf',
    sender: '6285335150001',
    testNumber: '6281285341235' // Using a real-looking but random number
};

const variations = [
    { name: 'Standard (sender/number)', params: { api_key: config.apiKey, sender: config.sender, number: config.testNumber, message: 'Test 1' } },
    { name: 'v2 (device/number)', params: { api_key: config.apiKey, device: config.sender, number: config.testNumber, message: 'Test 2' } },
    { name: 'v3 (sender/to)', params: { api_key: config.apiKey, sender: config.sender, to: config.testNumber, message: 'Test 3' } },
    { name: 'v4 (apikey/sender/number)', params: { apikey: config.apiKey, sender: config.sender, number: config.testNumber, message: 'Test 4' } },
    { name: 'v5 (device/to)', params: { api_key: config.apiKey, device: config.sender, to: config.testNumber, message: 'Test 5' } }
];

async function runTests() {
    for (const v of variations) {
        console.log(`Running variation: ${v.name}...`);
        try {
            const response = await fetch('https://xsender.id/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(v.params)
            });
            const text = await response.text();
            console.log(`Response ${v.name}: ${text}`);
        } catch (e) {
            console.log(`Error ${v.name}: ${e.message}`);
        }
        console.log('---');
    }
}

runTests();
