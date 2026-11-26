import { tsImport } from 'tsx/esm/api';

const { runServer } = await tsImport('./server.ts', import.meta.url);
await runServer();
