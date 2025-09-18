"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppShell;
const react_router_dom_1 = require("react-router-dom");
function AppShell() {
    return (<div>
      <header style={{ padding: 12, borderBottom: '1px solid #222', display: 'flex', gap: 12 }}>
        <react_router_dom_1.Link to="/">Home</react_router_dom_1.Link>
        <react_router_dom_1.Link to="/dashboard">Dashboard</react_router_dom_1.Link>
        <react_router_dom_1.Link to="/messenger">Messenger</react_router_dom_1.Link>
        <react_router_dom_1.Link to="/optimize">Optimize</react_router_dom_1.Link>
        <react_router_dom_1.Link to="/upload-jobs">Upload Jobs</react_router_dom_1.Link>
      </header>
      <react_router_dom_1.Outlet />
    </div>);
}
//# sourceMappingURL=AppShell.js.map