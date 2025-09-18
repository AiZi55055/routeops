"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const react_router_dom_1 = require("react-router-dom");
const AppShell_1 = __importDefault(require("./shell/AppShell"));
const Home_1 = __importDefault(require("@/features/messenger/Home"));
const SupervisorDashboard_1 = __importDefault(require("@/features/dashboard/SupervisorDashboard"));
const OptimizePage_1 = __importDefault(require("@/features/optimization/OptimizePage"));
const UploadJobs_1 = __importDefault(require("@/features/company/UploadJobs"));
function Home() {
    return <div style={{ padding: 16 }}>Home – pick a link above.</div>;
}
function NotFound() {
    return <div style={{ padding: 16 }}>404 Not Found</div>;
}
exports.router = (0, react_router_dom_1.createBrowserRouter)([
    {
        element: <AppShell_1.default />,
        errorElement: <NotFound />,
        children: [
            { path: '/', element: <Home /> },
            // TEMP: inline element to prove routing works
            { path: '/dashboard', element: <SupervisorDashboard_1.default /> },
            { path: '/messenger', element: <Home_1.default /> },
            { path: '/optimize', element: <OptimizePage_1.default /> },
            { path: '/upload-jobs', element: <UploadJobs_1.default /> },
        ],
    },
]);
//# sourceMappingURL=router.js.map