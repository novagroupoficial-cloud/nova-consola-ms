import { createHandlers } from '../../server/handlers.mjs';
export default request => createHandlers().status(request);
export const config={path:'/api/status',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
