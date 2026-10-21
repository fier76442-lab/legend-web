import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Legend Role Play',
  description: 'Legend Role Play official website'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><div className="video-bg"><video autoPlay muted loop playsInline preload="auto" aria-hidden="true"><source src="/hero-background.mp4" type="video/mp4" /><source src="https://cdn.discordapp.com/attachments/1508582341822644266/1559519594211844116/13.10.2026_11.53.03_REC.mp4?ex=6acf5f4d&is=6ace0dcd&hm=15c011bfcb59fe4e65983ff52bd0c72351582ca96a41163d754ba9ef68fe5350" type="video/mp4" /></video></div><div className="page-bg"/><Navbar/><main>{children}</main><footer className="footer">© {new Date().getFullYear()} Legend RolePlay — All rights reserved.</footer></body></html>
}