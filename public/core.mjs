export const APP_VERSION = '2.0';
export const PRODUCTS = ['Windows 11','Windows 10','Windows Server','Office 2024 LTSC','Office 2021','Office 2019','Project 2024 LTSC','Project 2021','Visio 2024 LTSC','Visio 2021'];
export class AppError extends Error {
  constructor(code, message, status=400) { super(message); this.name='AppError'; this.code=code; this.status=status; }
}
export const normalizeDigits = value => typeof value === 'string' ? value.replace(/[\s\-\u2010-\u2015]/g,'') : '';
export function validateIID(value) {
  const digits=normalizeDigits(value);
  if (!/^(?:[0-9]{54}|[0-9]{63})$/.test(digits)) throw new AppError('IID_INVALID','El IID debe tener 54 o 63 dígitos. Copia el identificador de instalación completo; la clave de producto tiene otro formato.');
  return digits;
}
export function validateCID(value) {
  const digits=normalizeDigits(value);
  if (!/^[0-9]{48}$/.test(digits)) throw new AppError('CID_INVALID','La API no devolvió un CID con el formato esperado. Revisa el historial del servicio antes de repetir la consulta.',502);
  return digits;
}
export function groupIID(value) { const digits=validateIID(value); return digits.match(new RegExp(`.{${digits.length/9}}`,'g')); }
export function groupCID(value) { return validateCID(value).match(/.{6}/g); }
export function receiptText(record) {
  return ['NOVA ACTIVACIÓN — REGISTRO DE CONFIRMACIÓN',`Producto: ${record.product}`,`Fecha UTC: ${record.receivedAt}`,`Referencia: ${record.id}`,'','IID:',groupIID(record.iid).join(' '),'','CID:',record.cid,'',...groupCID(record.cid).map((value,i)=>`${'ABCDEFGH'[i]}: ${value}`),'','CID recibido mediante API. Comprueba el resultado de activación en el producto instalado.','Este registro no acredita la titularidad ni el estado de una licencia.'].join('\n');
}
