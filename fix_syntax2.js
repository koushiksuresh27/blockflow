const fs = require('fs');
let code = fs.readFileSync('workflow-server.js', 'utf8');
const before = (code.match(/supabaseAdmin'/g) || []).length;
code = code.replace(/supabaseAdmin'/g, "supabaseAdmin.from('");
const after = (code.match(/supabaseAdmin'/g) || []).length;
fs.writeFileSync('workflow-server.js', code, 'utf8');
console.log('Replaced occurrences. Before: ' + before + ', After: ' + after);
