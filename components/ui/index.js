// components/ui/index.js
"use client";

import { shadcn } from "./shadcn";
import { lucide } from "./lucide-react";

class UnifiedUI {
  constructor() {
    // Expose dynamic Shadcn components and Lucide in one object
    this.shadcn = shadcn;
    this.icons  = lucide.icons;
    this.lucide = lucide;

    return new Proxy(this, {
      get(target, prop) {
        // 1) If it’s a property on this class, return it
        if (prop in target) {
          return target[prop];
        }
        // 2) Next fall back to the dynamically-loaded shadcn component
        if (prop in shadcn) {
          return shadcn[prop];
        }
        // 3) Nothing matched
        return undefined;
      },
      has(target, prop) {
        return prop in target || prop in shadcn;
      },
      ownKeys(target) {
        return [
          ...Reflect.ownKeys(target),
          ...Object.keys(shadcn),
        ];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop in target) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
        if (prop in shadcn) {
          return {
            configurable: true,
            enumerable:   true,
            writable:     false,
            value:        shadcn[prop],
          };
        }
        return undefined;
      },
    });
  }

  /* Utility methods */
  hasComponent(name) {
    return Boolean(shadcn[name]);
  }
  getComponent(name) {
    return shadcn[name] || null;
  }
  hasIcon(name) {
    return lucide.exists(name);
  }
  getIcon(name) {
    return lucide.get(name);
  }
  getLoadedComponents() {
    return shadcn.getLoadedComponents();
  }
  getLoadedIcons() {
    return lucide.getLoadedIcons();
  }
  clearCaches() {
    shadcn.clearCache();
    lucide.clearCache();
  }
  getStats() {
    return {
      loadedComponents: this.getLoadedComponents(),
      loadedIcons:      this.getLoadedIcons(),
      componentCount:   this.getLoadedComponents().length,
      iconCount:        this.getLoadedIcons().length,
    };
  }
}

export const ui = new UnifiedUI();
