
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { GENRES, LANGUAGES, Persona, ApiStatus } from './types';

interface SetupProps {
    show: boolean;
    isTransitioning: boolean;
    isLaunching: boolean;
    logs: string[];
    hero: Persona | null;
    friend: Persona | null;
    selectedGenre: string;
    selectedLanguage: string;
    customPremise: string;
    richMode: boolean;
    refStrength: number;
    apiStatus: ApiStatus;
    apiErrorMessage: string | null;
    onHeroUpload: (file: File) => void;
    onFriendUpload: (file: File) => void;
    onGenreChange: (val: string) => void;
    onLanguageChange: (val: string) => void;
    onPremiseChange: (val: string) => void;
    onRichModeChange: (val: boolean) => void;
    onRefStrengthChange: (val: number) => void;
    onLaunch: () => void;
    onTestConnection: () => void;
    onTestReferenceGen: () => void;
}


export const Setup: React.FC<SetupProps> = (props) => {
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [props.logs]);

    if (!props.show && !props.isTransitioning) return null;

    return (
        <>
        <style>{`
             @keyframes knockout-exit {
                0% { transform: scale(1) rotate(1deg); }
                15% { transform: scale(1.1) rotate(-5deg); }
                100% { transform: translateY(-200vh) rotate(1080deg) scale(0.5); opacity: 1; }
             }
             @keyframes pow-enter {
                 0% { transform: translate(-50%, -50%) scale(0) rotate(-45deg); opacity: 0; }
                 30% { transform: translate(-50%, -50%) scale(1.5) rotate(10deg); opacity: 1; }
                 100% { transform: translate(-50%, -50%) scale(1.8) rotate(0deg); opacity: 0; }
             }
             @keyframes scanline {
                0% { top: -10%; }
                100% { top: 110%; }
             }
          `}</style>
        {props.isTransitioning && (
            <div className="fixed top-1/2 left-1/2 z-[210] pointer-events-none" style={{ animation: 'pow-enter 1s forwards ease-out' }}>
                <svg viewBox="0 0 200 150" className="w-[500px] h-[400px] drop-shadow-[0_10px_0_rgba(0,0,0,0.5)]">
                    <path d="M95.7,12.8 L110.2,48.5 L148.5,45.2 L125.6,74.3 L156.8,96.8 L119.4,105.5 L122.7,143.8 L92.5,118.6 L60.3,139.7 L72.1,103.2 L34.5,108.8 L59.9,79.9 L24.7,57.3 L62.5,54.4 L61.2,16.5 z" fill="#FFD700" stroke="black" strokeWidth="4"/>
                    <text x="100" y="95" textAnchor="middle" fontFamily="'Bangers', cursive" fontSize="70" fill="#DC2626" stroke="black" strokeWidth="2" transform="rotate(-5 100 75)">POW!</text>
                </svg>
            </div>
        )}
        
        <div className={`fixed inset-0 z-[200] overflow-y-auto`}
             style={{
                 background: props.isTransitioning ? 'transparent' : 'rgba(0,0,0,0.85)', 
                 backdropFilter: props.isTransitioning ? 'none' : 'blur(6px)',
                 animation: props.isTransitioning ? 'knockout-exit 1s forwards cubic-bezier(.6,-0.28,.74,.05)' : 'none',
                 pointerEvents: props.isTransitioning ? 'none' : 'auto'
             }}>
          <div className="min-h-full flex items-center justify-center p-4 pb-32 md:pb-24">
            <div className="max-w-[900px] w-full bg-white p-4 md:p-5 rotate-1 border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
                ƒ
                {/* Generation Console Overlay */}
                {props.isLaunching && (
                    <div className="absolute inset-0 z-[50] bg-black/95 flex flex-col p-8 text-left font-mono border-8 border-yellow-400 rotate-[-1deg]">
                        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400 opacity-20" style={{ animation: 'scanline 3s linear infinite' }} />
                        <h2 className="font-comic text-4xl text-yellow-400 mb-2 uppercase tracking-widest border-b-2 border-yellow-400 pb-2">Generation Console</h2>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 space-y-1">
                            {props.logs.length === 0 ? (
                                <p className="text-yellow-600 animate-pulse">Waiting for interdimensional handshake...</p>
                            ) : (
                                props.logs.map((log, i) => (
                                    <p key={i} className={`text-sm ${log.includes('!!') ? 'text-red-500 font-bold' : log.includes('materialized') || log.includes('inked') ? 'text-green-400' : 'text-yellow-400'}`}>
                                        <span className="mr-2">&gt;</span>{log}
                                    </p>
                                ))
                            )}
                            <div ref={logEndRef} />
                        </div>
                        <div className="mt-4 flex justify-between items-end border-t border-yellow-800 pt-4">
                            <div className="flex gap-4">
                                <div className="text-[10px] text-yellow-800 uppercase">
                                    <p>Model: Gemini 3 Pro</p>
                                    <p>State: Initializing</p>
                                </div>
                                <div className="text-[10px] text-yellow-800 uppercase">
                                    <p>Region: US-CENTRAL1</p>
                                    <p>Latency: Nominal</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                                <span className="text-red-500 font-bold text-xs">REMIXING REALITY...</span>
                            </div>
                        </div>
                    </div>
                )}

                <h1 className="font-comic text-5xl text-red-600 leading-none mb-1 tracking-wide inline-block mr-3" style={{textShadow: '2px 2px 0px black'}}>INFINITE</h1>
                <h1 className="font-comic text-5xl text-yellow-400 leading-none mb-4 tracking-wide inline-block" style={{textShadow: '2px 2px 0px black'}}>HEROES</h1>
                
                <div className="flex flex-col md:flex-row gap-4 mb-4 text-left">
                    
                    {/* Left Column: Cast */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="font-comic text-xl text-black border-b-4 border-black mb-1">1. THE CAST</div>
                        
                        {/* HERO UPLOAD */}
                        <div className={`p-3 border-4 border-dashed ${props.hero ? 'border-green-500 bg-green-50' : 'border-blue-300 bg-blue-50'} transition-colors relative group`}>
                            <div className="flex justify-between items-center mb-1">
                                <p className="font-comic text-lg uppercase font-bold text-blue-900">HERO (REQUIRED)</p>
                                {props.hero && <span className="text-green-600 font-bold font-comic text-sm animate-pulse">✓ READY</span>}
                            </div>
                            
                            {props.hero ? (
                                <div className="flex gap-3 items-center mt-1">
                                     <img src={`data:${props.hero.mimeType};base64,${props.hero.base64}`} alt="Hero Preview" className="w-20 h-20 object-cover border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.2)] bg-white rotate-[-2deg]" />
                                     <label className="cursor-pointer comic-btn bg-yellow-400 text-black text-sm px-3 py-1 hover:bg-yellow-300 transition-transform active:scale-95 uppercase">
                                         REPLACE
                                         <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onHeroUpload(e.target.files[0])} />
                                     </label>
                                </div>
                            ) : (
                                <label className="comic-btn bg-blue-500 text-white text-lg px-3 py-3 block w-full hover:bg-blue-400 cursor-pointer text-center">
                                    UPLOAD HERO 
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onHeroUpload(e.target.files[0])} />
                                </label>
                            )}
                        </div>

                        {/* CO-STAR UPLOAD */}
                        <div className={`p-3 border-4 border-dashed ${props.friend ? 'border-green-500 bg-green-50' : 'border-purple-300 bg-purple-50'} transition-colors`}>
                            <div className="flex justify-between items-center mb-1">
                                <p className="font-comic text-lg uppercase font-bold text-purple-900">CO-STAR (OPTIONAL)</p>
                                {props.friend && <span className="text-green-600 font-bold font-comic text-sm animate-pulse">✓ READY</span>}
                            </div>

                            {props.friend ? (
                                <div className="flex gap-3 items-center mt-1">
                                    <img src={`data:${props.friend.mimeType};base64,${props.friend.base64}`} alt="Co-Star Preview" className="w-20 h-20 object-cover border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.2)] bg-white rotate-[2deg]" />
                                    <label className="cursor-pointer comic-btn bg-yellow-400 text-black text-sm px-3 py-1 hover:bg-yellow-300 transition-transform active:scale-95 uppercase">
                                        REPLACE
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onFriendUpload(e.target.files[0])} />
                                    </label>
                                </div>
                            ) : (
                                <label className="comic-btn bg-purple-500 text-white text-lg px-3 py-3 block w-full hover:bg-purple-400 cursor-pointer text-center">
                                    UPLOAD CO-STAR 
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && props.onFriendUpload(e.target.files[0])} />
                                </label>
                            )}
                        </div>
                        
                    </div>

                    {/* Right Column: Settings */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="font-comic text-xl text-black border-b-4 border-black mb-1">2. THE STORY</div>
                        
                        <div className="bg-yellow-50 p-3 border-4 border-black h-full flex flex-col justify-between">
                            <div>
                                <div className="mb-2">
                                    <p className="font-comic text-base mb-1 font-bold text-gray-800">GENRE</p>
                                    <select value={props.selectedGenre} onChange={(e) => props.onGenreChange(e.target.value)} className="w-full font-comic text-lg p-1 border-2 border-black uppercase bg-white text-black cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,0.2)] focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-none transition-all">
                                        {GENRES.map(g => <option key={g} value={g} className="text-black">{g}</option>)}
                                    </select>
                                </div>

                                <div className="mb-2">
                                    <p className="font-comic text-base mb-1 font-bold text-gray-800">LANGUAGE</p>
                                    <select value={props.selectedLanguage} onChange={(e) => props.onLanguageChange(e.target.value)} className="w-full font-comic text-lg p-1 border-2 border-black uppercase bg-white text-black cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,0.2)]">
                                        {LANGUAGES.map(l => <option key={l.code} value={l.code} className="text-black">{l.name}</option>)}
                                    </select>
                                </div>

                                <div className="mb-2">
                                    <p className="font-comic text-base mb-1 font-bold text-gray-800">LIKENESS STRENGTH</p>
                                    <div className="flex items-center gap-2 bg-white border-2 border-black p-1 shadow-[3px_3px_0px_rgba(0,0,0,0.2)]">
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="3" 
                                            step="1" 
                                            value={props.refStrength} 
                                            onChange={(e) => props.onRefStrengthChange(parseInt(e.target.value))}
                                            className="w-full accent-black cursor-pointer"
                                        />
                                        <span className="font-comic text-lg min-w-[80px] text-center">
                                            {props.refStrength === 1 ? 'LOOSE' : props.refStrength === 3 ? 'STRICT' : 'BALANCED'}
                                        </span>
                                    </div>
                                </div>

                                {props.selectedGenre === 'Custom' && (
                                    <div className="mb-2">
                                        <p className="font-comic text-base mb-1 font-bold text-gray-800">PREMISE</p>
                                        <textarea value={props.customPremise} onChange={(e) => props.onPremiseChange(e.target.value)} placeholder="Enter your story premise..." className="w-full p-1 border-2 border-black font-comic text-lg h-16 resize-none shadow-[3px_3px_0px_rgba(0,0,0,0.2)]" />
                                    </div>
                                )}
                            </div>
                            
                            <label className="flex items-center gap-2 font-comic text-base cursor-pointer text-black mt-1 p-1 hover:bg-yellow-100 rounded border-2 border-transparent hover:border-yellow-300 transition-colors">
                                <input type="checkbox" checked={props.richMode} onChange={(e) => props.onRichModeChange(e.target.checked)} className="w-4 h-4 accent-black" />
                                <span className="text-black">NOVEL MODE (Rich Dialogue)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* API Status Section */}
                <div className="mb-4 text-left border-4 border-black p-3 bg-gray-100 flex flex-col md:flex-row items-center gap-4 relative">
                    <div className="absolute -top-3 left-4 bg-black text-white px-2 font-comic text-xs uppercase tracking-widest">3. COMMS CHECK</div>
                    <div className="flex-1">
                        <p className="font-comic text-lg text-black leading-none">INTERDIMENSIONAL LINK:</p>
                        {props.apiStatus === 'idle' && <p className="text-xs text-gray-500 font-sans">Status: STANDBY. Verify connection before launch.</p>}
                        {props.apiStatus === 'loading' && <p className="text-xs text-blue-600 font-sans font-bold animate-pulse">Status: PINGING MULTIVERSE...</p>}
                        {props.apiStatus === 'success' && <p className="text-xs text-green-600 font-sans font-bold uppercase">Status: LINK ESTABLISHED! ALL CLEAR!</p>}
                        {props.apiStatus === 'error' && <p className="text-xs text-red-600 font-sans font-bold uppercase leading-tight">Status: INTERFERENCE! {props.apiErrorMessage?.slice(0, 100)}...</p>}
                    </div>
                    <div className="flex gap-2">
                         <button 
                            onClick={props.onTestConnection} 
                            disabled={props.apiStatus === 'loading'}
                            className={`comic-btn px-4 py-2 text-lg whitespace-nowrap transition-all ${props.apiStatus === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}
                        >
                            {props.apiStatus === 'loading' ? 'CHECKING...' : 'TEST COMM-LINK'}
                        </button>
                        <button 
                            onClick={props.onTestReferenceGen} 
                            disabled={props.apiStatus === 'loading'}
                            className="comic-btn px-4 py-2 text-lg whitespace-nowrap bg-blue-500 text-white hover:bg-blue-400"
                        >
                            TEST REF-LINK
                        </button>
                    </div>
                </div>

                <button 
                    onClick={props.onLaunch} 
                    disabled={!props.hero || props.isTransitioning || props.isLaunching} 
                    className={`comic-btn text-white text-3xl px-6 py-3 w-full transition-all uppercase tracking-wider ${props.apiStatus === 'success' ? 'bg-red-600 hover:bg-red-500 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-red-600 hover:bg-red-500'} disabled:bg-gray-400 disabled:cursor-not-allowed`}
                >
                    {props.isLaunching ? 'INKING...' : props.isTransitioning ? 'LAUNCHING...' : 'START ADVENTURE!'}
                </button>
            </div>
          </div>
        </div>

        </>
    );
}
