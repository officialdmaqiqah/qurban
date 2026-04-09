// Use built-in fetch
const config = {
    apiKey: 'raRmjxN5P9CI7O63PKtFifPhZliRDf', // Lowercase 'l'
    sender: '6285335150001',
};

const number = '6281271600122'; 
const message = 'Test from Antigravity AI - Corrected Key';

const url = new URL('https://xsender.id/api/send-message');
url.searchParams.append('api_key', config.apiKey);
url.searchParams.append('sender', config.sender);
url.searchParams.append('number', number);
url.searchParams.append('message', message);

async function test() {
    console.log('Testing with key:', config.apiKey);
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const result = await response.json();
        console.log('Result:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
