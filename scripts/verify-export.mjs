import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(d,e.name)):[resolve(d,e.name)]);
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
const files=walk(root).map(f=>relative(root,f).replaceAll('\\','/')).sort();
if(JSON.stringify(files)!==JSON.stringify([...manifest.files.map(f=>f.path),'manifest.json'].sort()))throw Error('FILE_ALLOWLIST_MISMATCH');
let edges=0;
for(const item of manifest.files){
 const file=resolve(root,item.path),bytes=readFileSync(file),text=bytes.toString('utf8');
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('DIGEST_MISMATCH: '+item.path);
 if(item.path.endsWith('.mjs'))for(const m of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
  if(m[1].startsWith('node:') || m[1]==='cloudflare:workers')continue;
  const target=resolve(dirname(file),m[1]);if(!m[1].startsWith('.')||relative(root,target).startsWith('..')||!existsSync(target))throw Error('IMPORT_OUTSIDE_EXPORT: '+item.path);edges++;
 }
 if(/(?:[CD]:[\\/]|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY)/.test(text))throw Error('PRIVATE_PATH_OR_KEY_MATERIAL: '+item.path);
}
console.log(JSON.stringify({files:files.length,internalImportEdges:edges,manifest:'PASSED',imports:'PASSED',privatePathScan:'PASSED',note:'Pattern scan is not a universal secret detector; export was built from an explicit source allowlist.'}));
