import fs from 'fs';

const file = fs.readFileSync('src/utils/geoCoder.ts', 'utf8');

const postalMatches = file.match(/['"]\d{5}['"]\s*:/g) || [];
console.log('Total 5-digit postal codes in geoCoder.ts:', postalMatches.length);

const p3Matches = file.match(/['"]\d{3}['"]\s*:/g) || [];
console.log('Total 3-digit postal codes in geoCoder.ts:', p3Matches.length);

const p2Matches = file.match(/['"]\d{2}['"]\s*:/g) || [];
console.log('Total 2-digit postal codes in geoCoder.ts:', p2Matches.length);
