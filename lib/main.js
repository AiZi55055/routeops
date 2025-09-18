"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("react-dom/client"));
const react_router_dom_1 = require("react-router-dom");
const router_1 = require("@/app/router");
const startup_1 = require("@/app/startup");
// IMPORTANT: include Leaflet CSS once
require("leaflet/dist/leaflet.css");
// IMPORTANT: keep StrictMode OFF while using Leaflet in dev
(0, startup_1.registerStartupEffects)();
client_1.default.createRoot(document.getElementById('root')).render(<react_router_dom_1.RouterProvider router={router_1.router}/>);
//# sourceMappingURL=main.js.map