import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Kleine illustraties voor de keuzetegels (materiaal en fronttype). Geen externe beelden. */
export function Swatch({ id }) {
    const s = { width: '100%', height: '100%', display: 'block' };
    switch (id) {
        case 'uni':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("rect", { width: "40", height: "80", fill: "#e9e6df" }), _jsx("rect", { x: "40", width: "40", height: "80", fill: "#2f3b45" }), _jsx("rect", { x: "80", width: "40", height: "80", fill: "#9aa891" })] });
        case 'woodlook':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#c9a77c" }), [8, 20, 31, 45, 58, 70].map((y, i) => _jsx("path", { d: `M0 ${y} C30 ${y - 4} 60 ${y + 5} 120 ${y - 2}`, stroke: "#a9855a", strokeWidth: "1.4", fill: "none" }, i))] });
        case 'veneer':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#8a5a36" }), [6, 14, 23, 33, 44, 52, 63, 72].map((y, i) => _jsx("path", { d: `M0 ${y} C25 ${y + 6} 50 ${y - 6} 80 ${y + 3} S110 ${y - 3} 120 ${y}`, stroke: "#6d4325", strokeWidth: i % 2 ? 0.8 : 1.6, fill: "none" }, i)), _jsx("ellipse", { cx: "78", cy: "38", rx: "9", ry: "4", fill: "none", stroke: "#5c381e", strokeWidth: "1.2" })] });
        case 'lacquer':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "lq", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#5d6b62" }), _jsx("stop", { offset: "1", stopColor: "#3e4a43" })] }) }), _jsx("rect", { width: "120", height: "80", fill: "url(#lq)" }), _jsx("rect", { x: "10", y: "8", width: "44", height: "64", rx: "2", fill: "none", stroke: "rgba(255,255,255,.15)" })] });
        case 'textile':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#d8cfc0" }), Array.from({ length: 30 }, (_, i) => _jsx("line", { x1: "0", y1: i * 2.7, x2: "120", y2: i * 2.7, stroke: "#c4b8a5", strokeWidth: ".7" }, 'h' + i)), Array.from({ length: 45 }, (_, i) => _jsx("line", { x1: i * 2.7, y1: "0", x2: i * 2.7, y2: "80", stroke: "#cbbfad", strokeWidth: ".5" }, 'v' + i))] });
        case 'metal':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "mt", x1: "0", y1: "0", x2: "1", y2: "0", children: [_jsx("stop", { offset: "0", stopColor: "#b9bec3" }), _jsx("stop", { offset: ".5", stopColor: "#e6e9ec" }), _jsx("stop", { offset: "1", stopColor: "#a7adb3" })] }) }), _jsx("rect", { width: "120", height: "80", fill: "url(#mt)" }), Array.from({ length: 20 }, (_, i) => _jsx("line", { x1: "0", y1: i * 4 + 1, x2: "120", y2: i * 4 + 1, stroke: "rgba(255,255,255,.35)", strokeWidth: ".5" }, i))] });
        case 'mix':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: s, children: [_jsx("rect", { width: "120", height: "40", fill: "#b88b5e" }), [10, 22, 32].map((y, i) => _jsx("path", { d: `M0 ${y} C40 ${y - 3} 80 ${y + 4} 120 ${y}`, stroke: "#9a6f45", strokeWidth: "1.2", fill: "none" }, i)), _jsx("rect", { y: "40", width: "120", height: "40", fill: "#2f3b45" })] });
        case 'handle':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid meet", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#ecebe6" }), _jsx("rect", { x: "14", y: "10", width: "44", height: "60", fill: "#fff", stroke: "#cfcac0" }), _jsx("rect", { x: "62", y: "10", width: "44", height: "60", fill: "#fff", stroke: "#cfcac0" }), _jsx("rect", { x: "50", y: "30", width: "3", height: "20", rx: "1.5", fill: "#2b2b2b" }), _jsx("rect", { x: "67", y: "30", width: "3", height: "20", rx: "1.5", fill: "#2b2b2b" })] });
        case 'profile':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid meet", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#ecebe6" }), _jsx("rect", { x: "14", y: "16", width: "44", height: "54", fill: "#fff", stroke: "#cfcac0" }), _jsx("rect", { x: "62", y: "16", width: "44", height: "54", fill: "#fff", stroke: "#cfcac0" }), _jsx("rect", { x: "14", y: "10", width: "92", height: "5", fill: "#8b8f93" })] });
        case 'push':
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid meet", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#ecebe6" }), _jsx("rect", { x: "14", y: "10", width: "44", height: "60", fill: "#fff", stroke: "#cfcac0" }), _jsx("rect", { x: "66", y: "10", width: "44", height: "60", fill: "#fff", stroke: "#cfcac0", transform: "rotate(-6 66 40)" }), _jsx("circle", { cx: "40", cy: "40", r: "6", fill: "none", stroke: "#c9a24a", strokeWidth: "1.5" }), _jsx("circle", { cx: "40", cy: "40", r: "2", fill: "#c9a24a" })] });
        default:
            return _jsxs("svg", { viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid meet", style: s, children: [_jsx("rect", { width: "120", height: "80", fill: "#ecebe6" }), _jsx("text", { x: "60", y: "50", textAnchor: "middle", fontSize: "30", fill: "#9a958b", children: "?" })] });
    }
}
