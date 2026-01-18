
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ComicFace, INITIAL_PAGES, GATE_PAGE } from './types';
import { LoadingFX } from './LoadingFX';

interface PanelProps {
    face?: ComicFace;
    allFaces: ComicFace[]; 
    logs: string[];
    onChoice: (pageIndex: number, choice: string) => void;
    onOpenBook: () => void;
    onDownload: () => void;
    onReset: () => void;
}

export const Panel: React.FC<PanelProps> = ({ face, allFaces, logs, onChoice, onOpenBook, onDownload, onReset }) => {
    if (!face) return <div className="w-full h-full bg-gray-950" />;
    if (face.isLoading && !face.imageUrl) return <LoadingFX latestLog={logs[logs.length-1]} />;
    
    const isFullBleed = face.type === 'cover' || face.type === 'back_cover';
    const isGateReady = !!allFaces.find(f => f.pageIndex === GATE_PAGE)?.imageUrl;

    return (
        <div className={`panel-container relative group ${isFullBleed ? '!p-0 !bg-[#0a0a0a]' : ''}`}>
            <div className="gloss"></div>
            {face.imageUrl && <img src={face.imageUrl} alt="Comic panel" className={`panel-image ${isFullBleed ? '!object-cover' : ''}`} />}
            
            {/* Decision Buttons */}
            {face.isDecisionPage && face.choices.length > 0 && (
                <div className={`absolute bottom-0 inset-x-0 p-6 pb-12 flex flex-col gap-3 items-center justify-end transition-opacity duration-500 ${face.resolvedChoice ? 'opacity-0 pointer-events-none' : 'opacity-100'} bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20`}>
                    <p className="text-white font-comic text-2xl uppercase tracking-widest animate-pulse">What drives you?</p>
                    {face.choices.map((choice, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); if(face.pageIndex) onChoice(face.pageIndex, choice); }}
                          className={`comic-btn w-full py-3 text-xl font-bold tracking-wider ${i===0?'bg-yellow-400 hover:bg-yellow-300':'bg-blue-500 text-white hover:bg-blue-400'}`}>
                            {choice}
                        </button>
                    ))}
                </div>
            )}

            {/* Cover Action & Console */}
            {face.type === 'cover' && (
                 <>
                    {!isGateReady && (
                        <div className="absolute top-1/4 inset-x-6 z-20 font-mono text-[10px] md:text-xs text-green-400 bg-black/80 p-4 border-2 border-green-500 shadow-[4px_4px_0px_rgba(0,255,0,0.3)] rotate-[-1deg]">
                            <div className="flex justify-between items-center border-b border-green-900 pb-1 mb-2">
                                <span className="uppercase font-bold tracking-widest">Ink-Stream Terminal</span>
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                            </div>
                            <div className="space-y-1 h-32 overflow-hidden flex flex-col justify-end opacity-90">
                                {logs.slice(-5).map((log, i) => (
                                    <p key={i} className="whitespace-nowrap overflow-hidden text-ellipsis">
                                        <span className="opacity-50 mr-1">&gt;</span>{log}
                                    </p>
                                ))}
                            </div>
                            <div className="mt-2 text-green-900 font-bold animate-pulse text-right">INKING PIPELINE ACTIVE...</div>
                        </div>
                    )}

                    <div className="absolute bottom-20 inset-x-0 flex justify-center z-20">
                        <button onClick={(e) => { e.stopPropagation(); onOpenBook(); }}
                        disabled={!isGateReady}
                        className="comic-btn bg-yellow-400 px-10 py-4 text-3xl font-bold hover:scale-105 animate-bounce disabled:animate-none disabled:bg-gray-400 disabled:cursor-wait">
                            {(!isGateReady) ? `PRINTING... ${allFaces.filter(f => f.type==='story' && f.imageUrl && (f.pageIndex||0) <= GATE_PAGE).length}/${INITIAL_PAGES}` : 'READ ISSUE #1'}
                        </button>
                    </div>
                 </>
            )}

            {/* Back Cover Actions */}
            {face.type === 'back_cover' && (
                <div className="absolute bottom-24 inset-x-0 flex flex-col items-center gap-4 z-20">
                    <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="comic-btn bg-blue-500 text-white px-8 py-3 text-xl font-bold hover:scale-105">DOWNLOAD ISSUE</button>
                    <button onClick={(e) => { e.stopPropagation(); onReset(); }} className="comic-btn bg-green-500 text-white px-8 py-4 text-2xl font-bold hover:scale-105">CREATE NEW ISSUE</button>
                </div>
            )}
        </div>
    );
}
