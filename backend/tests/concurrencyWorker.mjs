// Arranque del hilo: registra tsx para poder cargar el worker en TypeScript.
import { register } from 'tsx/esm/api';

register();
await import('./concurrencyWorker.ts');
