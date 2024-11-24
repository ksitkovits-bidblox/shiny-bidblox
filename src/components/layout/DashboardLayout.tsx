import React, { ReactNode } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Bell,
  FileText,
  Library as LibraryIcon,
  User as UserIcon,
  ScrollText,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/library', icon: LibraryIcon, label: 'Library' },
    { path: '/bid', icon: FileText, label: 'Bids' },
    { path: '/proposals', icon: ScrollText, label: 'Proposals' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleProfileClick = () => {
    // Navigate to the profile tab in settings
    navigate('/settings', { state: { defaultTab: 'profile' } });
  };

  const handleSettingsClick = () => {
    // Navigate to settings page with settings tab active
    navigate('/settings', { state: { defaultTab: 'settings' } });
  };

  const handleNotificationClick = (notification: any) => {
    // Handle notification clicks based on type
    switch (notification.type) {
      case 'message':
        navigate('/messages');
        break;
      case 'proposal':
        navigate('/proposals');
        break;
      default:
        console.log('Unhandled notification type:', notification.type);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-full bg-white border-r border-gray-200 p-4">
        {/* Logo/Brand */}
        <div className="flex items-center mb-8 px-2">
          <Link to="/dashboard" className="hover:opacity-80 transition-opacity">
            <img 
              src="/logo.jpg"
              alt="BidBlox Logo" 
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2">
          {navigationItems.map(({ path, icon: Icon, label }) => (
            <Button 
              key={path}
              variant="ghost" 
              className={`w-full justify-start transition-colors ${
                isActive(path) 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'hover:bg-primary-50 hover:text-primary-600'
              }`}
              asChild
            >
              <Link to={path} className="flex items-center space-x-3">
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </Button>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <div></div>
          <div className="flex items-center space-x-4">
            {/* User Info */}
            <span className="text-sm text-gray-600 mr-2">
              {user?.email}
            </span>

            {/* Notifications 
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNotificationClick({ type: 'message' })}>
                  New message received
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNotificationClick({ type: 'proposal' })}>
                  Proposal update
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>*/}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <UserIcon className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleProfileClick}>
                  <UserIcon className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSettingsClick}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;