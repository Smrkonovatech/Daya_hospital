const dotenv = require('dotenv');
dotenv.config();

async function inspectExotel() {
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  const defaultAppId = process.env.EXOTEL_DEFAULT_APP_ID || '1393239';
  const callerId = process.env.EXOTEL_CALLER_ID || process.env.EXOTEL_PHONE_NUMBER || '08047291658';

  console.log('=== PART 6: EXOTEL READ-ONLY INSPECTION ===');
  console.log('Account SID:', accountSid ? `${accountSid.substring(0, 4)}...${accountSid.slice(-4)}` : 'NOT_SET');
  console.log('API Key Configured:', !!apiKey);
  console.log('API Token Configured:', !!apiToken);
  console.log('Target Applet ID:', defaultAppId);
  console.log('Target ExoPhone:', callerId);

  const results = {
    accountSidMasked: accountSid ? `${accountSid.substring(0, 4)}...${accountSid.slice(-4)}` : null,
    accountSidRawPrefix: accountSid ? accountSid.substring(0, 8) : null,
    apiKeyConfigured: !!apiKey,
    apiTokenConfigured: !!apiToken,
    defaultAppId,
    targetExoPhone: callerId,
    apiConnectivity: null,
  };

  if (accountSid && apiKey && apiToken) {
    try {
      // Exotel REST API check: query applet details or account details (read-only GET)
      const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      const url = `https://${subdomain}/v1/Accounts/${accountSid}`;
      console.log('Probing Exotel Account API:', url);
      const res = await fetch(url, {
        headers: { Authorization: authHeader },
      });
      console.log('Exotel Account API Status:', res.status);
      const text = await res.text();
      results.apiConnectivity = {
        status: res.status,
        responseSample: text.substring(0, 300),
      };
    } catch (e) {
      console.log('Exotel API error:', e.message);
      results.apiConnectivity = { error: e.message };
    }
  }

  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, 'part6_exotel_results.json'), JSON.stringify(results, null, 2));
  console.log('Part 6 Exotel inspection written to part6_exotel_results.json');
}

inspectExotel();

