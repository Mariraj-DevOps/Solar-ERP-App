import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { TopWaveHeader } from './components/TopWaveHeader';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DailyAttendancePage } from './pages/DailyAttendancePage';
import { WeeklyReportsPage } from './pages/WeeklyReportsPage';
import { MonthlyReportsPage } from './pages/MonthlyReportsPage';
import { TeamsPage } from './pages/TeamsPage';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { PaymentTrackerPage } from './pages/PaymentTrackerPage';
import { AttachmentsPage } from './pages/AttachmentsPage';
import { AdditionalChargesPage } from './pages/AdditionalChargesPage';
import { AdvancesDeductionsPage } from './pages/AdvancesDeductionsPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { SecondaryAdminPage } from './pages/SecondaryAdminPage';
import { MyReportsPage } from './pages/MyReportsPage';
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
  const tabHistoryRef = useRef<NavTab[]>(['dashboard']);

  // Scroll monitor for iPhone-style duo blur fades (fade in on scroll, fade out at edges)
  const [showTopBlur, setShowTopBlur] = useState(false);
  const [showBottomBlur, setShowBottomBlur] = useState(true);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const windowHeight = window.innerHeight;
          const docHeight = document.documentElement.scrollHeight;

          // Top blur: fades in when scrolled down > 10px, fades out at the very top
          setShowTopBlur(scrollY > 10);

          // Bottom blur: fades in while scrolling, fades out when reaching the bottom (within 25px)
          const isAtBottom = scrollY + windowHeight >= docHeight - 25;
          setShowBottomBlur(!isAtBottom);

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [currentTab]);

  const handleNavigate = (tab: NavTab, params?: any, pushHistory = true) => {
    if (params) setNavParams(params);
    if (tab === currentTab) return;

    if (pushHistory) {
      tabHistoryRef.current.push(tab);
      try {
        window.history.pushState({ tab, params }, '', `#${tab}`);
      } catch (e) {
        // Fallback if pushState fails in certain webviews
      }
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (tabHistoryRef.current.length > 1) {
      tabHistoryRef.current.pop(); // remove current tab
      const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1];
      setCurrentTab(prevTab);
      try {
        window.history.replaceState({ tab: prevTab }, '', `#${prevTab}`);
      } catch (e) {}
    } else {
      // Default return to dashboard if stack is empty
      setCurrentTab('dashboard');
      tabHistoryRef.current = ['dashboard'];
      try {
        window.history.replaceState({ tab: 'dashboard' }, '', '#dashboard');
      } catch (e) {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mobile Back Button: Intercept browser back & Android device back button
  useEffect(() => {
    try {
      window.history.replaceState({ tab: 'dashboard' }, '', '#dashboard');
    } catch (e) {}

    const onPopState = (e: PopStateEvent) => {
      if (tabHistoryRef.current.length > 1) {
        tabHistoryRef.current.pop();
        const targetTab = tabHistoryRef.current[tabHistoryRef.current.length - 1] || 'dashboard';
        setCurrentTab(targetTab);
      } else {
        setCurrentTab('dashboard');
      }
    };

    window.addEventListener('popstate', onPopState);

    // Support for React Native / Android WebView bridge events
    const onBridgeMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'HARDWARE_BACK_PRESS' || data?.type === 'BACK_BUTTON_PRESSED') {
          if (tabHistoryRef.current.length > 1) {
            handleBack();
            // Inform container that back was consumed inside app
            if ((window as any).ReactNativeWebView?.postMessage) {
              (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'HANDLED_BACK' }));
            }
          }
        }
      } catch (e) {}
    };

    window.addEventListener('message', onBridgeMessage);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('message', onBridgeMessage);
    };
  }, []);

  // Dynamic document title update based on current section
  useEffect(() => {
    const titles: Record<NavTab, string> = {
      dashboard: 'Executive Dashboard',
      attendance: 'Daily Attendance Muster',
      'gps-attendance': 'GPS Attendance Queue',
      labourers: 'Labourer Accounts',
      worksites: 'Worksites & Geofences',
      'weekly-reports': 'Weekly Reports',
      'monthly-reports': 'Monthly Reports',
      'my-reports': 'My Workspace',
      teams: 'Teams & Templates',
      approvals: 'Approval Queue',
      payments: 'Weekly Payment Tracker',
      attachments: 'Document Vault',
      charges: 'Additional Charges',
      adjustments: 'Advances & Deductions',
      staff: 'Staff Management',
      'secondary-admins': 'Operations Managers',
      notifications: 'Notifications',
      audit: 'Audit Trails',
      settings: 'System Settings',
    };
    document.title = `${titles[currentTab] || 'Dashboard'} | Solar Designs ERP`;
  }, [currentTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#2D6043] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-[#0B3522]">Loading Solar ERP Workspace...</p>
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 shadow-md">
        <TopWaveHeader
          title="Solar Designs Pvt Ltd"
          subtitle="Labour Attendance ERP"
          showBack={currentTab !== 'dashboard'}
          onBack={handleBack}
        />
      </header>

      {/* Top Duo Blur Fade (iPhone-style feathered blur fade below top header: fades in on scroll, fades out at top) */}
      <div
        className={`md:hidden fixed left-0 right-0 z-20 pointer-events-none transition-opacity duration-300 ease-out top-[58px] h-8 ${
          showTopBlur ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'linear-gradient(to bottom, rgba(238, 229, 212, 0.92) 0%, rgba(238, 229, 212, 0.35) 65%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 25%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 25%, transparent 100%)',
        }}
      />

      {/* Bottom Duo Blur Fade (iPhone-style feathered blur fade above bottom nav: fades in on scroll, fades out at bottom) */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 z-35 pointer-events-none transition-opacity duration-300 ease-out h-24 sm:h-28 ${
          showBottomBlur ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          background: 'linear-gradient(to top, rgba(238, 229, 212, 0.98) 0%, rgba(238, 229, 212, 0.7) 45%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
        }}
      />

      {/* Main content container with top padding matching header height */}
      <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pt-[74px] md:pt-4 pb-28 md:pb-12">
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
        {currentTab === 'audit' && <AuditHistoryPage />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ERPContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
