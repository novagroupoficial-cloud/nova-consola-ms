import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {AppError,PRODUCTS,validateIID} from '../public/core.mjs';
import {obtainCID,readBody} from './provider.mjs';
import {productionDatabase,databaseConfigured} from './database.mjs';
import {createStore,accountView,checkAccount} from './store.mjs';
const COOKIE='nova_activation_session';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0',Pragma:'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const hash=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>timingSafeEqual(hash(String(a)),hash(String(b)));
const sign=(body,key)=>createHmac('sha256',key).update(`nova-activation-v2:${body}`).digest('base64url');
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...HEADERS,...headers}});
function originCheck(request){const origin=request.headers.get('Origin');if(!origin||origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new AppError('ORIGIN_REJECTED','Abre la solicitud desde esta aplicación.',403);}
async function input(request,limit=8192){if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AppError('JSON_REQUIRED','Usa el formulario de la aplicación.',415);let value;try{value=JSON.parse(await readBody(request,limit));}catch(error){if(error instanceof AppError)throw error;throw new AppError('JSON_INVALID','No se pudo leer la solicitud.');}if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError('JSON_INVALID','No se pudo leer la solicitud.');return value;}
function integer(value,min,max,label){if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw new AppError('VALUE_INVALID',`${label}: introduce un número entero entre ${min} y ${max}.`);return value;}
function text(value,max,label,{required=false}={}){if(value===undefined||value===null)value='';if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new AppError('VALUE_INVALID',`Revisa el campo ${label}.`);return value.trim();}
function clientInput(data,{creating=false}={}){const result={name:text(data.name,120,'Nombre',{required:true}),email:text(data.email,254,'Correo'),notes:text(data.notes,2000,'Notas'),dailyLimit:integer(data.dailyLimit??0,0,10000,'Límite diario'),expiresAt:null};if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw new AppError('EMAIL_INVALID','Revisa el correo del cliente.');if(data.expiresAt){if(typeof data.expiresAt!=='string'||!Number.isFinite(Date.parse(data.expiresAt)))throw new AppError('EXPIRY_INVALID','Revisa la fecha de vencimiento.');result.expiresAt=new Date(data.expiresAt).toISOString();}if(creating)result.credits=integer(data.credits??0,0,1000000,'Usos iniciales');return result;}
const validId=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new AppError('ID_INVALID','La referencia de la solicitud no es válida.');return value;};

