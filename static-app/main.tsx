import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
(window as Window&{__MERIDIAN_STATIC__?:boolean}).__MERIDIAN_STATIC__=true;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Home/></React.StrictMode>);
