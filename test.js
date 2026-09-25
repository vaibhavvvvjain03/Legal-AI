const fs = require('fs');
const key = fs.readFileSync('.env.local', 'utf8').split('=')[1].trim().replace(/\"/g, '');
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + key, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'hello' }] }] })
}).then(res => res.json()).then(console.log).catch(console.error);
