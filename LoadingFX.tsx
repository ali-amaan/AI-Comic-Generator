
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';

const LOADING_FX = ["POW!", "BAM!", "ZAP!", "KRAK!", "SKREEE!", "WHOOSH!", "THWIP!", "BOOM!"];

interface LoadingFXProps {
    latestLog?: string;
}

export const LoadingFX: React.FC<LoadingFXProps> = ({ latestLog }) => {
    const [particles, setParticles] = useState<{id: number, text: string, x: string, y: string, rot: number, color: string}[]>([]);
    useEffect(() => {
        const interval = setInterval(() => {
            const id = Date.now();
            const text = LOADING_FX[Math.floor(Math.random() * LOADING_FX.length)];
            const x = `${20 + Math.random() * 60}%`;
            const y = `${20 + Math.random() * 60}%`;
            const rot = Math.random() * 60 - 30;
            const colors = ['text-yellow-400', 'text-red-500', 'text-blue-400', 'text-orange-500', 'text-purple-500'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            setParticles(prev => [...prev, { id, text, x, y, rot, color }].slice(-4));
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-full bg-white overflow-hidden relative border-r-4 border-gray-300">
            <style>{`
              @keyframes comic-pop {
                  0% { transform: translate(-50%, -50%) scale(0.2) rotate(var(--rot)); opacity: 0; }
                  20% { transform: translate(-50%, -50%) scale(1.5) rotate(var(--rot)); opacity: 1; }
                  40% { transform: translate(-50%, -50%) scale(1.0) rotate(var(--rot)); opacity: 1; }
                  80% { opacity: 1; }
                  100% { transform: translate(-50%, -50%) scale(1.1) rotate(var(--rot)); opacity: 0; }
              }
            `}</style>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-100 to-white opacity-50" />
            {particles.map(p => (
                <div key={p.id} 
                     className={`absolute font-comic text-5xl md:text-7xl font-bold ${p.color} select-none whitespace-nowrap z-10`}
                     style={{ left: p.x, top: p.y, '--rot': `${p.rot}deg`, animation: 'comic-pop 1.8s forwards ease-out', textShadow: '3px 3px 0px black, 0 0 20px rgba(255,255,255,0.8)' } as React.CSSProperties}>
                    {p.text}
                </div>
            ))}
            
            <div className="absolute bottom-16 inset-x-0 flex flex-col items-center gap-2 z-20 px-4 text-center">
                <p className="font-comic text-xl text-gray-400 animate-pulse tracking-widest uppercase">Inking Page...</p>
                {latestLog && (
                    <p className="font-mono text-[10px] text-blue-600 bg-blue-50 px-2 py-1 border border-blue-200 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                        <span className="font-bold mr-1">&gt;</span>{latestLog}
                    </p>
                )}
            </div>
        </div>
    );
};
