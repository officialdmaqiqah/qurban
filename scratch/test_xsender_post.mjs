const api_key = 'raRmjxN5P9CI7O63PKtFifPhZliRDf';
const sender = '6285335150001';
const number = '6281285341235';
const message = 'Test rocket 🚀 emoji\n\nBaris kedua test\n*Tebal*';

async function test() {
    try {
        const url = new URL('https://xsender.id/api/send-message');
        
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                api_key: api_key,
                sender: sender,
                number: number,
                message: message
            })
        });
        const textResponse = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${textResponse}`);
    } catch (e) {
        console.error(e);
    }
}
test();
