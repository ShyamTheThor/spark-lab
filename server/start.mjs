import {createServer} from 'node:http';
import {createTranslationHandler} from './bhashini.mjs';
const port=Number(process.env.TRANSLATION_PORT||8787);
createServer(createTranslationHandler()).listen(port,'127.0.0.1',()=>console.log(`Spark translation service listening on ${port}. Route /api/translate to this server.`));
