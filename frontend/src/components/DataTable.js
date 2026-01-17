import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";
import { 
  ChevronUp, 
  ChevronDown, 
  ArrowUpDown, 
  Filter, 
  X, 
  Search,
  SlidersHorizontal,
  Download,
  MoreHorizontal
} from "lucide-react";

const DataTable = ({
  columns,
  data,
  onRowClick,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
  onSort: externalOnSort,
  emptyMessage = "No data available",
  className,
  enableInternalSort = true,
  enableFiltering = true,
  enableColumnFilter = false,
  searchable = false,
  searchPlaceholder = "Search...",
}) => {
  // Internal sorting state (used when external sort is not provided)
  const [internalSortColumn, setInternalSortColumn] = useState(null);
  const [internalSortDirection, setInternalSortDirection] = useState("asc");
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilterRow, setShowFilterRow] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Use external or internal sort state
  const sortColumn = externalSortColumn ?? internalSortColumn;
  const sortDirection = externalSortDirection ?? internalSortDirection;
  
  const handleHeaderClick = (column) => {
    if (!column.sortable) return;
    
    if (externalOnSort) {
      externalOnSort(column.key);
    } else if (enableInternalSort) {
      if (internalSortColumn === column.key) {
        setInternalSortDirection(prev => prev === "asc" ? "desc" : "asc");
      } else {
        setInternalSortColumn(column.key);
        setInternalSortDirection("asc");
      }
    }
  };

  const handleFilterChange = (key, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Process data with sorting and filtering
  const processedData = useMemo(() => {
    let result = [...data];
    
    // Apply search filter
    if (searchable && searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row => 
        columns.some(col => {
          const value = row[col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(lowerSearch);
        })
      );
    }
    
    // Apply column filters
    if (enableFiltering && Object.keys(columnFilters).length > 0) {
      result = result.filter(row => 
        Object.entries(columnFilters).every(([key, filterValue]) => {
          if (!filterValue) return true;
          const cellValue = row[key];
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        })
      );
    }
    
    // Apply sorting
    if (sortColumn && enableInternalSort && !externalOnSort) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === "asc" ? 1 : -1;
        if (bVal == null) return sortDirection === "asc" ? -1 : 1;
        
        // Numeric comparison
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortDirection === "asc") {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      });
    }
    
    return result;
  }, [data, sortColumn, sortDirection, columnFilters, searchTerm, enableInternalSort, enableFiltering, searchable, columns, externalOnSort]);

  const getSortIcon = (column) => {
    if (!column.sortable) return null;
    
    if (sortColumn === column.key) {
      return sortDirection === "asc" ? (
        <ChevronUp className="w-4 h-4 text-indigo-600" />
      ) : (
        <ChevronDown className="w-4 h-4 text-indigo-600" />
      );
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />;
  };

  const activeFiltersCount = Object.values(columnFilters).filter(Boolean).length;

  return (
    <div className={cn("", className)}>
      {/* Table Toolbar */}
      {(searchable || enableColumnFilter) && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
                  data-testid="table-search-input"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            
            {enableColumnFilter && (
              <button
                onClick={() => setShowFilterRow(!showFilterRow)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors",
                  showFilterRow || activeFiltersCount > 0
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
                data-testid="toggle-filters-btn"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            )}
          </div>
          
          <div className="text-sm text-slate-500">
            {processedData.length} {processedData.length === 1 ? 'item' : 'items'}
            {searchTerm || activeFiltersCount > 0 ? ` (filtered from ${data.length})` : ''}
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="data-table w-full" data-testid="data-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider",
                    column.sortable && "cursor-pointer select-none group hover:bg-slate-100 transition-colors",
                    column.className
                  )}
                  onClick={() => handleHeaderClick(column)}
                  data-testid={`header-${column.key}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
            
            {/* Filter Row */}
            {showFilterRow && enableColumnFilter && (
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((column) => (
                  <th key={`filter-${column.key}`} className="px-4 py-2">
                    {column.filterable !== false && column.key !== 'actions' ? (
                      <input
                        type="text"
                        placeholder={`Filter ${column.label}...`}
                        value={columnFilters[column.key] || ""}
                        onChange={(e) => handleFilterChange(column.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        data-testid={`filter-${column.key}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-500"
                >
                  {searchTerm || activeFiltersCount > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <Filter className="w-8 h-8 text-slate-300" />
                      <p>No results match your filters</p>
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setColumnFilters({});
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Clear all filters
                      </button>
                    </div>
                  ) : emptyMessage}
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-slate-100 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-slate-50"
                  )}
                  data-testid={`table-row-${rowIndex}`}
                >
                  {columns.map((column) => (
                    <td 
                      key={column.key} 
                      className={cn("px-4 py-4 text-sm text-slate-700", column.cellClassName)}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
