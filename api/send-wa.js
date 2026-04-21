/**
 * Vercel Serverless Function Proxy for WhatsApp Gateway
 * Bypasses CORS and Local Network Restrictions (Fortinet/Office Wifi)
 */
module.exports = async (req, res) => {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Collect params from both GET (query) and POST (body)
        const params = { ...req.query, ...req.body };
        const { api_key, sender, number, message, footer } = params;

        // Validasi parameter wajib
        if (!api_key || !sender || !number || !message) {
            const missing = [];
            if (!api_key) missing.push('api_key');
            if (!sender) missing.push('sender');
            if (!number) missing.push('number');
            if (!message) missing.push('message');
            
            return res.status(400).json({ 
                status: false, 
                message: `Parameter tidak lengkap: ${missing.join(', ')}` 
            });
        }

        console.log(`[Proxy WA] Mengirim ke ${number} via ${sender} (Length: ${message.length})`);

        // Use POST for the outgoing gateway request to avoid URL length issues
        const response = await fetch('https://xsender.id/api/send-message', {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ api_key, sender, number, message, footer })
        });

        const textResponse = await response.text();
        let result;
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            console.error('[Proxy WA] Respons bukan JSON:', textResponse);
            throw new Error(`Gateway mengembalikan respons tidak valid (Bukan JSON): ${textResponse.substring(0, 50)}...`);
        }

        if (!response.ok) {
            throw new Error(`Gateway Error (${response.status}): ${result.message || result.msg || 'Terjadi kesalahan internal pada gateway.'}`);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('[Proxy Error]', error);
        return res.status(500).json({ 
            status: false, 
            message: 'Internal Proxy Error: ' + error.message 
        });
    }
};
