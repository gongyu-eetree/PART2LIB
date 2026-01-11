
import React, { useRef, useEffect, Suspense, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows, Grid } from '@react-three/drei';
import { FootprintData, PinInfo } from '../types';

// --- Schematic Symbol Preview ---

const SchematicSymbol2D: React.FC<{ 
  pins: PinInfo[], 
  name: string,
  onPinSelect: (num: string) => void,
  selectedPinNumber: string | null 
}> = ({ pins, name, onPinSelect, selectedPinNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pins.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activePins = pins;
    const leftSideTypes = ['input', 'bidirectional', 'passive', 'power_in'];
    const leftPins = activePins.filter(p => leftSideTypes.includes(p.electrical_type));
    const rightPins = activePins.filter(p => !leftSideTypes.includes(p.electrical_type));

    if (leftPins.length === 0 && rightPins.length > 0) {
        const half = Math.ceil(rightPins.length / 2);
        leftPins.push(...rightPins.splice(0, half));
    } else if (rightPins.length === 0 && leftPins.length > 0) {
        const half = Math.ceil(leftPins.length / 2);
        rightPins.push(...leftPins.splice(0, half));
    }

    const maxSidePins = Math.max(leftPins.length, rightPins.length);
    const pinSpacing = 35;
    const boxWidth = 160;
    const boxHeight = Math.max(100, (maxSidePins + 1) * pinSpacing);

    canvas.width = 400;
    canvas.height = boxHeight + 100;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Box
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);
    ctx.fillRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);

    // Draw Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, centerX, centerY);

    const drawSidePins = (sidePins: PinInfo[], isLeft: boolean) => {
        sidePins.forEach((pin, i) => {
            const isSelected = selectedPinNumber === pin.pin_number;
            const y = centerY - (sidePins.length - 1) * pinSpacing / 2 + i * pinSpacing;
            const x = isLeft ? centerX - boxWidth / 2 : centerX + boxWidth / 2;
            const pinLen = 30;

            ctx.beginPath();
            ctx.strokeStyle = isSelected ? '#3b82f6' : '#94a3b8';
            ctx.lineWidth = isSelected ? 3 : 1.5;
            ctx.moveTo(x, y);
            ctx.lineTo(isLeft ? x - pinLen : x + pinLen, y);
            ctx.stroke();

            ctx.fillStyle = isSelected ? '#2563eb' : '#64748b';
            ctx.font = '9px Fira Code';
            ctx.textAlign = isLeft ? 'right' : 'left';
            ctx.fillText(pin.pin_number, isLeft ? x - pinLen - 5 : x + pinLen + 5, y - 5);

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = isLeft ? 'left' : 'right';
            ctx.fillText(pin.pin_name, isLeft ? x + 10 : x - 10, y + 4);

            if (isSelected) {
                ctx.beginPath();
                ctx.arc(isLeft ? x - pinLen : x + pinLen, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#3b82f6';
                ctx.fill();
            }
        });
    };

    drawSidePins(leftPins, true);
    drawSidePins(rightPins, false);
  }, [pins, name, selectedPinNumber]);

  return (
    <div className="relative w-full h-[400px] bg-white rounded-xl overflow-hidden border border-slate-300 shadow-sm flex justify-center items-center">
        <div className="absolute top-3 left-3 z-10">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-bold text-slate-600 uppercase">Symbol</span>
        </div>
        <canvas ref={canvasRef} className="max-w-full h-auto cursor-pointer" onClick={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const leftSideTypes = ['input', 'bidirectional', 'passive', 'power_in'];
            const leftPins = pins.filter(p => leftSideTypes.includes(p.electrical_type));
            const rightPins = pins.filter(p => !leftSideTypes.includes(p.electrical_type));
            if (leftPins.length === 0 && rightPins.length > 0) leftPins.push(...rightPins.splice(0, Math.ceil(rightPins.length/2)));
            else if (rightPins.length === 0 && leftPins.length > 0) rightPins.push(...leftPins.splice(0, Math.ceil(leftPins.length/2)));

            const pinSpacing = 35;
            const boxWidth = 160;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            [...leftPins, ...rightPins].forEach((pin) => {
                const sidePins = leftPins.includes(pin) ? leftPins : rightPins;
                const idx = sidePins.indexOf(pin);
                const isLeft = leftPins.includes(pin);
                const py = centerY - (sidePins.length - 1) * pinSpacing / 2 + idx * pinSpacing;
                const px = isLeft ? centerX - boxWidth / 2 - 15 : centerX + boxWidth / 2 + 15;
                const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
                if (dist < 20) onPinSelect(pin.pin_number);
            });
        }} />
    </div>
  );
};

// --- 2D PCB Renderer ---

