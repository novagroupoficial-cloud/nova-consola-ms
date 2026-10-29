import { createHandlers } from '../../server/handlers.mjs';
export default request => createHandlers().session(request);
export const config={path:'/api/session',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
