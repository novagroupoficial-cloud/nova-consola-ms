import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHandlers} from '../server/handlers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{const envFile=await readFile(path.join(root,'.env'),'utf8');for(const line of envFile.split(/\r?\n/)){const match=line.match(/^\s*(ACTIVATION_API_TOKEN|NOVA_ACCESS_CODE|DATABASE_URL|NETLIFY_DB_URL)\s*=\s*(.*?)\s*$/);if(!match||process.env[match[1]]!==undefined)continue;let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);process.env[match[1]]=value;}}catch(error){if(error.code!=='ENOENT')throw error;}
const routes=createHandlers({localDev:true});
const args=process.argv.slice(2);const portIndex=args.indexOf('--port');
const port=Number(portIndex>=0?args[portIndex+1]:(process.env.PORT||4173));
const publicDir=path.join(root,'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')){
   const name={'/api/session':'session','/api/status':'status','/api/confirmation':'confirmation','/api/admin':'admin','/api/history':'history'}[url.pathname];
   if(!name){res.writeHead(404,{'Content-Type':'application/json'});res.end('{"ok":false,"message":"Servicio no encontrado."}');return;}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await routes[name](request);
   res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const filename=path.resolve(publicDir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!filename.startsWith(publicDir+path.sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(filename);
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('No disponible.');}
});
server.listen(port,'0.0.0.0',()=>console.log(`NOVA Activación local: http://localhost:${port} · se requiere .env o variables de entorno para consultar la API.`));
