import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {AppError} from '../public/core.mjs';
import {SCHEMA_SQL,SCHEMA_VERSION} from './schema.mjs';
export const keyHash=key=>createHash('sha256').update(key).digest('hex');
export const makeKey=()=>`NOVA-${randomBytes(24).toString('base64url')}`;
export const keyHint=key=>`${key.slice(0,9)}…${key.slice(-4)}`;
export const usageDay=epoch=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(epoch));
export function accountView(row,epoch=Date.now()){
 const today=usageDay(epoch);const used=row.usage_day===today?Number(row.daily_used):0;
 return {id:row.id,role:row.role,name:row.name,email:row.email,notes:row.notes,keyHint:row.key_hint,active:row.active,balance:Number(row.balance),dailyLimit:Number(row.daily_limit),dailyUsed:used,dailyRemaining:row.daily_limit?Math.max(0,row.daily_limit-used):null,expiresAt:row.expires_at?new Date(row.expires_at).toISOString():null,expired:Boolean(row.expires_at&&new Date(row.expires_at).getTime()<=epoch),createdAt:new Date(row.created_at).toISOString(),lastLoginAt:row.last_login_at?new Date(row.last_login_at).toISOString():null};
}
function operationView(row){return {id:row.id,accountId:row.account_id,clientName:row.client_name||'',requestId:row.request_id,product:row.product,iid:row.iid,cid:row.cid,status:row.status,errorCode:row.error_code,errorMessage:row.error_message,charged:row.charged,refunded:row.refunded,receivedAt:new Date(row.completed_at||row.created_at).toISOString(),createdAt:new Date(row.created_at).toISOString()};}
export function checkAccount(row,epoch){
 if(!row||!row.active)throw new AppError('ACCOUNT_SUSPENDED','Tu acceso está suspendido. Contacta al administrador.',403);
 if(row.expires_at&&new Date(row.expires_at).getTime()<=epoch)throw new AppError('ACCOUNT_EXPIRED','Tu acceso ha vencido. Contacta al administrador.',403);
}
export function createStore(database,{now=Date.now,uuid=randomUUID,keyGenerator=makeKey}={}){
 const query=(...args)=>database.query(...args);const iso=()=>new Date(now()).toISOString();
 const audit=async(tx,action,accountId,details={})=>tx.query('INSERT INTO nova_audit(id,action,account_id,details,created_at) VALUES($1,$2,$3,$4::jsonb,$5)',[uuid(),action,accountId,JSON.stringify(details),iso()]);
 async function requireReady(){const r=await query("SELECT to_regclass('public.nova_schema_version') AS table_name");if(!r.rows[0]?.table_name)throw new AppError('DATABASE_SETUP_REQUIRED','El administrador debe inicializar el panel.',503);const v=await query('SELECT version FROM nova_schema_version WHERE id=1');if(v.rows[0]?.version!==SCHEMA_VERSION)throw new AppError('DATABASE_VERSION','La base de datos requiere una actualización compatible.',503);}
 async function lockClient(tx,id){const r=await tx.query("SELECT * FROM nova_accounts WHERE id=$1 AND role='client' FOR UPDATE",[id]);if(!r.rows[0])throw new AppError('CLIENT_NOT_FOUND','El cliente no existe.',404);return r.rows[0];}
 return {
  requireReady,
  setup:async()=>database.transaction(async tx=>{for(const statement of SCHEMA_SQL.split(';').map(s=>s.trim()).filter(Boolean))await tx.query(statement);await audit(tx,'database_initialized','admin');return {ready:true};}),
  findByKey:async code=>{const r=await query("SELECT * FROM nova_accounts WHERE key_hash=$1 AND role='client'",[keyHash(code)]);return r.rows[0]||null;},
  getAccount:async id=>{const r=await query('SELECT * FROM nova_accounts WHERE id=$1',[id]);return r.rows[0]||null;},
  touchLogin:id=>query('UPDATE nova_accounts SET last_login_at=$2 WHERE id=$1',[id,iso()]),
  createClient:async data=>{
   const id=uuid();const accessKey=keyGenerator();
   const row=await database.transaction(async tx=>{
    const r=await tx.query("INSERT INTO nova_accounts(id,role,name,email,notes,key_hash,key_hint,balance,daily_limit,expires_at,created_at,updated_at) VALUES($1,'client',$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *",[id,data.name,data.email,data.notes,keyHash(accessKey),keyHint(accessKey),data.credits,data.dailyLimit,data.expiresAt,iso()]);
    if(data.credits)await tx.query('INSERT INTO nova_credit_ledger(id,account_id,delta,balance_after,reason,created_at) VALUES($1,$2,$3,$3,$4,$5)',[uuid(),id,data.credits,'Asignación inicial',iso()]);
    await audit(tx,'client_created',id,{name:data.name,credits:data.credits,dailyLimit:data.dailyLimit,expiresAt:data.expiresAt});return r.rows[0];
   });return {client:accountView(row,now()),accessKey};
  },
  updateClient:async(id,data)=>database.transaction(async tx=>{await lockClient(tx,id);const r=await tx.query('UPDATE nova_accounts SET name=$2,email=$3,notes=$4,daily_limit=$5,expires_at=$6,updated_at=$7 WHERE id=$1 RETURNING *',[id,data.name,data.email,data.notes,data.dailyLimit,data.expiresAt,iso()]);await audit(tx,'client_updated',id,{name:data.name,dailyLimit:data.dailyLimit,expiresAt:data.expiresAt});return accountView(r.rows[0],now());}),
  setActive:async(id,active)=>database.transaction(async tx=>{await lockClient(tx,id);const r=await tx.query('UPDATE nova_accounts SET active=$2,session_version=session_version+1,updated_at=$3 WHERE id=$1 RETURNING *',[id,active,iso()]);await audit(tx,active?'client_enabled':'client_suspended',id);return accountView(r.rows[0],now());}),
  rotateKey:async id=>{const accessKey=keyGenerator();const client=await database.transaction(async tx=>{await lockClient(tx,id);const r=await tx.query('UPDATE nova_accounts SET key_hash=$2,key_hint=$3,session_version=session_version+1,updated_at=$4 WHERE id=$1 RETURNING *',[id,keyHash(accessKey),keyHint(accessKey),iso()]);await audit(tx,'key_rotated',id);return accountView(r.rows[0],now());});return {client,accessKey};},
  adjustCredits:async(id,amount,reason)=>database.transaction(async tx=>{const row=await lockClient(tx,id);const balance=row.balance+amount;if(balance<0||balance>1000000)throw new AppError('BALANCE_INVALID','El ajuste dejaría un saldo fuera del rango permitido.');await tx.query('UPDATE nova_accounts SET balance=$2,updated_at=$3 WHERE id=$1',[id,balance,iso()]);await tx.query('INSERT INTO nova_credit_ledger(id,account_id,delta,balance_after,reason,created_at) VALUES($1,$2,$3,$4,$5,$6)',[uuid(),id,amount,balance,reason,iso()]);await audit(tx,'credits_adjusted',id,{amount,balance,reason});return {balance};}),
  listClients:async({search='',page=1}={})=>{
   const params=[`%${search}%`];const condition="role='client' AND (name ILIKE $1 OR email ILIKE $1 OR key_hint ILIKE $1)";
   const count=await query(`SELECT COUNT(*)::integer AS total FROM nova_accounts WHERE ${condition}`,params);
   const r=await query(`SELECT * FROM nova_accounts WHERE ${condition} ORDER BY created_at DESC LIMIT 25 OFFSET $2`,[...params,(page-1)*25]);
   return {clients:r.rows.map(row=>accountView(row,now())),total:count.rows[0].total,page,pageSize:25};
  },
  dashboard:async()=>{
   const clients=await query("SELECT COUNT(*)::integer AS total,COUNT(*) FILTER(WHERE active AND(expires_at IS NULL OR expires_at>$1))::integer AS active,COALESCE(SUM(balance),0)::bigint AS available FROM nova_accounts WHERE role='client'",[iso()]);
   const operations=await query("SELECT COUNT(*)::integer AS requests,COUNT(*) FILTER(WHERE status='success')::integer AS successes,COUNT(*) FILTER(WHERE status='error')::integer AS errors,COUNT(*) FILTER(WHERE status='pending')::integer AS pending,COUNT(*) FILTER(WHERE (created_at AT TIME ZONE 'America/Guayaquil')::date=$1::date)::integer AS today FROM nova_operations",[usageDay(now())]);
   return {...clients.rows[0],available:Number(clients.rows[0].available),...operations.rows[0]};
  },
  history:async({accountId=null,page=1}={})=>{
   const condition=accountId?'o.account_id=$1':'true';const values=accountId?[accountId]:[];
   const count=await query(`SELECT COUNT(*)::integer AS total FROM nova_operations o WHERE ${condition}`,values);
   const r=await query(`SELECT o.*,a.name AS client_name FROM nova_operations o JOIN nova_accounts a ON a.id=o.account_id WHERE ${condition} ORDER BY o.created_at DESC LIMIT 25 OFFSET $${values.length+1}`,[...values,(page-1)*25]);
   return {operations:r.rows.map(operationView),total:count.rows[0].total,page,pageSize:25};
  },
  ledger:async({accountId=null,page=1}={})=>{const values=accountId?[accountId]:[];const condition=accountId?'l.account_id=$1':'true';const r=await query(`SELECT l.id,l.account_id,a.name AS client_name,l.operation_id,l.delta,l.balance_after,l.reason,l.created_at FROM nova_credit_ledger l JOIN nova_accounts a ON a.id=l.account_id WHERE ${condition} ORDER BY l.created_at DESC LIMIT 50 OFFSET $${values.length+1}`,[...values,(page-1)*50]);return r.rows;},
  audit:async()=>{const r=await query('SELECT id,action,account_id,details,created_at FROM nova_audit ORDER BY created_at DESC LIMIT 100');return r.rows;},
  reserve:async({accountId,requestId,product,iid})=>database.transaction(async tx=>{
   const r=await tx.query('SELECT * FROM nova_accounts WHERE id=$1 FOR UPDATE',[accountId]);const account=r.rows[0];if(!account)throw new AppError('ACCOUNT_NOT_FOUND','No se encontró la cuenta.',403);
   checkAccount(account,now());
   const previous=await tx.query('SELECT * FROM nova_operations WHERE account_id=$1 AND request_id=$2',[accountId,requestId]);
   if(previous.rows[0]){const old=previous.rows[0];if(old.iid!==iid||old.product!==product)throw new AppError('REQUEST_REUSED','Esta referencia corresponde a otra consulta. Crea una nueva consulta.',409);return {operation:operationView(old),fresh:false,balance:account.balance};}
   const client=account.role==='client';const day=usageDay(now());const dailyUsed=account.usage_day===day?account.daily_used:0;
   if(client&&account.balance<1)throw new AppError('NO_CREDITS','Tu cuenta no tiene usos disponibles. Contacta al administrador.',403);
   if(client&&account.daily_limit>0&&dailyUsed>=account.daily_limit)throw new AppError('DAILY_LIMIT','Alcanzaste tu límite de consultas de hoy. Contacta al administrador.',403);
   const id=uuid();const balance=account.balance-(client?1:0);
   const op=await tx.query("INSERT INTO nova_operations(id,account_id,request_id,product,iid,status,charged,created_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$7) RETURNING *",[id,accountId,requestId,product,iid,client,iso()]);
   await tx.query('UPDATE nova_accounts SET balance=$2,usage_day=$3,daily_used=$4,updated_at=$5 WHERE id=$1',[accountId,balance,day,dailyUsed+1,iso()]);
   if(client)await tx.query('INSERT INTO nova_credit_ledger(id,account_id,operation_id,delta,balance_after,reason,created_at) VALUES($1,$2,$3,-1,$4,$5,$6)',[uuid(),accountId,id,balance,'Solicitud admitida para envío a la API',iso()]);
   return {operation:operationView(op.rows[0]),fresh:true,balance};
  }),
  complete:async(id,{cid=null,errorCode='',errorMessage=''})=>{const r=await query("UPDATE nova_operations SET status=$2,cid=$3,error_code=$4,error_message=$5,completed_at=$6 WHERE id=$1 AND status='pending' RETURNING *",[id,cid?'success':'error',cid,errorCode,errorMessage,iso()]);return r.rows[0]?operationView(r.rows[0]):null;},
  refund:async(id,reason)=>database.transaction(async tx=>{
   const found=await tx.query('SELECT account_id FROM nova_operations WHERE id=$1',[id]);if(!found.rows[0])throw new AppError('OPERATION_NOT_FOUND','No se encontró la consulta.',404);
   const account=await lockClient(tx,found.rows[0].account_id);const r=await tx.query('SELECT * FROM nova_operations WHERE id=$1 FOR UPDATE',[id]);const op=r.rows[0];
   if(!op.charged||op.refunded)throw new AppError('ALREADY_REFUNDED','Esta consulta no tiene un uso pendiente de reintegro.',409);
   if(op.status==='pending'&&now()-new Date(op.created_at).getTime()<120000)throw new AppError('OPERATION_RUNNING','La consulta puede seguir en curso. Espera al menos dos minutos antes de reintegrarla.',409);
   if(account.balance>=1000000)throw new AppError('BALANCE_INVALID','El saldo está en el máximo permitido.');
   const balance=account.balance+1;await tx.query('UPDATE nova_accounts SET balance=$2,updated_at=$3 WHERE id=$1',[account.id,balance,iso()]);await tx.query('UPDATE nova_operations SET refunded=true WHERE id=$1',[id]);await tx.query('INSERT INTO nova_credit_ledger(id,account_id,operation_id,delta,balance_after,reason,created_at) VALUES($1,$2,$3,1,$4,$5,$6)',[uuid(),account.id,id,balance,reason,iso()]);await audit(tx,'operation_refunded',account.id,{operationId:id,reason});return {balance};
  })
 };
}
