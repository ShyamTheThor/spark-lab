import {createServer} from 'node:http';
import {createTranslationHandler} from './bhashini.mjs';
import {createAIHandler} from './ai.mjs';
const port=Number(process.env.API_PORT||process.env.TRANSLATION_PORT||8787);
const ai=createAIHandler(), translate=createTranslationHandler();
const server=createServer((req,res)=>ai(req,res,()=>translate(req,res)));
server.requestTimeout=35000;
server.headersTimeout=10000;
server.listen(port,process.env.API_HOST||'127.0.0.1',()=>console.log(`Spark API listening on ${port}. Proxy /api/ to this server.`));
