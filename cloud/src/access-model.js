export const STAFF_VIEWS=['income','expense','products','clients','bookings'];
export const STAFF_OPERATIONS=['/api/entries','/api/entries/update','/api/products','/api/clients','/api/bookings','/api/bookings/status'];
export function recordScope(kind,item){return kind==='clients'||kind==='products'||(kind==='entries'&&(item.activity||'padel')==='padel')?'staff':'admin'}
export function nextIdsOf(data,previous={}){return Object.fromEntries(['entries','clients','products','bookings'].map(kind=>[kind,Math.max(previous[kind]||1,...(data[kind]||[]).map(item=>item.id+1))]))}
export function allocatedKind(url){return url==='/api/entries'?'entries':url==='/api/clients'?'clients':url==='/api/products'?'products':url==='/api/bookings'?'bookings':null}
export function staffOperationAllowed(url,input){return STAFF_OPERATIONS.includes(url)&&(!url.startsWith('/api/entries')||((input.activity||'padel')==='padel'&&!input.monthlyIncome))}
