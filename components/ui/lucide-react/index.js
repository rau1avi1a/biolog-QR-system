// components/lucide-react/index.js - Unified Lucide Icons with Lazy Loading
// Usage: import { lucide } from '@/components/lucide-react'
// Then: <lucide.Search />, <lucide.Plus />, etc.

class LucideIcons {
    // Cache for loaded icons
    _cache = new Map();
  
    // Lazy getter helper
    _createGetter(iconName) {
      return {
        get() {
          if (!this._cache.has(iconName)) {
            try {
              const icon = require(`lucide-react`)[iconName];
              if (!icon) {
                console.warn(`Lucide icon "${iconName}" not found`);
                return null;
              }
              this._cache.set(iconName, icon);
            } catch (error) {
              console.error(`Error loading Lucide icon "${iconName}":`, error);
              return null;
            }
          }
          return this._cache.get(iconName);
        },
        configurable: true
      };
    }
  
    constructor() {
      // Define all commonly used icons as lazy getters
      const icons = [
        // Navigation & Actions
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown',
        'Plus', 'Minus', 'X', 'Check', 'Trash2', 'Edit', 'Save',
        'Download', 'Upload', 'Copy', 'ExternalLink', 'MoreHorizontal',
        'MoreVertical', 'Menu', 'Settings', 'Refresh', 'RotateCcw',
        
        // Content & Media
        'Search', 'Filter', 'SortAsc', 'SortDesc', 'Eye', 'EyeOff',
        'FileText', 'File', 'Folder', 'FolderOpen', 'Image', 'Video',
        'Music', 'Paperclip', 'Link', 'Hash', 'Calendar', 'Clock',
        
        // Status & Alerts
        'AlertTriangle', 'AlertCircle', 'Info', 'CheckCircle', 'XCircle',
        'HelpCircle', 'Loader2', 'Zap', 'Star', 'Heart', 'Bookmark',
        'Flag', 'Shield', 'Lock', 'Unlock', 'Key',
        
        // Science & Lab
        'FlaskRound', 'Flask', 'Beaker', 'Microscope', 'Atom',
        'Activity', 'BarChart3', 'PieChart', 'TrendingUp',
        'Package', 'Package2', 'Boxes', 'Archive', 'Database',
        
        // Business & Commerce
        'ShoppingCart', 'CreditCard', 'DollarSign', 'TrendingUp',
        'BarChart', 'LineChart', 'Target', 'Award', 'Briefcase',
        
        // Communication
        'Mail', 'Phone', 'MessageSquare', 'Send', 'Share', 'Bell',
        'BellOff', 'Users', 'User', 'UserPlus', 'UserMinus',
        
        // System & Tech
        'Server', 'Monitor', 'Smartphone', 'Tablet', 'Laptop',
        'Wifi', 'WifiOff', 'Bluetooth', 'Usb', 'HardDrive',
        'Cloud', 'CloudDownload', 'CloudUpload', 'Globe',
        
        // Layout & Design
        'Layout', 'Sidebar', 'PanelLeft', 'PanelRight', 'Maximize',
        'Minimize', 'Square', 'Circle', 'Triangle', 'Grid',
        'List', 'Columns', 'Rows', 'AlignLeft', 'AlignCenter',
        'AlignRight', 'AlignJustify',
        
        // Tools & Utilities
        'Wrench', 'Hammer', 'Screwdriver', 'Gauge', 'Ruler',
        'Calculator', 'Code', 'Terminal', 'Bug', 'Cpu',
        
        // Additional useful icons
        'Sun', 'Moon', 'Home', 'Building', 'Store', 'Car', 'Truck',
        'MapPin', 'Compass', 'Coffee', 'Heart', 'Lightbulb'
      ];
  
      // Create lazy getters for all icons
      icons.forEach(iconName => {
        Object.defineProperty(this, iconName, this._createGetter(iconName));
      });
    }
  
    // Dynamic icon getter for icons not predefined
    get(iconName) {
      if (!this._cache.has(iconName)) {
        try {
          const icon = require(`lucide-react`)[iconName];
          if (icon) {
            this._cache.set(iconName, icon);
          } else {
            console.warn(`Lucide icon "${iconName}" not found`);
            return null;
          }
        } catch (error) {
          console.error(`Error loading Lucide icon "${iconName}":`, error);
          return null;
        }
      }
      return this._cache.get(iconName);
    }
  
    // Development helpers
    getLoadedIcons() {
      return Array.from(this._cache.keys());
    }
  
    clearCache() {
      this._cache.clear();
    }
  
    exists(iconName) {
      try {
        const lucideIcons = require('lucide-react');
        return iconName in lucideIcons;
      } catch {
        return false;
      }
    }
  }
  
  // Export singleton instance
  export const lucide = new LucideIcons();