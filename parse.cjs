const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/app.js', 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'jsx', 'optionalChaining', 'nullishCoalescingOperator'] });
  console.log('parse ok');
} catch (err) {
  console.error('parse error', err.loc, err.message);
}
