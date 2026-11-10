import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { TopWaveHeader } from './TopWaveHeader';

// Official Solar Icons Pack
import { HomeIcon } from '@solar-icons/react/bold/home';
import { WidgetIcon } from '@solar-icons/react/bold/widget';
import { CalendarDateIcon } from '@solar-icons/react/bold/calendar-date';
import { CalendarMarkIcon } from '@solar-icons/react/bold/calendar-mark';
import { CheckCircleIcon } from '@solar-icons/react/bold/check-circle';
import { DocumentTextIcon } from '@solar-icons/react/bold/document-text';
import { MapPointIcon } from '@solar-icons/react/bold/map-point';
import { UsersGroupRoundedIcon } from '@solar-icons/react/bold/users-group-rounded';
import { BuildingsIcon } from '@solar-icons/react/bold/buildings';
import { CardIcon } from '@solar-icons/react/bold/card';
import { UserHandsIcon } from '@solar-icons/react/bold/user-hands';
import { PaperclipIcon } from '@solar-icons/react/bold/paperclip';
import { UserCheckIcon } from '@solar-icons/react/bold/user-check';
import { UserSpeakIcon } from '@solar-icons/react/bold/user-speak';
import { BellIcon } from '@solar-icons/react/bold/bell';
import { HistoryIcon } from '@solar-icons/react/bold/history';
import { SettingsIcon } from '@solar-icons/react/bold/settings';
import { Logout2Icon } from '@solar-icons/react/bold/logout-2';
import { MenuDotsIcon } from '@solar-icons/react/bold/menu-dots';
import { CardReceiveIcon } from '@solar-icons/react/bold/card-receive';
import { CardSendIcon } from '@solar-icons/react/bold/card-send';
import { AltArrowDownIcon } from '@solar-icons/react/bold/alt-arrow-down';
import { AltArrowLeftIcon } from '@solar-icons/react/bold/alt-arrow-left';

export type NavTab =
  | 'dashboard'
  | 'attendance'
  | 'gps-attendance'
  | 'labourers'
  | 'worksites'
  | 'my-reports'
  | 'teams'
  | 'weekly-reports'
  | 'monthly-reports'
  | 'approvals'
  | 'payments'
  | 'attachments'
  | 'charges'
  | 'adjustments'
  | 'staff'
  | 'secondary-admins'
  | 'notifications'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface NavItemDef {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
  masterAdminOnly?: boolean;
  staffOnly?: boolean;
}

interface NavCategory {
  id: string;
  name: string;
  items: NavItemDef[];
}

