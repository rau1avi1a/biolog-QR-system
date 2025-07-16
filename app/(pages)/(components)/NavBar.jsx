"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/components/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/shadcn/components/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SignInDialog } from '@/app/(pages)/SignInDialog';
import QRScannerModal from '@/app/(pages)/(components)/QRScannerModal';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  RotateCcw,
  FileText,
  User,
  LogOut,
  Menu,
  Bell,
  Settings,
  TestTube,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  ScanLine,
  Shield,
  UserCheck,
  Users
} from 'lucide-react';

// Helper function to get user status badge info
const getUserStatusInfo = (user) => {
  if (!user || !user.role) return null;
  
  const roleConfig = {
    admin: {
      label: 'Admin',
      variant: 'destructive',
      icon: Shield
    },
    manager: {
      label: 'Manager',
      variant: 'default',
      icon: UserCheck
    },
    user: {
      label: 'User',
      variant: 'secondary',
      icon: Users
    },
    moderator: {
      label: 'Moderator',
      variant: 'outline',
      icon: UserCheck
    }
  };

  return roleConfig[user.role.toLowerCase()] || {
    label: user.role,
    variant: 'outline',
    icon: User
  };
};

export default function NavBar({ user, notifications = [], allItems = [] }) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [theme, setTheme] = useState('system');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Define paths where NavBar should be hidden
  const hideNavBarPaths = ['/auth/login'];

  // Get user status info
  const userStatus = getUserStatusInfo(user);

  // Theme handling
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
  }, []);

  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  };

  // Navigation items
  const navigationItems = [
    {
      href: '/home',
      label: 'Home',
      icon: Home,
      description: 'Inventory dashboard'
    },
    {
      href: '/cyclecount',
      label: 'Cycle Count',
      icon: RotateCcw,
      description: 'Inventory counting'
    },
    {
      href: '/files',
      label: 'Files',
      icon: FileText,
      description: 'Document management'
    }
  ];

  // QR Scanner functions
  const handleQRScan = async (qrData) => {
    try {
      // Extract the ID from the URL format: mywebsite/[id]
      let searchId = qrData.trim();
      
      if (searchId.includes('/')) {
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1]; // Get the last part (ID)
      }
      
      // Find item by multiple criteria
      const foundItem = allItems.find(item => {
        const matches = {
          byId: item._id === searchId,
          bySku: item.sku === searchId,
          byLotNumber: item.lotNumber === searchId,
          bySkuLower: item.sku && item.sku.toLowerCase() === searchId.toLowerCase(),
          byLotLower: item.lotNumber && item.lotNumber.toLowerCase() === searchId.toLowerCase(),
          // Search in Lots array
          byLotId: item.Lots && item.Lots.some(lot => lot._id === searchId),
          byLotNumberInArray: item.Lots && item.Lots.some(lot => lot.lotNumber === searchId)
        };
        
        return Object.values(matches).some(m => m);
      });
      
      if (foundItem) {
        // Find the specific lot that matched
        let matchedLot = null;
        if (foundItem.Lots) {
          matchedLot = foundItem.Lots.find(lot => 
            lot._id === searchId || lot.lotNumber === searchId
          );
        }
        
        // Determine how it was matched
        const matchedBy = foundItem._id === searchId ? 'id' :
                         foundItem.sku === searchId ? 'sku' :
                         foundItem.lotNumber === searchId ? 'lotNumber' :
                         matchedLot ? 'lot' : 'fuzzy';
        
        return {
          ...foundItem,
          qrData: qrData,
          matchedBy: matchedBy,
          matchedLot: matchedLot // Include the specific lot info
        };
      }
      
      // If not found, return object with notFound flag
      return { notFound: true, qrData: qrData, searchId: searchId };
      
    } catch (error) {
      console.error('QR Scan error:', error);
      return null;
    }
  };

  const handleItemFound = (result) => {
    if (result && !result.notFound) {
      // Close mobile menu if open
      setIsMobileMenuOpen(false);
    } else if (result && result.notFound) {
      // Item not found - modal will show error
    }
  };

  // If the current path is in hideNavBarPaths, do not render NavBar
  if (hideNavBarPaths.includes(pathname)) {
    return null;
  }

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth?action=logout', {
        method: 'POST',
      });
  
      if (!res.ok) throw new Error('Failed to logout');
      
      // Redirect to login page or home page
      router.push('/auth/login'); // or '/' if you prefer
    } catch (error) {
      console.error('Logout failed:', error);
      // Optionally show user-friendly error message
      alert('Failed to logout. Please try again.');
    }
  };

  const isActivePath = (path) => pathname === path;

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Left side - Mobile Menu + Logo/Brand */}
            <div className="flex items-center space-x-4">
              {/* Mobile Menu - MOVED TO LEFT */}
              <div className="md:hidden">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>
                        <VisuallyHidden>Navigation Menu</VisuallyHidden>
                      </SheetTitle>
                    </SheetHeader>
                    
                    <div className="flex flex-col space-y-4 mt-8">
                      {/* Mobile Brand */}
                      <div className="flex items-center space-x-2 px-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TestTube className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold">Biolog QR</h2>
                          <p className="text-xs text-muted-foreground">Laboratory System</p>
                        </div>
                      </div>

                      {/* QR Scanner Button - MOBILE ONLY */}
                      <div className="px-2">
                        <Button
                          onClick={() => {
                            setQrScannerOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <ScanLine className="h-4 w-4 mr-2" />
                          Scan QR Code
                        </Button>
                      </div>

                      {/* Mobile Navigation */}
                      <div className="space-y-2">
                        {navigationItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = isActivePath(item.href);
                          
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                              <div>
                                <p className="font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Mobile User Section */}
                      {user && (
                        <div className="pt-4 border-t">
                          <div className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              {userStatus && (
                                <Badge variant={userStatus.variant} className="text-xs">
                                  <userStatus.icon className="h-3 w-3 mr-1" />
                                  {userStatus.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 mt-2">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <User className="h-4 w-4 mr-2" />
                              Profile
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-destructive"
                              onClick={() => {
                                handleLogout();
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Sign Out
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Logo/Brand */}
              <Link href="/home" className="flex items-center space-x-2 group">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <TestTube className="h-5 w-5 text-primary" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-semibold">Biolog QR</h1>
                  <p className="text-xs text-muted-foreground -mt-1">Laboratory System</p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right side - User actions */}
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  {/* Notifications */}
                  {notifications.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="relative">
                          <Bell className="h-4 w-4" />
                          {unreadNotifications > 0 && (
                            <Badge
                              variant="destructive"
                              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                            >
                              {unreadNotifications > 9 ? '9+' : unreadNotifications}
                            </Badge>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notifications.slice(0, 5).map((notification, index) => (
                          <DropdownMenuItem key={index} className="flex flex-col items-start p-3">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                          </DropdownMenuItem>
                        ))}
                        {notifications.length === 0 && (
                          <DropdownMenuItem className="text-center text-muted-foreground">
                            No notifications
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Theme Selector */}
                  {mounted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {theme === 'light' && <Sun className="h-4 w-4" />}
                          {theme === 'dark' && <Moon className="h-4 w-4" />}
                          {theme === 'system' && <Monitor className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Theme</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => applyTheme('light')}>
                          <Sun className="h-4 w-4 mr-2" />
                          Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyTheme('dark')}>
                          <Moon className="h-4 w-4 mr-2" />
                          Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyTheme('system')}>
                          <Monitor className="h-4 w-4 mr-2" />
                          System
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-2 px-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="hidden sm:block text-left">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium leading-none">{user.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                            </div>
                            {userStatus && (
                              <Badge variant={userStatus.variant} className="text-xs">
                                <userStatus.icon className="h-3 w-3 mr-1" />
                                {userStatus.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {userStatus && (
                            <Badge variant={userStatus.variant} className="text-xs ml-2">
                              <userStatus.icon className="h-3 w-3 mr-1" />
                              {userStatus.label}
                            </Badge>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button onClick={() => setIsSignInOpen(true)}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* <SignInDialog
          open={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
        /> */}
      </nav>

      {/* QR Scanner Modal */}
      <QRScannerModal
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onScan={handleQRScan}
        onItemFound={handleItemFound}
      />
    </>
  );
}