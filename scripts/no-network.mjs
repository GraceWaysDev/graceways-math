// Loaded before test imports. Only loopback HTTP is permitted for local E2E tests.
import net from 'node:net';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
const local=h=>['127.0.0.1','localhost','::1'].includes(h);
const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let a=Array.isArray(args[0])?args[0]:args;const first=a[0];const host=typeof first==='object'?first.host:typeof a[1]==='string'?a[1]:'localhost';if(typeof first==='object'&&first.path||!local(host??'localhost'))throw Error('TEST_EXTERNAL_NETWORK_DISABLED');return original.apply(this,args);};
tls.connect=()=>{throw Error('TEST_TLS_DISABLED');};
const fetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{if(!local(new URL(url).hostname))throw Error('TEST_EXTERNAL_NETWORK_DISABLED');return fetch(url,options);};
syncBuiltinESMExports();
