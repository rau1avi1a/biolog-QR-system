import * as Lucide from 'lucide-react';

class LucideIcons {
  constructor() {
    this.icons = Lucide;
  }

  get(iconName) {
    const Icon = this.icons[iconName]
    if (!Icon) console.warn(`Lucide icon "${iconName}" not found`);
    return Icon || null;
  }
}

export const lucide = new LucideIcons();
