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

        if (!api_key || !sender || !number || !message) {
            return res.status(400).json({ 
                status: false, 
                message: 'Missing required parameters: api_key, sender, number, or message.' 
            });
        }

        // Use global fetch (built-in in Node 18+)
        const targetUrl = new URL('https://xsender.id/api/send-message');
        targetUrl.searchParams.append('api_key', api_key);
        targetUrl.searchParams.append('sender', sender);
        targetUrl.searchParams.append('number', number);
        targetUrl.searchParams.append('message', message);
        if (footer) targetUrl.searchParams.append('footer', footer);

        console.log(`[Proxy] Sending message to ${number} via ${sender}`);

        const response = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Gateway returned HTTP ${response.status}`);
        }

        const result = await response.json();
        return res.status(200).json(result);

    } catch (error) {
        console.error('[Proxy Error]', error);
        return res.status(500).json({ 
            status: false, 
            message: 'Internal Proxy Error: ' + error.message 
        });
    }
};
