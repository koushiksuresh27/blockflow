import { useEffect, useRef } from "react";

const ROLES = [
    { label: "Residents", angle: 270 },
    { label: "Admin", angle: 0 },
    { label: "Technician", angle: 90 },
    { label: "Security", angle: 180 },
];

const MODULES = [
    { label: "AI Automation", angle: 300 },
    { label: "Community", angle: 30 },
    { label: "Documents", angle: 120 },
    { label: "Analytics", angle: 210 },
];
const toRad = (deg: number) => (deg * Math.PI) / 180;

export default function BlockFlowHubSpoke() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);
    const startRef = useRef<number>(Date.now());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;

        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const innerR = 80;   // spoke endpoints
        const outerR = 145;  // module ring

        const draw = () => {
            const now = Date.now();
            const t = (now - startRef.current) / 1000;

            ctx.clearRect(0, 0, W, H);

            // Outer rotating ring
            const ringRot = t * 0.12; // slow rotation
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ringRot);
            ctx.beginPath();
            ctx.arc(0, 0, outerR, 0, Math.PI * 2);
            ctx.setLineDash([4, 8]);
            ctx.strokeStyle = "rgba(28,25,23,0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Module labels on outer ring (counter-rotate so text stays upright)
            MODULES.forEach(({ label, angle }) => {
                const a = toRad(angle) + ringRot;
                const x = cx + outerR * Math.cos(a);
                const y = cy + outerR * Math.sin(a);

                // dot
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(28,25,23,0.3)";
                ctx.fill();

                // label
                ctx.save();
                ctx.translate(x, y);
                ctx.font = "500 10px 'JetBrains Mono', monospace";
                ctx.fillStyle = "rgba(28,25,23,0.5)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                // offset label outward from dot
                const labelOffset = 22;
                const lx = labelOffset * Math.cos(a);
                const ly = labelOffset * Math.sin(a);
                ctx.fillText(label.toUpperCase(), lx, ly);
                ctx.restore();
            });

            // Inner spokes + animated dots
            ROLES.forEach(({ label, angle }, i) => {
                const a = toRad(angle);
                const ex = cx + innerR * Math.cos(a);
                const ey = cy + innerR * Math.sin(a);

                // spoke line
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = "rgba(28,25,23,0.25)";
                ctx.lineWidth = 1;
                ctx.stroke();

                // animated dot travelling along spoke
                const speed = 1.4;
                const offset = (i * 0.6); // stagger per spoke
                const progress = ((t * speed + offset) % 1);
                const dx = cx + (ex - cx) * progress;
                const dy = cy + (ey - cy) * progress;

                ctx.beginPath();
                ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = "#1C1917";
                ctx.fill();

                // endpoint dot
                ctx.beginPath();
                ctx.arc(ex, ey, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#EDEBE6";
                ctx.strokeStyle = "#1C1917";
                ctx.lineWidth = 1.5;
                ctx.fill();
                ctx.stroke();

                // role label
                const labelR = innerR + 32;
                const lx = cx + labelR * Math.cos(a);
                const ly = cy + labelR * Math.sin(a);
                ctx.font = "600 11px 'JetBrains Mono', monospace";
                ctx.fillStyle = "#1C1917";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label.toUpperCase(), lx, ly);
            });

            // Centre circle
            ctx.beginPath();
            ctx.arc(cx, cy, 32, 0, Math.PI * 2);
            ctx.fillStyle = "#1C1917";
            ctx.fill();

            // Centre pulse ring
            const pulseR = 32 + 8 * Math.abs(Math.sin(t * 1.5));
            const pulseAlpha = 0.15 + 0.1 * Math.abs(Math.sin(t * 1.5));
            ctx.beginPath();
            ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(28,25,23,${pulseAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Centre text
            ctx.font = "700 9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#EDEBE6";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("BLOCK", cx, cy - 5);
            ctx.fillText("FLOW", cx, cy + 6);

            frameRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(frameRef.current);
    }, []);

    return (
        <div className="w-full h-full flex items-center justify-center">
            <canvas
                ref={canvasRef}
                width={350}
                height={350}
                style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
        </div>
    );
}