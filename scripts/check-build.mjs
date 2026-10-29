import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const required=['public/index.html','public/styles.css','public/app.js','public/core.mjs','public/favicon.svg','public/admin-ui.mjs','server/database.mjs','server/schema.mjs','server/store.mjs','netlify/functions/admin.mjs','netlify/functions/history.mjs','server/provider.mjs','server/handlers.mjs','netlify/functions/confirmation.mjs','netlify/functions/session.mjs','netlify/functions/status.mjs','netlify.toml'];
for(const name of required)assert.ok((await readFile(name)).length>0,`Falta ${name}`);
for(const name of ['public/app.js','public/core.mjs','public/admin-ui.mjs','server/database.mjs','server/schema.mjs','server/store.mjs','netlify/functions/admin.mjs','netlify/functions/history.mjs','server/provider.mjs','server/handlers.mjs','netlify/functions/confirmation.mjs','netlify/functions/session.mjs','netlify/functions/status.mjs']){
 const result=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
}
for(const name of await readdir('public')){
 const content=await readFile(`public/${name}`,'utf8');
 assert.ok(!/getcid|visualsupport|portal microsoft/i.test(content),`Referencia no permitida en ${name}`);
 assert.ok(!/ACTIVATION_API_TOKEN|NOVA_ACCESS_CODE/.test(content),`Configuración interna expuesta en ${name}`);
}
const config=await readFile('netlify.toml','utf8');assert.ok(config.includes('publish = "public"'));assert.ok(config.includes('functions = "netlify/functions"'));
console.log('Preparación completa: interfaz, funciones, sintaxis y separación de credenciales verificadas.');
