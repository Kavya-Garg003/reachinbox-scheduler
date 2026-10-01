// Generates leads-1000.csv (override count: node scripts/gen-leads.js 300) for the load / rate-limit demo.
const fs = require('fs');
const n = parseInt(process.argv[2], 10) || 1000;
const rows = ['email,name'];
for (let i = 1; i <= n; i++) rows.push(`lead${String(i).padStart(4, '0')}@example.com,Lead ${i}`);
fs.writeFileSync('leads-1000.csv', rows.join('\n') + '\n');
console.log(`Wrote leads-1000.csv with ${n} addresses`);
