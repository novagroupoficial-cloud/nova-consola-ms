import { AppError, validateIID, validateCID } from '../public/core.mjs';
export async function readBody(source,limit=8192) {
  if (!source.body) return '';
  const reader=source.body.getReader();const chunks=[];let size=0;
  try { while(true) { const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new AppError('BODY_TOO_LARGE','El tamaño de la solicitud o respuesta supera el límite permitido.',413);}chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}
const errors=[
  [/wrong iid/i,'IID_INVALID','El servicio rechazó el IID. Revisa los nueve grupos del identificador.',422],
  [/blocked iid|not leg[i]?mate key|maybe blocked/i,'IID_BLOCKED','El servicio informa que el IID o la clave están bloqueados. Revisa el caso con tu proveedor.',422],
  [/exceeded iid/i,'IID_EXCEEDED','El servicio informa que se excedió el límite de este IID.',422],
  [/need to call|support/i,'SUPPORT_REQUIRED','La solicitud requiere revisión del proveedor de activación.',422],
  [/token.*used|token.*exhaust|token.*limit/i,'PROVIDER_CREDIT','La credencial del servicio agotó sus usos. Contacta al administrador.',502],
  [/token.*not exist|token.*invalid|token.*empty|token.*expired/i,'PROVIDER_AUTH','La API rechazó la credencial configurada. Contacta al administrador.',502],
  [/reach request limit|being locked|too many|throttl/i,'PROVIDER_LIMIT','El servicio limitó las solicitudes. Espera y revisa su historial antes de volver a consultar.',429],
  [/busy|server error/i,'PROVIDER_BUSY','El servicio está ocupado o no está disponible. La app no repetirá esta consulta automáticamente.',502]
];
export function parseResponse(body) {
  let value=body.trim().replace(/^\uFEFF/,'');
  if (value.startsWith('{')||value.startsWith('"')) {
    let object;try{object=JSON.parse(value);}catch{throw new AppError('PROVIDER_FORMAT','La API devolvió una respuesta incompleta o no reconocida.',502);}
    if(typeof object==='string')value=object;
    else if(object&&typeof object==='object'&&!Array.isArray(object)){
      const failed=object.success===false||/^(error|fail|failure)$/i.test(String(object.status??''));
      const candidate=failed?(object.message??object.error??object.res):(object.cid??object.CID??object.confirmationId??object.confirmation_id??object.result??object.res??object.message);
      value=typeof candidate==='string'?candidate:'unrecognized response';
      if(failed&&/^[0-9\s-]{48,}$/.test(value))value='provider error';
    }
  }
  if(/^[0-9]{48}$/.test(value.replace(/[\s-]/g,'')))return validateCID(value);
  for(const [pattern,code,message,status]of errors)if(pattern.test(value))throw new AppError(code,message,status);
  // Never echo upstream HTML, exception messages, URLs, tokens or raw bodies.
  throw new AppError('PROVIDER_FORMAT','La API no devolvió un CID válido. Revisa el historial del servicio antes de repetir la consulta.',502);
}
export async function obtainCID(iidInput,token,fetcher=fetch,{timeoutMs=45000}={}) {
  const iid=validateIID(iidInput);
  if(typeof token!=='string'||!/^[\x21-\x7E]{1,256}$/.test(token.trim()))throw new AppError('PROVIDER_NOT_CONFIGURED','La conexión del servicio está pendiente de configuración.',503);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    // The contracted provider API requires IID and token as URL path components.
    // Fixed HTTPS host; credentials stay on the server and redirects are forbidden.
    const response=await fetcher(`https://getcid.info/api/${encodeURIComponent(iid)}/${encodeURIComponent(token.trim())}`,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'text/plain, application/json'},signal:controller.signal});
    if(response.status===429)throw new AppError('PROVIDER_LIMIT','El servicio limitó las solicitudes. Revisa su historial antes de volver a consultar.',429);
    if(!response.ok)throw new AppError('PROVIDER_UNAVAILABLE','La API rechazó la conexión o no está disponible. Revisa el servicio antes de repetir la consulta.',502);
    return parseResponse(await readBody(response));
  }catch(error){
    if(error instanceof AppError)throw error;
    throw new AppError('PROVIDER_NETWORK',controller.signal.aborted?'La API superó el tiempo de espera. La solicitud pudo haberse procesado; revisa el historial del servicio antes de volver a enviarla.':'No se pudo completar la conexión con la API. La solicitud pudo haberse procesado; revisa el historial del servicio antes de repetirla.',502);
  }finally{clearTimeout(timer);}
}