const Footprint2D: React.FC<{ 
  kicadMod: string, 
  onPinSelect: (num: string) => void,
  selectedPinNumber: string | null 
}> = ({ kicadMod, onPinSelect, selectedPinNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padsRef = useRef<any[]>([]);
  const transformRef = useRef({ centerX: 0, centerY: 0, scale: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padRegex = /\(pad\s+("?[\w\d]+"?)[\s\S]*?\(at\s+([-0-9.]+)\s+([-0-9.]+)(?:\s+[-0-9.]+)?\)[\s\S]*?\(size\s+([-0-9.]+)\s+([-0-9.]+)\)/g;
    const pads: any[] = [];
    let match;
    while ((match = padRegex.exec(kicadMod)) !== null) {
      pads.push({
        num: match[1].replace(/"/g, ''),
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        width: parseFloat(match[4]),
        height: parseFloat(match[5])
      });
    }
    padsRef.current = pads;

    const lineRegex = /\(fp_line\s+\(start\s+([-0-9.]+)\s+([-0-9.]+)\)\s+\(end\s+([-0-9.]+)\s+([-0-9.]+)\)/g;
    const lines = [];
    while ((match = lineRegex.exec(kicadMod)) !== null) {
      lines.push({ x1: parseFloat(match[1]), y1: parseFloat(match[2]), x2: parseFloat(match[3]), y2: parseFloat(match[4]) });
    }

    let minX = -5, maxX = 5, minY = -5, maxY = 5;
    if (pads.length > 0 || lines.length > 0) {
      const coordsX = [
        ...pads.map(p => p.x - p.width / 2),
        ...pads.map(p => p.x + p.width / 2),
        ...lines.map(l => l.x1),
        ...lines.map(l => l.x2)
      ];
      const coordsY = [
        ...pads.map(p => p.y - p.height / 2),
        ...pads.map(p => p.y + p.height / 2),
        ...lines.map(l => l.y1),
        ...lines.map(l => l.y2)
      ];
      minX = Math.min(...coordsX) - 1.5;
      maxX = Math.max(...coordsX) + 1.5;
      minY = Math.min(...coordsY) - 1.5;
      maxY = Math.max(...coordsY) + 1.5;
    }

    const scale = Math.min((canvas.width - 40) / (maxX - minX), (canvas.height - 40) / (maxY - minY));
    const centerX = canvas.width / 2 - ((minX + maxX) / 2) * scale;
    const centerY = canvas.height / 2 - ((minY + maxY) / 2) * scale;
    transformRef.current = { centerX, centerY, scale };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(centerX + line.x1 * scale, centerY + line.y1 * scale);
        ctx.lineTo(centerX + line.x2 * scale, centerY + line.y2 * scale);
        ctx.stroke();
    });

    pads.forEach(pad => {
      const isSelected = selectedPinNumber === pad.num;
      ctx.fillStyle = isSelected ? '#3b82f6' : '#ef4444';
      const px = centerX + pad.x * scale - (pad.width * scale) / 2;
      const py = centerY + pad.y * scale - (pad.height * scale) / 2;
      const pw = pad.width * scale;
      const ph = pad.height * scale;
      
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, Math.min(pw, ph) * 0.2);
      else ctx.rect(px, py, pw, ph);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.floor(scale * 0.35))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pad.num, px + pw / 2, py + ph / 2);
    });
  }, [kicadMod, selectedPinNumber]);

  return (
    <div className="relative w-full h-[400px] bg-white rounded-xl overflow-hidden border border-slate-300 shadow-sm">
      <div className="absolute top-3 left-3 z-10">
        <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-bold text-slate-600 uppercase">Footprint</span>
      </div>
      <canvas ref={canvasRef} width={400} height={400} className="w-full h-full cursor-pointer" onClick={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
            const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
            const { centerX, centerY, scale } = transformRef.current;
            const clickedPad = padsRef.current.find(pad => {
                const px = centerX + pad.x * scale - (pad.width * scale) / 2;
                const py = centerY + pad.y * scale - (pad.height * scale) / 2;
                const pw = pad.width * scale;
                const ph = pad.height * scale;
                return x >= px && x <= px + pw && y >= py && y <= py + ph;
            });
            if (clickedPad) onPinSelect(clickedPad.num);
        }} />
    </div>
  );
};

// --- 3D Renderer ---