export function createHandlers({env=process.env,fetcher=fetch,now=Date.now,uuid=randomUUID,localDev=false,store:injectedStore}={}){
 const access=()=>typeof env.NOVA_ACCESS_CODE==='string'?env.NOVA_ACCESS_CODE.trim():'';
 const token=()=>typeof env.ACTIVATION_API_TOKEN==='string'?env.ACTIVATION_API_TOKEN.trim():'';
 const accessReady=()=>access().length>=16&&access().length<=256;
 const providerReady=()=>/^[\x21-\x7E]{1,256}$/.test(token());
 let currentStore=injectedStore;
 const store=()=>currentStore||(currentStore=createStore(productionDatabase(env),{now,uuid}));
 const cookie=(value,clear=false)=>`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${localDev?'':'; Secure'}${clear?'; Max-Age=0':''}`;
 function claims(request){if(!accessReady())return null;const value=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!value||value.length>2048)return null;const [body,signature,extra]=value.split('.');if(!body||!signature||extra||!equal(signature,sign(body,access())))return null;try{const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return p.v===2&&['admin','client'].includes(p.role)&&typeof p.id==='string'&&Number.isSafeInteger(p.exp)&&p.exp>now()&&p.exp<=now()+8*60*60*1000?p:null;}catch{return null;}}
 async function user(request){const p=claims(request);if(!p)throw new AppError('SESSION_REQUIRED','Inicia sesión para continuar.',401);if(p.role==='admin'&&p.id==='admin')return {id:'admin',role:'admin',name:'Administrador'};if(p.role!=='client')throw new AppError('SESSION_REQUIRED','La sesión no es válida.',401);await store().requireReady();const row=await store().getAccount(p.id);checkAccount(row,now());if(row.role!=='client'||p.sv!==row.session_version)throw new AppError('SESSION_REVOKED','Tu clave cambió. Vuelve a iniciar sesión.',401);return {...accountView(row,now()),sessionVersion:row.session_version};}
 async function admin(request){const u=await user(request);if(u.role!=='admin')throw new AppError('ADMIN_REQUIRED','Esta operación requiere acceso de administrador.',403);return u;}
 const failure=error=>error instanceof AppError?error:new AppError('DATABASE_UNAVAILABLE','No se pudo completar la operación de base de datos. El administrador debe revisar su conexión.',503);
 async function guarded(work){try{return await work();}catch(error){const e=failure(error);return json({ok:false,code:e.code,message:e.message},e.status);}}
 function sessionResponse(u){const body=Buffer.from(JSON.stringify({v:2,id:u.id,role:u.role,sv:u.session_version||1,exp:now()+8*60*60*1000,nonce:uuid()})).toString('base64url');return json({ok:true,role:u.role},200,{'Set-Cookie':cookie(`${body}.${sign(body,access())}`)});}
 return {
  session:request=>guarded(async()=>{
   if(!['POST','DELETE'].includes(request.method))return json({ok:false,message:'Método no permitido.'},405,{Allow:'POST, DELETE'});
   originCheck(request);if(request.method==='DELETE')return json({ok:true},200,{'Set-Cookie':cookie('',true)});
   if(!accessReady())throw new AppError('ACCESS_NOT_CONFIGURED','El acceso está pendiente de configuración por el administrador.',503);
   const data=await input(request,1024);const code=typeof data.code==='string'?data.code.trim():'';
   if(code.length>256||!code)throw new AppError('ACCESS_DENIED','La clave de acceso no es correcta.',401);
   if(equal(code,access()))return sessionResponse({id:'admin',role:'admin'});
   if(!/^NOVA-[A-Za-z0-9_-]{32}$/.test(code))throw new AppError('ACCESS_DENIED','La clave de acceso no es correcta.',401);
   await store().requireReady();const row=await store().findByKey(code);if(!row)throw new AppError('ACCESS_DENIED','La clave de acceso no es correcta.',401);checkAccount(row,now());await store().touchLogin(row.id);return sessionResponse(row);
  }),
  status:request=>guarded(async()=>{
   if(request.method!=='GET')return json({ok:false,message:'Método no permitido.'},405,{Allow:'GET'});
   const u=await user(request);let databaseReady=false;let databaseMessage='';
   if(u.role==='admin'){try{await store().requireReady();databaseReady=true;}catch(error){databaseMessage=failure(error).message;}}
   else databaseReady=true;
   const {notes:privateNotes,sessionVersion:privateVersion,...safeAccount}=u;
   return json({ok:true,version:'2.0.0',role:u.role,account:safeAccount,providerConfigured:providerReady(),databaseConfigured:Boolean(injectedStore)||databaseConfigured(env),databaseReady,databaseMessage,liveCheckPerformed:false,quotaPolicy:'Cada solicitud admitida para envío a la API consume un uso. Los rechazos previos no consumen. El administrador puede reintegrar usos.'});
  }),
  confirmation:request=>guarded(async()=>{
   if(request.method!=='POST')return json({ok:false,message:'Método no permitido.'},405,{Allow:'POST'});
   originCheck(request);const u=await user(request);const data=await input(request);
   if(!PRODUCTS.includes(data.product))throw new AppError('PRODUCT_INVALID','Selecciona el producto instalado.');const iid=validateIID(data.iid);const requestId=validId(data.requestId);
   if(!providerReady())throw new AppError('PROVIDER_NOT_CONFIGURED','La conexión del servicio está pendiente de configuración.',503);
   await store().requireReady();const reservation=await store().reserve({accountId:u.id,requestId,product:data.product,iid});const op=reservation.operation;
   if(!reservation.fresh){if(op.status==='success')return json({ok:true,id:op.id,cid:op.cid,receivedAt:op.receivedAt,reused:true,balance:reservation.balance});if(op.status==='pending')return json({ok:false,code:'OPERATION_PENDING',message:'La consulta ya fue admitida y puede seguir en curso. Revisa tu historial; no se enviará otra solicitud.',operationId:op.id},409);return json({ok:false,code:op.errorCode||'PREVIOUS_ERROR',message:op.errorMessage||'Esta consulta ya terminó con error. Revisa el historial antes de iniciar una nueva.',operationId:op.id,reused:true},502);}
   let cid;
   try{cid=await obtainCID(iid,token(),fetcher,{timeoutMs:35000});}
   catch(error){const e=error instanceof AppError?error:new AppError('PROVIDER_NETWORK','No se pudo completar la consulta. Revisa el historial antes de repetirla.',502);try{await store().complete(op.id,{errorCode:e.code,errorMessage:e.message});}catch{}return json({ok:false,code:e.code,message:e.message,operationId:op.id,balance:reservation.balance},e.status);}
   let record;try{record=await store().complete(op.id,{cid});}catch{}
   return json({ok:true,cid,id:op.id,receivedAt:record?.receivedAt||new Date(now()).toISOString(),balance:reservation.balance,...(!record?{storageWarning:'CID recibido. No se pudo guardar la respuesta final; descarga el registro y avisa al administrador.'}:{})});
  }),
  history:request=>guarded(async()=>{if(request.method!=='GET')return json({ok:false,message:'Método no permitido.'},405,{Allow:'GET'});const u=await user(request);await store().requireReady();const params=new URL(request.url).searchParams;const page=integer(Number(params.get('page')||1),1,100000,'Página');return json({ok:true,...await store().history({accountId:u.id,page})});}),
  admin:request=>guarded(async()=>{
   if(!['GET','POST'].includes(request.method))return json({ok:false,message:'Método no permitido.'},405,{Allow:'GET, POST'});
   if(request.method==='POST')originCheck(request);await admin(request);
   if(request.method==='GET'){
    await store().requireReady();const params=new URL(request.url).searchParams;const page=integer(Number(params.get('page')||1),1,100000,'Página');const view=params.get('view')||'clients';
    if(view==='clients')return json({ok:true,...await store().listClients({search:text(params.get('search')||'',120,'Búsqueda'),page}),summary:await store().dashboard()});
    if(view==='usage'){const accountId=params.get('clientId')||null;if(accountId&&accountId!=='admin')validId(accountId);return json({ok:true,...await store().history({accountId,page}),summary:await store().dashboard()});}
    if(view==='ledger'){const accountId=params.get('clientId')||null;if(accountId)validId(accountId);return json({ok:true,ledger:await store().ledger({accountId,page})});}
    if(view==='audit')return json({ok:true,audit:await store().audit()});
    throw new AppError('VIEW_INVALID','La vista solicitada no existe.',404);
   }
   const data=await input(request);
   if(data.action==='setup'){const result=await store().setup();await store().requireReady();return json({ok:true,...result});}
   await store().requireReady();
   if(data.action==='create_client')return json({ok:true,...await store().createClient(clientInput(data,{creating:true}))},201);
   if(data.action==='update_client')return json({ok:true,client:await store().updateClient(validId(data.clientId),clientInput(data))});
   if(data.action==='set_active'){if(typeof data.active!=='boolean')throw new AppError('VALUE_INVALID','Revisa el estado del cliente.');return json({ok:true,client:await store().setActive(validId(data.clientId),data.active)});}
   if(data.action==='rotate_key')return json({ok:true,...await store().rotateKey(validId(data.clientId))});
   if(data.action==='adjust_credits'){const amount=integer(data.amount,-1000000,1000000,'Ajuste de usos');if(!amount)throw new AppError('VALUE_INVALID','El ajuste debe ser distinto de cero.');const reason=text(data.reason,300,'Motivo',{required:true});return json({ok:true,...await store().adjustCredits(validId(data.clientId),amount,reason)});}
   if(data.action==='refund'){const reason=text(data.reason,300,'Motivo',{required:true});return json({ok:true,...await store().refund(validId(data.operationId),reason)});}
   throw new AppError('ACTION_INVALID','La operación no existe.',404);
  })
 };
}
