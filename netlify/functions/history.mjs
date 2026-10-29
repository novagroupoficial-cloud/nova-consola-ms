import {createHandlers} from '../../server/handlers.mjs';
export default request=>createHandlers().history(request);
export const config={path:'/api/history',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