export function Sidebar({ currentTab, onTabChange, onCollapsedChange }: SidebarProps) {
  const { user, logout, isMasterAdmin, isSecondaryAdmin, isAdminAny, isStaff } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      return next;
    });
  };

  /* ---------------- Counter polling ---------------- */
  useEffect(() => {
    let isMounted = true;
    const fetchCounters = async () => {
      try {
        const notifRes = await api.notifications.list();
        if (isMounted) setUnreadNotifs(notifRes.unreadCount || 0);

        if (isAdminAny) {
          if (isMasterAdmin) {
            const queue = await api.admin.getQueue();
            if (isMounted) setPendingApprovals(queue.totalPending || 0);
          } else {
            const queue = await api.attendance.getQueue().catch(() => []);
            if (isMounted && Array.isArray(queue)) {
              setPendingApprovals(queue.length);
            }
          }
        }
      } catch {}
    };
    fetchCounters();
    const interval = setInterval(fetchCounters, 25000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdminAny, isMasterAdmin]);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  /* ---------------- Navigation data (Official Solar Icons) ---------------- */
  const navCategories: NavCategory[] = [
    {
      id: 'overview',
      name: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <WidgetIcon size={20} /> },
        { id: 'my-reports', label: 'My Workspace', icon: <DocumentTextIcon size={20} /> },
      ],
    },
    {
      id: 'operations',
      name: 'Operations',
      items: [
        { id: 'attendance', label: 'Daily Attendance', icon: <CalendarDateIcon size={20} /> },
        {
          id: 'approvals',
          label: 'Approval Queue',
          icon: <CheckCircleIcon size={20} />,
          badge: pendingApprovals,
          adminOnly: true,
        },
        { id: 'weekly-reports', label: 'Weekly Reports', icon: <DocumentTextIcon size={20} /> },
        { id: 'monthly-reports', label: 'Monthly Reports', icon: <CalendarMarkIcon size={20} /> },
        { id: 'payments', label: 'Payment Tracker', icon: <CardIcon size={20} /> },
      ],
    },
    {
      id: 'gps-geofence',
      name: 'GPS & Field Attendance',
      items: [
        { id: 'gps-attendance', label: 'GPS Attendance Queue', icon: <MapPointIcon size={20} /> },
        { id: 'labourers', label: 'Labourer Accounts', icon: <UsersGroupRoundedIcon size={20} /> },
        { id: 'worksites', label: 'Worksites & Geofences', icon: <BuildingsIcon size={20} /> },
      ],
    },
    {
      id: 'admin',
      name: 'Administration',
      items: [
        { id: 'teams', label: 'Teams & Templates', icon: <UserHandsIcon size={20} /> },
        { id: 'charges', label: 'Additional Charges', icon: <CardReceiveIcon size={20} /> },
        { id: 'adjustments', label: 'Advances & Deductions', icon: <CardSendIcon size={20} /> },
        { id: 'attachments', label: 'Document Vault', icon: <PaperclipIcon size={20} /> },
      ],
    },
    {
      id: 'system',
      name: 'System & Security',
      items: [
        {
          id: 'staff',
          label: 'Staff Management',
          icon: <UserCheckIcon size={20} />,
          adminOnly: true,
        },
        {
          id: 'secondary-admins',
          label: 'Manager Scopes',
          icon: <UserSpeakIcon size={20} />,
          masterAdminOnly: true,
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: <BellIcon size={20} />,
          badge: unreadNotifs,
        },
        { id: 'audit', label: 'Audit History', icon: <HistoryIcon size={20} />, adminOnly: true },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} />, adminOnly: true },
      ],
    },
  ];

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  /* ---------------- Logo Spin on Pointer Enter ---------------- */
  const markRef = useRef<HTMLDivElement>(null);
  const spinLogo = (e: React.PointerEvent) => {
    const mark = markRef.current;
    if (!mark || e.pointerType === 'touch' || mark.getAnimations().length) return;
    mark.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: 900,
      easing: 'cubic-bezier(0.65, 0, 0.25, 1)',
    });
  };

  /* ---------------- Mobile Bottom Nav Items ---------------- */
  interface MobileNavItem {
    id: NavTab | 'more_menu';
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }
  const mobileNavItems: MobileNavItem[] = [
    { id: 'dashboard', label: 'Home', icon: <HomeIcon size={22} /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarDateIcon size={22} /> },
    { id: 'gps-attendance', label: 'GPS', icon: <MapPointIcon size={22} /> },
    { id: 'payments', label: 'Payments', icon: <CardIcon size={22} /> },
    {
      id: 'more_menu',
      label: 'More',
      icon: <MenuDotsIcon size={22} />,
      badge: pendingApprovals > 0 ? pendingApprovals : undefined,
    },
  ];

  return (
    <>
      {/* 1. Desktop & Tablet Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-gradient-to-b from-[#184F34] via-[#113C27] to-[#0A2E1D] border-r border-[#1B5639]/40 text-white/90 shrink-0 select-none z-30 transition-[width] duration-300 ease-in-out overflow-hidden shadow-xl ${
          isCollapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between relative min-h-[57px] bg-white/[0.03]">
          {!isCollapsed ? (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div
                ref={markRef}
                onPointerEnter={spinLogo}
                className="w-9 h-9 rounded-2xl bg-white keep-white p-1 border border-white/20 shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
                title="Solar Designs (Hover to spin)"
              >
                <img
                  src="/assets/aistudio/solar_designs_clean_logo_bf464b07.png"
                  alt="Logo"
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white tracking-tight leading-tight truncate">
                  Solar Designs Pvt Ltd
                </div>
                <div className="text-[10px] text-emerald-300/80 leading-tight">Labour ERP</div>
              </div>
            </div>
          ) : (
            <div
              ref={markRef}
              onPointerEnter={spinLogo}
              className="w-9 h-9 rounded-2xl bg-white keep-white p-1 border border-white/20 shadow-xs flex items-center justify-center mx-auto cursor-pointer"
              title="Solar Designs (Hover to spin)"
            >
              <img
                src="/assets/aistudio/solar_designs_clean_logo_bf464b07.png"
                alt="Logo"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          )}

          {/* Toggle collapse button */}
          <button
            onClick={toggleCollapse}
            className={`p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              isCollapsed ? 'absolute bottom-1 right-1' : ''
            }`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <span className={`inline-block transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
              <AltArrowLeftIcon size={18} />
            </span>
          </button>
        </div>

        {/* User Card (expanded only) */}
        {user && !isCollapsed && (
          <div className="mx-3 my-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs flex items-center px-3 py-2.5 transition-all shadow-xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#2D6043] border border-white/25 flex items-center justify-center text-white shrink-0 font-bold text-xs shadow-xs">
                {user.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-emerald-200/90 flex items-center space-x-1.5 mt-0.5 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  <span className="capitalize truncate">
                    {user.role === 'master_admin'
                      ? 'Master Admin'
                      : user.role === 'secondary_admin'
                      ? 'Operations Manager'
                      : 'Staff Workspace'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categorized Navigation List */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-3 no-scrollbar relative">
          {navCategories.map((category) => {
            const visibleItems = category.items.filter((item) => {
              if (item.masterAdminOnly && !isMasterAdmin) return false;
              if (item.adminOnly && !isAdminAny) return false;
              if (item.staffOnly && !isStaff) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;
            const isCatCollapsed = Boolean(collapsedCategories[category.id]);

            return (
              <div key={category.id} className="space-y-1">
                {!isCollapsed && (
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-emerald-200/75 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>{category.name}</span>
                    <span
                      className={`inline-block transition-transform duration-200 ${
                        isCatCollapsed ? '-rotate-90' : 'rotate-0'
                      }`}
                    >
                      <AltArrowDownIcon size={14} />
                    </span>
                  </button>
                )}

                <div className={isCollapsed || !isCatCollapsed ? 'space-y-0.5' : 'space-y-0.5 hidden'}>
                  {visibleItems.map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                      <div key={item.id} className="relative group">
                        <button
                          onClick={() => handleSelectTab(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer relative z-10 ${
                            isActive
                              ? 'text-white font-semibold'
                              : 'text-white/85 hover:text-white hover:bg-white/12'
                          } ${isCollapsed ? 'justify-center' : ''}`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="sidebarActivePill"
                              transition={{
                                type: 'spring',
                                stiffness: 380,
                                damping: 28,
                                bounce: 0.3,
                              }}
                              className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#2D6043] to-[#205035] ring-1 ring-white/20 shadow-md z-0"
                            />
                          )}

                          <div className="flex items-center space-x-2.5 min-w-0 relative z-10">
                            <span className={isActive ? 'text-white' : 'text-emerald-200/90'}>
                              {item.icon}
                            </span>
                            {!isCollapsed && (
                              <span className="truncate whitespace-nowrap">
                                {item.label}
                              </span>
                            )}
                          </div>

                          {!isCollapsed && item.badge && item.badge > 0 ? (
                            <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-bold relative z-10">
                              {item.badge}
                            </span>
                          ) : null}

                          {isActive && !isCollapsed && (
                            <motion.span
                              layoutId="sidebarActiveDot"
                              transition={{
                                type: 'spring',
                                stiffness: 450,
                                damping: 30,
                              }}
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 relative z-10 ml-1.5"
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-white/10 bg-white/[0.02]">
          <button
            onClick={logout}
            className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/12 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <Logout2Icon size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* 2. Mobile Full Menu Modal (Exactly matching Image 2) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#EEE5D4] overflow-hidden"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Top Wave Header matching Image 2 */}
            <TopWaveHeader
              title="Solar Designs Pvt Ltd"
              subtitle="Full Menu"
              showClose={true}
              onClose={() => setMobileMenuOpen(false)}
            />

            {/* Scrollable Menu Items on #EEE5D4 */}
            <div className="flex-1 overflow-y-auto px-4 pt-1 pb-24 space-y-4 no-scrollbar">
              {/* User Profile Card */}
              {user && (
                <div className="rounded-2xl bg-[#FAF7F0] border border-[#E8DFD0] p-3 sm:p-3.5 shadow-xs flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0B3522] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      {user.fullName?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0B3522] truncate">
                        {user.fullName || 'ERP Administrator'}
                      </div>
                      <div className="text-xs text-[#526659] flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span className="truncate">
                          {user.role === 'master_admin'
                            ? 'Master Admin'
                            : user.role === 'secondary_admin'
                            ? 'Operations Manager'
                            : 'Staff Workspace'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rose Tinted Sign Out Button */}
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EEDCDA] hover:bg-[#E6D1CF] text-[#8C3A36] text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                  >
                    <Logout2Icon size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}

              {/* Categorized Menu Items */}
              {navCategories.map((cat) => {
                const visible = cat.items.filter((item) => {
                  if (item.masterAdminOnly && !isMasterAdmin) return false;
                  if (item.adminOnly && !isAdminAny) return false;
                  if (item.staffOnly && !isStaff) return false;
                  return true;
                });
                if (visible.length === 0) return null;

                const isOverview = cat.id === 'overview';

                return (
                  <div key={cat.id} className="space-y-2.5">
                    {/* Category Header with Horizontal Divider Line */}
                    <div className="flex items-center space-x-3 pt-1">
                      <span className="text-xs font-bold text-[#3B4D40] uppercase tracking-wider">
                        {cat.name}
                      </span>
                      <div className="flex-1 border-b border-[#D8CDBA]" />
                    </div>

                    {/* Cards Grid: 2 columns for Overview, 3 columns for others */}
                    <div className={isOverview ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5'}>
                      {visible.map((item) => {
                        const isActive = currentTab === item.id;
                        const isApprovalQueue = item.id === 'approvals';

                        if (isActive) {
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelectTab(item.id)}
                              className="bg-[#2D6043] text-white rounded-2xl py-4 px-3 flex flex-col items-center justify-center shadow-md cursor-pointer active:scale-95 transition-all text-center"
                            >
                              <div className="w-6 h-6 flex items-center justify-center text-white">
                                {item.icon}
                              </div>
                              <span className="text-xs font-semibold text-white mt-2 leading-tight">
                                {item.label}
                              </span>
                            </button>
                          );
                        }

                        if (isApprovalQueue) {
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelectTab(item.id)}
                              className="bg-[#DDE8E0] border border-[#C8DACF] rounded-2xl py-3 px-2 flex flex-col items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all text-center"
                            >
                              <span className="text-xs font-bold text-[#0B3522] leading-none mb-1">
                                {item.badge || 0}
                              </span>
                              <div className="w-5 h-5 flex items-center justify-center text-[#0B3522]">
                                <CheckCircleIcon size={20} />
                              </div>
                              <span className="text-xs font-semibold text-[#0B3522] mt-1 leading-tight">
                                {item.label}
                              </span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTab(item.id)}
                            className="bg-[#FAF7F0] border border-[#E8DFD0] rounded-2xl py-3.5 px-2.5 flex flex-col items-center justify-center shadow-xs hover:bg-white cursor-pointer active:scale-95 transition-all text-center relative"
                          >
                            {item.badge && item.badge > 0 ? (
                              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-[#184F34] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                                {item.badge}
                              </span>
                            ) : null}
                            <div className="w-6 h-6 flex items-center justify-center text-[#3D5A47]">
                              {item.icon}
                            </div>
                            <span className="text-xs font-semibold text-[#1C3829] mt-2 leading-tight">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Mobile Bottom Nav Bar (Exactly matching Image 1) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <div className="bg-[#0B3522] rounded-[30px] px-2 py-1.5 flex items-center justify-around shadow-2xl border border-[#14472F]/50">
          {mobileNavItems.map((item) => {
            const isActive = currentTab === item.id || (item.id === 'more_menu' && mobileMenuOpen);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'more_menu') {
                    setMobileMenuOpen(true);
                  } else {
                    handleSelectTab(item.id as NavTab);
                  }
                }}
                className="flex-1 min-w-0 flex items-center justify-center focus:outline-none cursor-pointer"
                aria-label={item.label}
              >
                {isActive ? (
                  /* Active capsule pill matching Image 1 Home */
                  <div className="bg-[#184F34] px-4 py-1.5 rounded-2xl flex flex-col items-center justify-center text-white shadow-inner min-w-[62px]">
                    <span className="text-white">{item.icon}</span>
                    <span className="text-[10px] font-semibold text-white mt-0.5 leading-none">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  /* Inactive item */
                  <div className="px-3 py-1.5 flex flex-col items-center justify-center text-white/70 hover:text-white transition-colors">
                    <div className="relative">
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                      )}
                      <span>{item.icon}</span>
                    </div>
                    <span className="text-[10px] font-medium text-white/70 mt-0.5 leading-none">
                      {item.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default Sidebar;
