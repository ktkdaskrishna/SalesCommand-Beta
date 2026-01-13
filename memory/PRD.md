# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM for Securado's cybersecurity business with role-based experiences.

## Version
**v2.8.0** - Enhanced Kanban with Blue Sheet AI (Jan 13, 2026)

---

## Completed Work (This Session)

### Enhanced Kanban Board ✅ (Jan 13, 2026)
**Feature:** Full-featured Kanban board with AI-powered Blue Sheet integration

#### Kanban Card Enhancements:
| Feature | Description |
|---------|-------------|
| **Product/Segment Tag** | Shows MSSP, GRC, AppSec, etc. on each card |
| **Activities Count** | Displays linked activities (e.g., "2 activities") |
| **Calculate Probability Button** | Opens Blue Sheet modal |
| **Drag & Drop** | Move between pipeline stages |
| **Deal Progress Bar** | Visual probability indicator |

#### Blue Sheet Modal Features:
| Section | Elements |
|---------|----------|
| **Buying Influences** | Economic Buyer Identified/Favorable, Coach Identified/Engaged, User Buyers, Technical Buyers |
| **Red Flags** | No Access to EB, Reorganization Pending, Budget Not Confirmed, Competition Preferred, Timeline Unclear |
| **Win Results** | Clear Business Results, Quantifiable Value, Next Steps Defined, Mutual Action Plan |
| **AI Result Display** | Calculated probability %, confidence level, AI recommendations |

### Configurable Blue Sheet Weights ✅
**Super Admin** can configure scoring weights via `/api/config/bluesheet-weights`:
- Buying influence weights (default: Economic Buyer=10 pts each)
- Red flag penalties (default: -15 for no EB access)
- Win results weights (default: 12 pts for clear results)
- Max possible score configuration

### Target Assignment System ✅
**API endpoints created:**
- `GET /api/config/targets` - List targets by user/period
- `POST /api/config/targets` - Create new target (Super Admin)
- `PUT /api/config/targets/{id}` - Update target
- `DELETE /api/config/targets/{id}` - Delete target

### UI/UX Modernization ✅
**Theme:** Light content area with dark sidebar - matching modern ERP design patterns

#### Design System Updates:
- **Sidebar:** Dark slate-900 background with white text navigation
- **Content Area:** Light slate-50 background 
- **Header Icons:** Gradient backgrounds (indigo-purple, blue-indigo, violet-purple per page)
- **Cards:** White background with subtle borders and hover shadows

---

## Navigation Structure

### Main Menu (All Roles)
| Item | Icon | Path |
|------|------|------|
| Dashboard | LayoutDashboard | /dashboard |
| Accounts | Building2 | /accounts |
| Opportunities | Target | /opportunities |
| KPIs | BarChart3 | /kpis |
| Email | Mail | /my-outlook |
| Reports | FileText | /reports |

### Administration (Super Admin Only)
| Item | Icon | Path |
|------|------|------|
| System Config | Settings | /admin |
| Integrations | Plug2 | /integrations |
| Data Lake | Database | /data-lake |
| Field Mapping | Wand2 | /field-mapping |

---

## Pages Status

| Page | Status | Features |
|------|--------|----------|
| Dashboard | ✅ | Data Lake health, integrations status |
| Sales Dashboard | ✅ | KPIs, Kanban, Blue Sheet, Incentive Calculator |
| Accounts | ✅ | Card/Table view, health scores, CRUD |
| Opportunities | ✅ | **Kanban with Blue Sheet**, Table view, CRUD |
| KPIs | ✅ | Personal metrics, charts |
| Email/Calendar | ✅ | MS365 integration |
| Admin Panel | ✅ | Users, Roles, Role Config, Incentive Config |
| Integrations | ✅ | Odoo, MS365 connectors |
| Data Lake | ✅ | 3-zone data pipeline |
| Field Mapping | ✅ | AI-powered mapping |

---

## Pending Tasks

### Calendar View Enhancement
- Current: List view with date filters
- Needed: Visual calendar grid with week/month view

### Opportunity Activities
- Current: Basic opportunity list
- Needed: Side drawer with expandable activities per opportunity

### Dashboard Widgets
- Connect widgets to real data APIs
- Implement drag-drop customization

---

## API Endpoints

### Configuration APIs
- `GET /api/config/widgets` - Widget registry
- `GET /api/config/user/navigation` - User's role-based navigation
- `GET/POST/PUT /api/config/roles` - Role management
- `GET/PUT/DELETE /api/config/user/dashboard` - User dashboard layout
- `GET/POST/PUT /api/config/service-lines` - Service lines

### Sales APIs
- `GET/POST /api/accounts` - Account CRUD
- `GET/POST /api/opportunities` - Opportunity CRUD
- `GET /api/opportunities/kanban` - Kanban view
- `POST /api/opportunities/{id}/calculate-probability` - Blue Sheet

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
