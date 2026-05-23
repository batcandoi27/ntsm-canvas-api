const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');
const path = require('path');

const inputFile = path.join(__dirname, 'core_logic.js');
const outputFile = path.join(__dirname, 'core_logic_obfuscated.js');

const sourceCode = fs.readFileSync(inputFile, 'utf8');

console.log('Đang obfuscate logic cốt lõi...');

const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    numbersToExpressions: true,
    simplify: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal'
});

fs.writeFileSync(outputFile, obfuscationResult.getObfuscatedCode());

console.log('✅ Obfuscate hoàn tất: ' + outputFile);
