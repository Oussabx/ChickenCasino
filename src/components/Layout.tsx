import { Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useRef } from 'react';
import Header from './Header';
import MobileNav from './MobileNav';
import Footer from './Footer';
import Toaster from './Toaster';
import AuthModal from './AuthModal';
import Ambient from './Ambient';
import { toast, useStore, useUI } from '../store';
import { migrateLegacyProfile } from '../lib/auth';

export default function Layout() {
  const { pathname } = useLocation();
  const reduce = useStore((s) => s.settings.reduceMotion);
  const reminder = useStore((s) => s.settings.sessionReminder);
  const start = useRef(Date.now());

  useEffect(() => { migrateLegacyProfile(); }, []);
  // new page: back to the top, and close the account dialog if it was left open (e.g. browser back)
  useEffect(() => { window.scrollTo(0, 0); useUI.getState().openAuth(null); }, [pathname]);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', reduce); }, [reduce]);
  useEffect(() => {
    if (!reminder) return;
    const id = setInterval(() => {
      const mins = Math.round((Date.now() - start.current) / 60000);
      toast({ title: `⏰ You've been playing for ${mins} minutes`, desc: 'Take a breather — the chickens will wait.', tone: 'neutral' });
    }, reminder * 60000);
    return () => clearInterval(id);
  }, [reminder]);

  return (
    <div className="min-h-screen flex flex-col">
      <Ambient />
      <Header />
      <main key={pathname} className="relative flex-1 pb-24 lg:pb-0 page-in">
        <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><img src="./img/head.webp" alt="Loading" className="h-16 w-16 rounded-full animate-floaty" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <div className="pb-16 lg:pb-0"><Footer /></div>
      <MobileNav />
      <Toaster />
      <AuthModal />
    </div>
  );
}
