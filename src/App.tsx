import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { TopWaveHeader } from './components/TopWaveHeader';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DailyAttendancePage } from './pages/DailyAttendancePage';
import { MyReportsPage } from './pages/MyReportsPage';
import { TeamsPage } from './pages/TeamsPage';
import { WeeklyReportsPage } from './pages/WeeklyReportsPage';
import { MonthlyReportsPage } from './pages/MonthlyReportsPage';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { PaymentTrackerPage } from './pages/PaymentTrackerPage';
import { AttachmentsPage } from './pages/AttachmentsPage';
import { AdditionalChargesPage } from './pages/AdditionalChargesPage';
import { AdvancesDeductionsPage } from './pages/AdvancesDeductionsPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { SecondaryAdminPage } from './pages/SecondaryAdminPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditHistoryPage } from './pages/AuditHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LabourerDashboardPage } from './pages/LabourerDashboardPage';
import { LabourersManagementPage } from './pages/LabourersManagementPage';
import { WorksitesPage } from './pages/WorksitesPage';
import { GpsAttendancePage } from './pages/GpsAttendancePage';

function ERPContent() {
  const { user, isLoading, isAdminAny, isLabourer } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [navParams, setNavParams] = useState<any>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const tabHistoryRef = useRef<NavTab[]>(['dashboard']);

  // Monitor scroll for mobile dynamic header contraction & duo blur fading
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 15);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setIsScrolled(window.scrollY > 15);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = (tab: NavTab, params?: any, pushHistory = true) => {
    if (params) setNavParams(params);
    if (tab === currentTab) return;
    if (pushHistory) {
      tabHistoryRef.current.push(tab);
      window.history.pushState({ tab, depth: tabHistoryRef.current.length }, '', `#${tab}`);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (tabHistoryRef.current.length > 1) {
      tabHistoryRef.current.pop();
      const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1] || 'dashboard';
      if (window.history.state?.tab) {
        window.history.back();
      } else {
        setCurrentTab(prevTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
      tabHistoryRef.current = ['dashboard'];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Initial history state on root load
    if (!window.history.state?.tab) {
      window.history.replaceState({ tab: 'dashboard', depth: 1 }, '', '#dashboard');
    }

    const onPopState = (event: PopStateEvent) => {
      const targetTab = event.state?.tab as NavTab | undefined;
      if (targetTab) {
        if (tabHistoryRef.current.length > 1) {
          tabHistoryRef.current.pop();
        }
        setCurrentTab(targetTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // If history pops back to empty/root while on subpage, go to dashboard
        if (currentTab !== 'dashboard') {
          setCurrentTab('dashboard');
          tabHistoryRef.current = ['dashboard'];
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('popstate', onPopState);

    // React Native WebView Android hardware back press bridge
    const onNativeMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'HARDWARE_BACK_PRESS' || data?.type === 'BACK_BUTTON_PRESSED') {
          if (currentTab !== 'dashboard') {
            handleBack();
            if ((window as any).ReactNativeWebView) {
              (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'HANDLED_BACK', handled: true }));
            }
          }
        }
      } catch {}
    };

    window.addEventListener('message', onNativeMessage);
    document.addEventListener('message' as any, onNativeMessage);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('message', onNativeMessage);
      document.removeEventListener('message' as any, onNativeMessage);
    };
  }, [currentTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#082419] via-[#0E3D28] to-[#0A2E1F] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-18 h-18 rounded-2xl bg-white/95 p-2 shadow-2xl mx-auto border border-emerald-400/20">
            <img
              src="/assets/aistudio/solar_designs_clean_logo_bf464b07.png"
              alt="Solar Design Pvt Ltd"
              className="w-full h-full object-contain animate-pulse"
            />
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-semibold text-emerald-100 tracking-wide">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Dedicated Mobile-First Portal for Labourer Accounts
  if (isLabourer) {
    return <LabourerDashboardPage />;
  }

  return (
    <div className="min-h-screen bg-[#EEE5D4] flex flex-col md:flex-row relative">
      <Sidebar currentTab={currentTab} onTabChange={(tab) => handleNavigate(tab, undefined, true)} />

      {/* Mobile-only wavy top header bar with logo & back button matching Image 1 */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#082417] shadow-md transition-all duration-300">
        <TopWaveHeader
          title="Solar Designs Pvt Ltd"
          subtitle="Labour Attendance ERP"
          showBack={currentTab !== 'dashboard'}
          onBack={handleBack}
          isScrolled={isScrolled}
        />
      </header>

      {/* Top Duo Blurry Fade (iPhone-style dynamic blur fade below top header) */}
      <div
        className={`md:hidden fixed left-0 right-0 z-20 pointer-events-none transition-all duration-300 ease-in-out ${
          isScrolled
            ? (currentTab !== 'dashboard' ? 'top-[44px] h-9 opacity-100' : 'top-[26px] h-8 opacity-100')
            : 'top-[78px] h-10 opacity-75'
        }`}
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'linear-gradient(to bottom, rgba(238, 229, 212, 0.95) 0%, rgba(238, 229, 212, 0.4) 60%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 25%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 25%, transparent 100%)',
        }}
      />

      {/* Bottom Duo Blurry Fade (iPhone-style dynamic blur fade above bottom nav) */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-35 pointer-events-none h-24 sm:h-28"
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          background: 'linear-gradient(to top, rgba(238, 229, 212, 0.98) 0%, rgba(238, 229, 212, 0.75) 45%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
        }}
      />

      <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pt-24 md:pt-4 pb-28 md:pb-12">
        {currentTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
        {currentTab === 'attendance' && <DailyAttendancePage />}
        {currentTab === 'gps-attendance' && <GpsAttendancePage />}
        {currentTab === 'labourers' && <LabourersManagementPage />}
        {currentTab === 'worksites' && <WorksitesPage />}
        {currentTab === 'my-reports' && <MyReportsPage />}
        {currentTab === 'teams' && <TeamsPage />}
        {currentTab === 'weekly-reports' && <WeeklyReportsPage />}
        {currentTab === 'monthly-reports' && <MonthlyReportsPage />}
        {currentTab === 'approvals' && <ApprovalQueuePage />}
        {currentTab === 'payments' && <PaymentTrackerPage />}
        {currentTab === 'attachments' && <AttachmentsPage />}
        {currentTab === 'charges' && <AdditionalChargesPage />}
        {currentTab === 'adjustments' && <AdvancesDeductionsPage />}
        {currentTab === 'staff' && <StaffManagementPage />}
        {currentTab === 'secondary-admins' && <SecondaryAdminPage />}
        {currentTab === 'notifications' && <NotificationsPage />}
        {currentTab === 'audit' && (isAdminAny ? <AuditHistoryPage /> : <DashboardPage onNavigate={handleNavigate} />)}
        {currentTab === 'settings' && (isAdminAny ? <SettingsPage /> : <DashboardPage onNavigate={handleNavigate} />)}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ERPContent />
      </AuthProvider>
    </ToastProvider>
  );
}
