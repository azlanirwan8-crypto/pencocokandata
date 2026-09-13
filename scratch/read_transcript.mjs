import fs from 'fs';
import readline from 'readline';

const file = 'C:\\Users\\azlan\\.gemini\\antigravity-ide\\brain\\e45a81e4-ba21-4a64-9f8e-45268d334456\\.system_generated\\logs\\transcript.jsonl';
const rl = readline.createInterface({ input: fs.createReadStream(file) });

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.step_index >= 505 && obj.step_index <= 558) {
      if (obj.type === 'USER_INPUT') {
        console.log(`[STEP ${obj.step_index} USER]:\n`, obj.content);
      } else if (obj.type === 'PLANNER_RESPONSE') {
        if (obj.content) console.log(`[STEP ${obj.step_index} MODEL]:\n`, obj.content);
        if (obj.tool_calls) console.log(`[STEP ${obj.step_index} TOOLS]:`, JSON.stringify(obj.tool_calls));
      }
    }
  } catch (e) {}
});
