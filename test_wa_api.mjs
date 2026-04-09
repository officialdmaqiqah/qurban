// Use built-in fetch
const config = {
    apiKey: 'raRmjxN5P9CI7O63PKtFifPhZLiRDf',
    sender: '6285335150001',
};

const number = '6281271600122'; // Use a different number to test if possible, or same
const message = 'Test from Antigravity AI - Qurban Project';

const url = new URL('https://xsender.id/api/send-message');
url.searchParams.append('api_key', config.apiKey);
url.searchParams.append('sender', config.sender);
url.searchParams.append('number', number);
url.searchParams.append('message', message);

async function test() {
    console.log('Testing URL:', url.toString());
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const text = await response.text();
        console.log('Raw Response:', text);
        try {
            const result = JSON.parse(text);
            console.log('Result:', result);
        } catch (je) {
            console.log('Response is not JSON');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
