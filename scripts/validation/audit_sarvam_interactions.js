const https = require('https');
const fs = require('fs');
const path = require('path');

let voiceAgentKey = process.env.SARVAM_VOICE_AGENT_API_KEY || '';

try {
  const envPath = path.resolve(__dirname, '../../.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SARVAM_VOICE_AGENT_API_KEY=')) {
        const val = trimmed.substring('SARVAM_VOICE_AGENT_API_KEY='.length).replace(/^["']|["']$/g, '').trim();
        if (val) voiceAgentKey = val;
      }
    }
  }
} catch (e) {
  console.error('Error reading .env.local:', e.message);
}

const orgId = '01a06777-00d4-7317-835c-507054052514';
const wsId = '01a06777-00da-7f77-abe3-dc1fc871a5ab';
const appId = 'smrkomed-8401f738-b749';

async function makeRequest(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'X-API-Key': voiceAgentKey,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

async function run() {
  const url = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${wsId}/${appId}/interactions?start_datetime=2026-11-20T00:00:00Z&end_datetime=2026-11-25T00:00:00Z&limit=20`;
  console.log(`GET ${url}`);
  const res = await makeRequest(url);

  if (res.status !== 200) {
    console.error('Error querying interactions:', res.status, res.data);
    return;
  }

  const items = res.data.items || [];
  console.log(`Total live interactions found on Sarvam: ${items.length}\n`);

  items.forEach((item, idx) => {
    console.log(`============================================================`);
    console.log(`INTERACTION #${idx + 1}: ${item.interaction_id}`);
    console.log(`Timestamp: ${item.start_datetime} -> ${item.end_datetime} (${item.duration_in_seconds}s)`);
    console.log(`Caller: ${item.user_contact_masked} | Bot: ${item.bot_contact_identifier} (Carrier: ${item.channel_provider})`);
    console.log(`Language: ${item.language_name} | Messages: ${item.num_messages}`);
    console.log(`Agent Latency: ${item.average_agent_response_time_in_seconds}s | User Latency: ${item.average_user_response_time_in_seconds}s`);
    console.log(`App Version: ${item.app_version} | Deployment: ${item.deployment_id}`);
    console.log(`Agent Summary: ${item.agent_variables?.call_summary || 'N/A'}`);
    console.log(`User Name: ${item.agent_variables?.user_name || 'N/A'}`);
    console.log(`Audio Recording: ${item.audio_url ? 'YES' : 'NO'}`);
  });
}

run().catch(console.error);

