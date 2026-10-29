import { createHandlers } from '../../server/handlers.mjs';
export default request => createHandlers().confirmation(request);
export const config={path:'/api/confirmation',rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
