const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('index.ts', 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'jsx', 'optionalChaining', 'nullishCoalescingOperator'] });
  console.warn('parse ok');
} catch (err) {
  console.error('parse error', err.loc, err.message);
}
