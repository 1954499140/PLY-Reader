import{build}from'esbuild';import{readFile,writeFile,mkdir}from'node:fs/promises';
const worker=await build({entryPoints:['src/parse.worker.ts'],bundle:true,minify:true,format:'iife',target:'chrome110',write:false});
const main=await build({entryPoints:['src/main.ts'],bundle:true,minify:true,format:'iife',target:'chrome110',write:false,define:{__PLY_WORKER__:JSON.stringify(worker.outputFiles[0].text)}});
const style=await readFile('src/style.css','utf8'),template=await readFile('src/index.html','utf8');
const html=template.replace('__STYLE__',()=>style).replace('__SCRIPT__',()=>main.outputFiles[0].text.replaceAll('</script','<\\/script'));
await mkdir('web',{recursive:true});await writeFile('web/index.html',html);console.log(`Built offline interface: ${Buffer.byteLength(html)} bytes`);if(Buffer.byteLength(html)>1950000)throw Error('WebView2 HTML size limit exceeded');