const ComponentModel: React.FC<{ 
  data: FootprintData, 
  onPinSelect: (num: string) => void,
  selectedPinNumber: string | null 
}> = ({ data, onPinSelect, selectedPinNumber }) => {
  const { bodyWidth, bodyLength, height } = data.dimensions || {};
  const w = bodyWidth?.nominal || 6;
  const l = bodyLength?.nominal || 10;
  const h = height?.nominal || 1.5;
  const sc = 0.5; 
  const sw = w * sc;
  const sl = l * sc;
  const sh = h * sc;

  const pins = useMemo(() => {
    const arr = [];
    const pinCount = data.pinCount || 8;
    const perSide = Math.ceil(pinCount / 2);
    const pitch = (data.dimensions?.pitch?.nominal || 1.27) * sc;
    
    for (let i = 0; i < pinCount; i++) {
        const isLeftSide = i < perSide;
        const side = isLeftSide ? -1 : 1;
        const index = isLeftSide ? i : (pinCount - 1 - i);
        const offset = (index - (perSide - 1) / 2) * pitch;
        const pinNum = (i + 1).toString();
        const isSelected = selectedPinNumber === pinNum;

        arr.push(
            <group key={i} position={[side * (sw/2 + 0.3 * sc), 0, offset]} onClick={(e) => {
                    e.stopPropagation();
                    onPinSelect(pinNum);
                }}>
                <mesh position={[0, sh * 0.2, 0]}>
                    <boxGeometry args={[0.5 * sc, sh * 0.4, 0.4 * sc]} />
                    <meshStandardMaterial color={isSelected ? "#3b82f6" : "#cbd5e1"} metalness={0.8} />
                </mesh>
                <mesh position={[side * 0.2 * sc, 0, 0]}>
                    <boxGeometry args={[0.4 * sc, 0.05 * sc, 0.4 * sc]} />
                    <meshStandardMaterial color={isSelected ? "#60a5fa" : "#f8fafc"} metalness={1.0} />
                </mesh>
            </group>
        );
    }
    return arr;
  }, [data.pinCount, sw, sl, sh, data.dimensions?.pitch, selectedPinNumber, onPinSelect]);

  return (
    <group>
      <mesh castShadow position={[0, sh / 2, 0]}>
        <boxGeometry args={[sw, sh, sl]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      {pins}
    </group>
  );
};

const Footprint3D: React.FC<{ 
  data: FootprintData, 
  onPinSelect: (num: string) => void,
  selectedPinNumber: string | null 
}> = ({ data, onPinSelect, selectedPinNumber }) => {
  return (
    <div className="relative w-full h-[400px] bg-slate-50 rounded-xl overflow-hidden border border-slate-300 shadow-sm">
       <div className="absolute top-3 left-3 z-10">
        <span className="bg-white/90 px-2 py-0.5 rounded text-[9px] font-bold text-blue-600 uppercase border border-blue-100">3D Model</span>
      </div>
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={35} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
          <ComponentModel data={data} onPinSelect={onPinSelect} selectedPinNumber={selectedPinNumber} />
          <ContactShadows opacity={0.3} scale={20} blur={2.5} far={0.8} color="#000000" />
          <Grid infiniteGrid sectionSize={2} cellSize={0.5} sectionColor="#cbd5e1" cellColor="#f1f5f9" position={[0, -0.01, 0]} />
          <OrbitControls enableDamping />
        </Suspense>
      </Canvas>
    </div>
  );
};

// --- Main Visualizer Component ---

export const VisualPreview: React.FC<{ 
    data: FootprintData,
    mode?: 'schematic' | 'footprint' | '3d' // Optional now
}> = ({ data }) => {
  const [selectedPinNumber, setSelectedPinNumber] = useState<string | null>(null);

  if (!data) return null;

  const selectedPinInfo = useMemo(() => {
    if (!selectedPinNumber || !data.pins) return null;
    return data.pins.find(p => p.pin_number === selectedPinNumber);
  }, [selectedPinNumber, data.pins]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-700">
        <SchematicSymbol2D 
            pins={data.pins || []} 
            name={data.component?.name || 'U?'} 
            onPinSelect={setSelectedPinNumber} 
            selectedPinNumber={selectedPinNumber}
        />
        <Footprint2D 
            kicadMod={data.kicadMod} 
            onPinSelect={setSelectedPinNumber} 
            selectedPinNumber={selectedPinNumber} 
        />
        <Footprint3D 
            data={data} 
            onPinSelect={setSelectedPinNumber} 
            selectedPinNumber={selectedPinNumber} 
        />
      </div>

      {selectedPinNumber && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <div className="glass rounded-xl border border-blue-500/30 p-5 shadow-xl bg-blue-900/10 backdrop-blur-md">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-4">
                  {selectedPinNumber}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">
                    {selectedPinInfo?.pin_name || `PIN ${selectedPinNumber}`}
                  </h4>
                  <p className="text-[10px] font-semibold uppercase text-blue-400 tracking-wider">
                    {selectedPinInfo?.electrical_type || 'Unknown Type'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedPinNumber(null)} className="text-slate-400 hover:text-white p-1">
                <i className="fas fa-times"></i>
              </button>
            </div>
            {selectedPinInfo?.description && (
              <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-700/50">
                {selectedPinInfo.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
