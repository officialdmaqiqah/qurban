// Use built-in fetch
const config = {
    apiKey: 'raRmjxN5P9CI7O63PKtFifPhZLiRDf',
    sender: '6285335150001',
};

const number = '6281271600122'; 
const message = 'Test POST from Antigravity AI';

async function testPost() {
    console.log('Testing POST...');
    try {
        const response = await fetch('https://xsender.id/api/send-message', {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: config.apiKey,
                sender: config.sender,
                number: number,
                message: message
            })
        });
        const text = await response.text();
        console.log('Raw Response:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

testPost();
