export default async function handler(req, res) {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ success: false, error: { code: 0, type: 'bad_request', info: 'Missing "query" parameter.' } });
    }

    const API_KEY = process.env.WEATHER_KEY;

    if (!API_KEY) {
        return res.status(500).json({ success: false, error: { code: 0, type: 'server_error', info: 'API key not configured on server.' } });
    }

    try {
        const response = await fetch(
            `http://api.weatherstack.com/current?access_key=${API_KEY}&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);
    } catch {
        return res.status(502).json({ success: false, error: { code: 0, type: 'proxy_error', info: 'Failed to reach Weatherstack API.' } });
    }
}
