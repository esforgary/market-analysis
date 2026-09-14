import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Meridian — аналитика мировых рынков',description:'Новости, валютные тренды и инвестиционные сценарии для осознанных решений.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>}
