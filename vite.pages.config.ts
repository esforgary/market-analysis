import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./static-app',import.meta.url)),base:'./',publicDir:fileURLToPath(new URL('./public',import.meta.url)),plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},build:{outDir:fileURLToPath(new URL('./dist-pages',import.meta.url)),emptyOutDir:true},server:{host:'127.0.0.1',port:5174,strictPort:true}});

