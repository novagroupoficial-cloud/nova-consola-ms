import pg from 'pg';
import {AppError} from '../public/core.mjs';
const pools=new Map();
export function databaseConfigured(env=process.env){return Boolean((env.DATABASE_URL||env.NETLIFY_DB_URL||'').trim());}
export function productionDatabase(env=process.env){
 const connectionString=(env.DATABASE_URL||env.NETLIFY_DB_URL||'').trim();
 if(!connectionString)throw new AppError('DATABASE_NOT_CONFIGURED','La base de datos está pendiente de configuración.',503);
 let url;try{url=new URL(connectionString);}catch{throw new AppError('DATABASE_NOT_CONFIGURED','La conexión de base de datos no tiene el formato esperado.',503);}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new AppError('DATABASE_NOT_CONFIGURED','Se requiere una conexión PostgreSQL válida.',503);
 let pool=pools.get(connectionString);
 if(!pool){pool=new pg.Pool({connectionString,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:6000,statement_timeout:8000,query_timeout:10000,allowExitOnIdle:true,application_name:'nova-activacion'});pool.on('error',()=>{});pools.set(connectionString,pool);}
 return {
  query:(text,values=[])=>pool.query(text,values),
  transaction:async work=>{
   const client=await pool.connect();
   try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
   catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}
   finally{client.release();}
  }
 };
}
