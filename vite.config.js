import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',  
    port: 5173,
  },
  assetsInclude: ['**/*.gz', '**/*.data', '**/*.wasm'],
  publicDir: 'public',
  plugins: [
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.endsWith('.gz')) {
            res.setHeader('Content-Encoding', 'gzip');
            
            if (req.url.includes('.js.gz')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (req.url.includes('.wasm.gz')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (req.url.includes('.data.gz')) {
              res.setHeader('Content-Type', 'application/octet-stream');
            }
          }
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['game/EquationRunner']
  }
});
