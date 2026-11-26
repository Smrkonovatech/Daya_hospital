const https = require('https');
const fs = require('fs');
const path = require('path');

let key = '';
try {
  const env = fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8');
  for (const l of env.split('\n')) {
    if (l.trim().startsWith('SARVAM_VOICE_AGENT_API_KEY=')) {
      key = l.trim().substring('SARVAM_VOICE_AGENT_API_KEY='.length).replace(/^["']|["']$/g, '').trim();
    }
  }
} catch (e) {
  console.error('Error reading env:', e.message);
}

const org = '01a06777-00d4-7317-835c-507054052514';
const ws = '01a06777-00da-7f77-abe3-dc1fc871a5ab';
const connId = '587ab0c5-8f-f564346c-f2ae';

function req(fullUrl) {
  return new Promise((resolve) => {
    const parsed = new URL(fullUrl);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
      },
    };
    const r = https.request(options, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    r.on('error', (err) => resolve({ status: 500, error: err.message }));
    r.end();
  });
}

async function main() {
  const testEndpoints = [
    `https://apps.sarvam.ai/api/app-authoring/v1/orgs/${org}/workspaces/${ws}/connections`,
    `https://apps.sarvam.ai/api/app-authoring/v1/orgs/${org}/workspaces/${ws}/connections/${connId}`,
    `https://apps.sarvam.ai/api/app-authoring/v1/orgs/${org}/connections`,
    `https://apps.sarvam.ai/api/app-authoring/v1/connections`,
    `https://apps.sarvam.ai/api/telephony/v1/orgs/${org}/workspaces/${ws}/connections`,
    `https://apps.sarvam.ai/api/telephony/v1/connections`,
  ];

  for (const url of testEndpoints) {
    console.log(`Checking: ${url}`);
    const res = await req(url);
    console.log(`Status: ${res.status}`);
    if (res.status === 200) {
      console.log(JSON.stringify(res.data, null, 2));
    } else if (typeof res.data === 'object') {
      console.log(JSON.stringify(res.data));
    }
    console.log('--------------------------------------------------');
  }
}

main().catch(console.error);
