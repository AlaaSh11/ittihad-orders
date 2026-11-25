import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, isWithinWorkingHours, minutesUntilShopClose, logout, subscribeToAuth } from './lib/auth';
import { syncOfflineQueue } from './lib/ordersStore';
import LoginView from './views/LoginView';
import OrderFormView from './views/OrderFormView';
import OrderHistoryView from './views/OrderHistoryView';
import FactoryView from './views/FactoryView';
import FactoryOversightView from './views/FactoryOversightView';
import DailyReportView from './views/DailyReportView';
import { ENABLE_FACTORY_SYSTEM } from './constants/featureFlags';
import Modal from './components/ui/Modal';

function defaultViewFor(user) {
  if (user?.role === 'boss')    return 'oversight';
  if (user?.role === 'cashier') return 'history';
  if (user?.role === 'factory') return 'factory';
  return 'form';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [shiftAlert, setShiftAlert] = useState(false);
  const [closingWarning, setClosingWarning] = useState(null); // minutes left before 22:00
  const closingWarnedRef = useRef(false);
  const [currentView, setCurrentView] = useState(() => defaultViewFor(getCurrentUser())); // 'form' | 'history' | 'factory' | 'oversight'
  const [editingOrder, setEditingOrder] = useState(null); // null = new order mode

  // Re-validate the cached session against Firebase Auth: the role always
  // comes from the verified ID token claim, never from localStorage.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  useEffect(() => {
    return subscribeToAuth((verifiedUser) => {
      const prev = currentUserRef.current;
      if (prev?.username !== verifiedUser?.username || prev?.role !== verifiedUser?.role) {
        setCurrentView(defaultViewFor(verifiedUser));
        setEditingOrder(null);
      }
      setCurrentUser(verifiedUser);
    });
  }, []);

  // Automatic Offline Queue Sync (on app load and whenever internet reconnects)
  useEffect(() => {
    syncOfflineQueue();
    const handleOnline = () => syncOfflineQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Real-time Working Hours Enforcement (Checks clock every 30 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const checkHours = () => {
      // Warn once, 15 minutes before the automatic logout, so open orders get saved.
      const left = minutesUntilShopClose(currentUser.role);
      if (left !== null && left <= 15 && !closingWarnedRef.current) {
        closingWarnedRef.current = true;
        setClosingWarning(left);
      }
      if (!isWithinWorkingHours(currentUser.role)) {
        logout().then(() => {
          setCurrentUser(null);
          setCurrentView('form');
          setEditingOrder(null);
          setShiftAlert(true);
        });
      }
    };
    checkHours();
    const timer = setInterval(checkHours, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogin = (user) => {
    closingWarnedRef.current = false; // warn again on the next working day
    setCurrentUser(user);
    setCurrentView(defaultViewFor(user));
  };

  const handleLogout = () => {
    // Always end the Firebase session too (some views only call onLogout).
    logout();
    setCurrentUser(null);
    setCurrentView('form');
    setEditingOrder(null);
  };

  // Navigation handlers
  const goToHistory = () => {
    setCurrentView('history');
    setEditingOrder(null);
  };

  const goToFactory = () => {
    setCurrentView('factory');
    setEditingOrder(null);
  };

  const goToReport = () => {
    if (currentUser?.role !== 'admin') return;
    setCurrentView('report');
    setEditingOrder(null);
  };

  const goToNewOrder = () => {
    if (currentUser?.role === 'cashier' || currentUser?.role === 'factory') return; 
    setCurrentView('form');
    setEditingOrder(null);
  };

  const goToEditOrder = (order) => {
    if (currentUser?.role === 'cashier' || currentUser?.role === 'factory') return; 
    setEditingOrder(order);
    setCurrentView('form');
  };

  if (!currentUser) {
    return (
      <>
        <LoginView onLogin={handleLogin} />
        <Modal
          isOpen={shiftAlert}
          type="alert"
          title="⏰ ساعات العمل الرسمية"
          message="انتهت ساعات العمل الرسمية (10:00 مساءً). تم تسجيل الخروج تلقائياً وفقاً للسياسة المعتمدة."
          confirmText="حسناً"
          onConfirm={() => setShiftAlert(false)}
          onCancel={() => setShiftAlert(false)}
        />
      </>
    );
  }

  const isCashier = currentUser.role === 'cashier';
  const isFactory = currentUser.role === 'factory';
  const isBoss    = currentUser.role === 'boss';

  let screen;
  if (isBoss || currentView === 'oversight') {
    // Boss role: read-only production oversight — routed before all other views
    screen = <FactoryOversightView currentUser={currentUser} onLogout={handleLogout} />;
  } else if (currentUser.role === 'admin' && currentView === 'report') {
    // Admin-only daily money report
    screen = <DailyReportView onBack={goToHistory} onLogout={handleLogout} />;
  } else if (ENABLE_FACTORY_SYSTEM && (isFactory || currentView === 'factory')) {
    // Factory role is directed exclusively to the Kitchen Display System (KDS) when feature is enabled
    screen = (
      <FactoryView
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchToHistory={!isFactory ? goToHistory : null}
      />
    );
  } else if (isCashier || isFactory || currentView === 'history') {
    // Cashiers (and factory accounts when KDS is disabled) are directed to the Order History dashboard
    screen = (
      <OrderHistoryView
        currentUser={currentUser}
        onLogout={handleLogout}
        onNewOrder={!isCashier && !isFactory ? goToNewOrder : null}
        onEditOrder={!isCashier && !isFactory ? goToEditOrder : null}
        onFactory={!isCashier ? goToFactory : null}
        onReport={currentUser.role === 'admin' ? goToReport : null}
      />
    );
  } else {
    screen = (
      <OrderFormView
        currentUser={currentUser}
        onLogout={handleLogout}
        onHistory={goToHistory}
        onFactory={goToFactory}
        editingOrder={editingOrder}
        onCancelEdit={goToNewOrder}
      />
    );
  }

  return (
    <>
      {screen}
      <Modal
        isOpen={closingWarning !== null}
        type="alert"
        title="⏰ اقتراب نهاية ساعات العمل"
        message={`سيتم تسجيل الخروج تلقائياً الساعة 10:00 مساءً (بعد ${closingWarning ?? ''} دقيقة).\nيرجى حفظ أي طلبية مفتوحة الآن حتى لا تضيع.`}
        confirmText="حسناً"
        onConfirm={() => setClosingWarning(null)}
        onCancel={() => setClosingWarning(null)}
      />
    </>
  );
}
