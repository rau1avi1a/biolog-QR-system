// components/ui/SearchBar.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/shadcn/components/input';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Button } from '@/components/ui/shadcn/components/button';
import {
  Search,
  X,
  Filter,
  ScanLine,
  TestTube,
  Beaker,
  Package
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/components/popover';

const SearchBar = ({ 
  searchQuery, 
  onSearchChange, 
  suggestions = [], 
  filters = {},
  onFiltersChange,
  onQRScan,
  showQRButton = true,
  showFilters = true 
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilters, setActiveFilters] = useState(filters);
  const inputRef = useRef(null);

  const filterOptions = {
    itemType: [
      { value: 'chemical', label: 'Chemicals', icon: TestTube },
      { value: 'solution', label: 'Solutions', icon: Beaker },
      { value: 'product', label: 'Products', icon: Package }
    ],
    stockStatus: [
      { value: 'low', label: 'Low Stock', color: 'destructive' },
      { value: 'medium', label: 'Medium Stock', color: 'default' },
      { value: 'good', label: 'Good Stock', color: 'secondary' }
    ],
    location: suggestions
      .map(item => item.location)
      .filter((location, index, arr) => location && arr.indexOf(location) === index)
      .slice(0, 10)
      .map(location => ({ value: location, label: location })),
    vendor: suggestions
      .map(item => item.vendor)
      .filter((vendor, index, arr) => vendor && arr.indexOf(vendor) === index)
      .slice(0, 10)
      .map(vendor => ({ value: vendor, label: vendor }))
  };

  const applyFilter = (category, value) => {
    const newFilters = { ...activeFilters };
    if (!newFilters[category]) newFilters[category] = [];
    
    if (newFilters[category].includes(value)) {
      newFilters[category] = newFilters[category].filter(v => v !== value);
      if (newFilters[category].length === 0) delete newFilters[category];
    } else {
      newFilters[category] = [...newFilters[category], value];
    }
    
    setActiveFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const removeFilter = (category, value) => {
    const newFilters = { ...activeFilters };
    if (newFilters[category]) {
      newFilters[category] = newFilters[category].filter(v => v !== value);
      if (newFilters[category].length === 0) delete newFilters[category];
    }
    setActiveFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onFiltersChange({});
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters).reduce((count, filters) => count + filters.length, 0);
  };

  const topSuggestions = suggestions
    .filter(item => 
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Main Search Bar */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by name, SKU, vendor, or location..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onFocus={() => setShowSuggestions(searchQuery.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-10 pr-10 bg-white dark:bg-slate-800"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => {
                onSearchChange('');
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && topSuggestions.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {topSuggestions.map((item, index) => (
                <div
                  key={item._id}
                  className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  onClick={() => {
                    onSearchChange(item.displayName);
                    setShowSuggestions(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {item.itemType === 'chemical' && <TestTube className="h-3 w-3" />}
                    {item.itemType === 'solution' && <Beaker className="h-3 w-3" />}
                    {item.itemType === 'product' && <Package className="h-3 w-3" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.displayName}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Filters - Only show if showFilters is true */}
        {showFilters && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Advanced Filters</h4>
                  {getActiveFilterCount() > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      Clear All
                    </Button>
                  )}
                </div>

                {/* Item Type Filter */}
                <div>
                  <h5 className="text-sm font-medium mb-2">Item Type</h5>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.itemType.map(({ value, label, icon: Icon }) => (
                      <Badge
                        key={value}
                        variant={activeFilters.itemType?.includes(value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => applyFilter('itemType', value)}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Stock Status Filter */}
                <div>
                  <h5 className="text-sm font-medium mb-2">Stock Status</h5>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.stockStatus.map(({ value, label, color }) => (
                      <Badge
                        key={value}
                        variant={activeFilters.stockStatus?.includes(value) ? color : "outline"}
                        className="cursor-pointer"
                        onClick={() => applyFilter('stockStatus', value)}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Location Filter */}
                {filterOptions.location.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Location</h5>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {filterOptions.location.map(({ value, label }) => (
                        <Badge
                          key={value}
                          variant={activeFilters.location?.includes(value) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => applyFilter('location', value)}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vendor Filter */}
                {filterOptions.vendor.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Vendor</h5>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {filterOptions.vendor.map(({ value, label }) => (
                        <Badge
                          key={value}
                          variant={activeFilters.vendor?.includes(value) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => applyFilter('vendor', value)}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* QR Scan Button */}
        {showQRButton && onQRScan && (
          <Button variant="outline" onClick={onQRScan}>
            <ScanLine className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
        )}
      </div>

      {/* Active Filters Display - Only show if showFilters is true */}
      {showFilters && getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([category, values]) =>
            values.map(value => (
              <Badge
                key={`${category}-${value}`}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => removeFilter(category, value)}
              >
                {value}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))
          )}
        </div>
      )}

      {/* Search Results Summary */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {suggestions.length} item{suggestions.length !== 1 ? 's' : ''} found
          {searchQuery && ` matching "${searchQuery}"`}
          {showFilters && getActiveFilterCount() > 0 && ` with ${getActiveFilterCount()} filter${getActiveFilterCount() !== 1 ? 's' : ''}`}
        </p>
      )}
    </div>
  );
};

export default SearchBar;