import('tsx/esm/api')
  .then(({ tsImport }) => tsImport('./server.ts', import.meta.url))
  .then(({ runServer }) => runServer())
  .catch((error) => {
    console.error('Failed to load the server:', error.code || error.message);
    process.exit(1);
  });
