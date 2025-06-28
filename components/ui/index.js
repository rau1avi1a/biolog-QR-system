// components/ui/index.js - Ultimate Unified UI Import
// Usage: import { ui } from '@/components/ui'
// Then: <ui.Button>, <ui.icons.Search>, etc.

import { shadcn } from './shadcn';
import { lucide } from './lucide-react';

class UnifiedUI {
  constructor() {
    // Expose all shadcn components at the root
    this.shadcn = shadcn;

    // Expose the full Lucide exports under .icons (so ui.icons.Menu works)
    this.icons = lucide.icons;
    this.lucide = lucide; // for dynamic lookup via ui.getIcon()

    // Proxy so you can call ui.Button, ui.Card, etc. directly
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        if (prop in shadcn) {
          return shadcn[prop];
        }
        return undefined;
      },
      has(target, prop) {
        return prop in target || prop in shadcn;
      },
      ownKeys(target) {
        return [...Reflect.ownKeys(target), ...Object.keys(shadcn)];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop in target) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
        if (prop in shadcn) {
          return {
            configurable: true,
            enumerable: true,
            value: shadcn[prop],
            writable: false
          };
        }
        return undefined;
      }
    });
  }

  /** Check if a shadcn component exists */
  hasComponent(name) {
    return Boolean(shadcn[name]);
  }

  /** Get a shadcn component by name */
  getComponent(name) {
    return shadcn[name] || null;
  }

  /** Check if a lucide icon exists */
  hasIcon(name) {
    return lucide.exists(name);
  }

  /** Get a lucide icon by name */
  getIcon(name) {
    return lucide.get(name);
  }

  /** Development helpers: get loaded components and icons */
  getLoadedComponents() {
    return shadcn.getLoadedComponents();
  }
  getLoadedIcons() {
    return lucide.getLoadedIcons();
  }

  /** Clear caches for development/testing */
  clearCaches() {
    shadcn.clearCache();
    lucide.clearCache();
  }

  /** Performance stats */
  getStats() {
    return {
      loadedComponents: this.getLoadedComponents(),
      loadedIcons: this.getLoadedIcons(),
      componentCount: this.getLoadedComponents().length,
      iconCount: this.getLoadedIcons().length
    };
  }
}

// Export singleton UI object
export const ui = new UnifiedUI();
