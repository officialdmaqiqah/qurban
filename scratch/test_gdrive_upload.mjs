// Menggunakan fetch global bawaan Node.js

const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

async function testUpload() {
    console.log("Testing GDrive Upload...");
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 white pixel
    try {
        const resp = await fetch(GDRIVE_PROXY_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                base64, 
                mimeType: "image/png", 
                fileName: "test_" + Date.now(), 
                folderName: "BUKTI_KOMISI" 
            })
        });
        const res = await resp.json();
        console.log("Response:", res);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testUpload();
