"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppShell;
const react_router_dom_1 = require("react-router-dom");
function AppShell() {
    const loc = (0, react_router_dom_1.useLocation)();
    const isActive = (path) => loc.pathname === path || (path === '/route' && loc.pathname === '/');
    const tab = (path) => `py-3 ${isActive(path) ? 'text-sky-400' : 'text-slate-400'}`;
    return (<div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <main className="flex-1"><react_router_dom_1.Outlet /></main>
      <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-900">
        <div className="grid grid-cols-4 text-center text-sm">
          <react_router_dom_1.Link className={tab('/route')} to="/route">Route</react_router_dom_1.Link>
          <react_router_dom_1.Link className={tab('/scan')} to="/scan">Scan</react_router_dom_1.Link>
          <react_router_dom_1.Link className={tab('/issues')} to="/issues">Issues</react_router_dom_1.Link>
          <react_router_dom_1.Link className={tab('/profile')} to="/profile">Profile</react_router_dom_1.Link>
          <react_router_dom_1.Link to="/upload-jobs">Upload Jobs</react_router_dom_1.Link>
        </div>
      </nav>
    </div>);
}
//# sourceMappingURL=AppShell.js.map