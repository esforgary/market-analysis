import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Meridian — мировые рынки',description:'Мировые акции, валюты и новости. Светлая и тёмная тема, интерактивные графики.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
const themeScript="try{var t=localStorage.getItem('meridian-theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t}catch{}";
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>}
