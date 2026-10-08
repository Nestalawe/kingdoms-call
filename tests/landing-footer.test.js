// Landing page footer: site/index.html's footer reads the agreed wording. Nothing is run.
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const {SITE}=require('./lib/boot');

const EXPECTED='Kingdoms Call · A Strategy Game of Simultaneous Turns';
const doc=new JSDOM(fs.readFileSync(path.join(SITE,'index.html'),'utf8')).window.document;
const foot=doc.querySelector('footer');
const got=foot?foot.textContent.trim():'(no footer)';
if(got!==EXPECTED){
  console.log(`FAIL index.html footer is "${got}", expected "${EXPECTED}"`);
  process.exit(1);
}
console.log(`index.html footer: "${got}"`);
