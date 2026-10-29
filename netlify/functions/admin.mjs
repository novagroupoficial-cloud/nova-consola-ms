import {createHandlers} from '../../server/handlers.mjs';
export default request=>createHandlers().admin(request);
export const config={path:'/api/admin',rateLimit:{windowLimit:90,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
