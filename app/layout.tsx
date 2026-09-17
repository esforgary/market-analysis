import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Meridian — мировые рынки',description:'Мировые акции, валюты и новости. Светлая и тёмная тема, интерактивные графики.',applicationName:'Meridian',manifest:'/site.webmanifest?v=20260917',appleWebApp:{capable:true,title:'Meridian',statusBarStyle:'default'},icons:{icon:[{url:'/favicon.svg?v=20260917',type:'image/svg+xml'},{url:'/icons/favicon-32.png?v=20260917',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon.png?v=20260917',sizes:'180x180',type:'image/png'}]}};
export const viewport:Viewport={themeColor:'#0b1329',width:'device-width',initialScale:1};
const themeScript="try{var t=localStorage.getItem('meridian-theme')||'dark';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t}catch{}";
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>}
