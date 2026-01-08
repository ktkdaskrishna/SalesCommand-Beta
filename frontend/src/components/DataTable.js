import React from "react";
import { cn } from "../lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

const DataTable = ({
  columns,
  data,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = "No data available",
  className,
}) => {
  const handleHeaderClick = (column) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="data-table" data-testid="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  column.sortable && "cursor-pointer hover:bg-slate-50",
                  column.className
                )}
                onClick={() => handleHeaderClick(column)}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {column.sortable && sortColumn === column.key && (
                    sortDirection === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && "cursor-pointer")}
                data-testid={`table-row-${rowIndex}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.cellClassName}>
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
  );
};

export default DataTable;
