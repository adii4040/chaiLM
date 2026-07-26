// check-chunk-exists.js
import 'dotenv/config';

const checkRange = async (minSeconds, maxSeconds) => {
    const response = await fetch('http://localhost:6333/collections/workspace-docs/points/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filter: {
                must: [
                    { key: 'metadata.sessionId', match: { value: 'session_demo_1' } },
                    { key: 'metadata.startSeconds', range: { gte: minSeconds, lte: maxSeconds } }
                ]
            },
            limit: 10,
            with_payload: true
        })
    });
    const data = await response.json();
    data.result.points.forEach(p => {
        console.log(`[${p.payload.metadata.startSeconds}s]`, p.payload.content.slice(0, 100));
    });
};

await checkRange(490, 520);  // check for the ~500s chunk
await checkRange(1050, 1070); // check for the ~1060s chunk