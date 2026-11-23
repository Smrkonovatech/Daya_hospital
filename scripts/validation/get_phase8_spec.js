const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/mohit/.gemini/antigravity/brain/597af489-075f-4759-b030-0169e6dddfc7/.system_generated/logs/transcript_full.jsonl'),
});

let lineCount = 0;
rl.on('line', (line) => {
  lineCount++;
  if (lineCount === 7453) {
    try {
      const parsed = JSON.parse(line);
      const content = parsed.content || '';
      const phase8Idx = content.indexOf('## Phase 8');
      if (phase8Idx !== -1) {
        console.log(content.substring(phase8Idx));
      } else {
        console.log('Phase 8 not found in line 7453. Full content length:', content.length);
      }
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }
    rl.close();
  }
});

