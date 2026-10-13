import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const launcher=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const root=path.dirname(launcher)
const rustMeta=process.argv[2]
if(!rustMeta)throw new Error('Pass the path to cargo metadata JSON (cargo metadata --format-version 1).')
const notices=[],missing=[],seen=new Set()
const licenseName=/^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i
function collect(name,version,dir,declared){
 const parts=[]
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.isFile()&&licenseName.test(entry.name))parts.push('FILE: '+entry.name+'\n'+fs.readFileSync(path.join(dir,entry.name),'utf8'))
 }
 if(!parts.length) {
  const extra=path.join(launcher,'license-notices',name.replaceAll('/','_')+'.txt')
  if(fs.existsSync(extra))parts.push(fs.readFileSync(extra,'utf8'))
 }
 if(!parts.length)missing.push({name,version,declared})
 notices.push('='.repeat(72)+'\n'+name+' '+version+'\nDeclared license: '+(declared||'see package source')+'\n\n'+(parts.join('\n\n')||'No standalone license notice was found in this package; see the upstream source and metadata.')+'\n')
}
function npmModules(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const d=path.join(dir,e.name);if(e.name.startsWith('@')){npmModules(d);continue}let real;try{real=fs.realpathSync(d)}catch{continue}if(seen.has(real)||!fs.existsSync(path.join(real,'package.json')))continue;seen.add(real);const pkg=JSON.parse(fs.readFileSync(path.join(real,'package.json'),'utf8'));collect(pkg.name,pkg.version,real,typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license));npmModules(path.join(real,'node_modules'))}}
npmModules(path.join(launcher,'node_modules'))
const metadata=JSON.parse(fs.readFileSync(rustMeta,'utf8').replace(/^\uFEFF/,''))
for(const p of metadata.packages){if(p.source)collect(p.name,p.version,path.dirname(p.manifest_path),(p.license||'see source')+'; source: https://crates.io/api/v1/crates/'+p.name+'/'+p.version+'/download')}
const header='COPPER LAUNCHER — THIRD-PARTY COPYRIGHT AND LICENSE NOTICES\nGenerated from the installed JavaScript packages and Windows Cargo metadata.\nIncludes build-time packages as well as runtime dependencies. Package-specific\nlicense choices remain subject to their original terms. This collection is not\na certification of license compatibility. Font notices are in OFL.txt.\n\n'
const text=header+notices.join('\n')
fs.writeFileSync(path.join(launcher,'THIRD-PARTY-LICENSES.txt'),text)
fs.writeFileSync(path.join(root,'THIRD-PARTY-LICENSES.txt'),text)
fs.mkdirSync(path.join(launcher,'public/licenses'),{recursive:true})
fs.writeFileSync(path.join(launcher,'public/licenses/third-party.txt'),text)
console.log(JSON.stringify({packages:notices.length,bytes:Buffer.byteLength(text),missingStandaloneNotices:missing}))
