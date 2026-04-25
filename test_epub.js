const Epub = require('epubjs').default;
const epub = Epub(new ArrayBuffer(10));
epub.ready.then(() => console.log('ready resolve')).catch(e => console.log('ready reject', e));
