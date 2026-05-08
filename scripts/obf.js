const obf = require('javascript-obfuscator');
const fs = require('fs');

const code = `if(!text)return '';let t=text;t=t.replace(/(\\s+)(\\*\\*|)(A|B|C|D)\\2[\\.\\)]\\s+/g,'\\n\\n$2$3.$2 ');t=t.replace(/(điểm|giác|hình|cạnh|đoạn|tại|đỉnh|qua|đường|tâm|là|tuyến|cung|góc)\\n\\n(\\*\\*|)(A|B|C|D)\\2\\.\\s+/gi,'$1 $2$3.$2 ');t=t.replace(/\\n{3,}/g,'\\n\\n');return t;`;

const result = obf.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  numbersToExpressions: true,
  simplify: true,
  stringArrayShuffle: true,
  splitStrings: true,
  stringArrayThreshold: 1
}).getObfuscatedCode();

fs.writeFileSync('obfuscated.txt', result);
console.log('Obfuscated to obfuscated.txt');
