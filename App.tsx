
import React, { useState, useCallback, useRef } from 'react';
import { FootprintData, ProjectMetadata } from './types';
import { analyzeDatasheet } from './services/geminiService';
import { VisualPreview } from './components/VisualPreview';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [datasheetUrl, setDatasheetUrl] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FootprintData | null>(null);
  const [sources, setSources] = useState<any[] | null>(null);
  
  const [viewMode, setViewMode] = useState<'visual' | 'validation' | 'code'>('visual');
  
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    libraryName: 'MyProject',
    footprintName: 'PACKAGE_VARIANT',
    modelName: 'PACKAGE_VARIANT'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setSources(null);
    }
  };

  const handleProcess = async () => {
    if (!previewUrl && !datasheetUrl) {
      setError("Please upload a file or provide a datasheet URL.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const { data, sources } = await analyzeDatasheet(
        previewUrl, 
        file?.type || null, 
        datasheetUrl, 
        userNotes, 
        metadata
      );
      setResult(data);
      setSources(sources || null);
      setViewMode('visual');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Auto Footprint Generator
          </h1>
          <p className="text-slate-400 mt-2 flex items-center">
            Professional EDA Asset Generator
            <span className="mx-3 text-slate-700">|</span>
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-500/20 uppercase">Integrated Design Workspace</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <section className="glass rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
              <i className="fas fa-file-alt mr-2 text-blue-400"></i> 1. Datasheet Source
            </h2>
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
              >
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                {file ? (
                  <div className="text-center">
                    <i className="fas fa-file-invoice text-2xl text-emerald-400 mb-2"></i>
                    <p className="text-xs font-medium truncate max-w-[200px] text-white">{file.name}</p>
                  </div>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt text-2xl text-slate-500 mb-2"></i>
                    <p className="text-xs text-slate-400 text-center">Click to upload datasheet</p>
                  </>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <i className="fas fa-link"></i>
                </span>
                <input 
                  type="url" value={datasheetUrl} onChange={(e) => setDatasheetUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Or enter PDF URL"
                />
              </div>
            </div>
          </section>

          <section className="glass rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
              <i className="fas fa-cog mr-2 text-blue-400"></i> 2. Configuration
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <input 
                  type="text" value={metadata.libraryName}
                  onChange={(e) => setMetadata({...metadata, libraryName: e.target.value})}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Library Name"
                />
                <input 
                  type="text" value={metadata.footprintName}
                  onChange={(e) => setMetadata({...metadata, footprintName: e.target.value})}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Component Name"
                />
              </div>
              <textarea 
                value={userNotes} onChange={(e) => setUserNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Specific instructions..."
              />
            </div>
          </section>

          <button
            onClick={handleProcess}
            disabled={(!file && !datasheetUrl) || isAnalyzing}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all ${(!file && !datasheetUrl) || isAnalyzing ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/20 text-white'}`}
          >
            {isAnalyzing ? <><i className="fas fa-spinner fa-spin mr-2"></i> Generating...</> : <><i className="fas fa-magic mr-2"></i> Generate & Cross-Check</>}
          </button>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm"><i className="fas fa-exclamation-triangle mr-2"></i> {error}</div>}
        </div>

        <div className="lg:col-span-9 space-y-6">
          {result ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-700 pb-4 overflow-x-auto">
                <div className="flex space-x-2">
                  {[
                    { id: 'visual', label: 'Integrated Lab View', icon: 'th-large' },
                    { id: 'validation', label: 'Consistency Report', icon: 'check-double' },
                    { id: 'code', label: 'CAD Source Files', icon: 'file-export' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setViewMode(tab.id as any)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${viewMode === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      <i className={`fas fa-${tab.icon} mr-2`}></i> {tab.label}
                      {tab.id === 'validation' && result.validationReport && (
                        <span className={`ml-2 w-2 h-2 rounded-full ${result.validationReport.status === 'PASS' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === 'visual' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Package', value: result.packageType, icon: 'box' },
                      { label: 'Pins', value: result.pinCount, icon: 'th' },
                      { label: 'Manufacturer', value: result.component?.manufacturer || 'Unknown', icon: 'industry' },
                      { label: 'Units', value: result.units, icon: 'ruler' }
                    ].map((item, i) => (
                      <div key={i} className="glass p-4 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center">
                          <i className={`fas fa-${item.icon} mr-1.5 text-blue-500/60`}></i> {item.label}
                        </p>
                        <p className="text-xs font-mono text-slate-200 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <VisualPreview data={result} />
                </div>
              )}

              {viewMode === 'validation' && result.validationReport && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className={`p-6 rounded-2xl border flex items-center justify-between ${result.validationReport.status === 'PASS' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div>
                      <h3 className={`text-2xl font-bold ${result.validationReport.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.validationReport.status === 'PASS' ? 'Consistency Validation Passed' : 'Validation Failed'}
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">Symbol ↔ Footprint ↔ Datasheet Consistency</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6 rounded-xl border border-slate-700">
                      <h4 className="text-red-400 font-bold mb-4 flex items-center"><i className="fas fa-bug mr-2"></i> Errors</h4>
                      <ul className="space-y-2">
                        {result.validationReport.errors.length > 0 ? result.validationReport.errors.map((e, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-red-500 mr-2 mt-1">•</span> {e}</li>
                        )) : <li className="text-sm text-slate-500 italic">No errors detected.</li>}
                      </ul>
                    </div>
                    <div className="glass p-6 rounded-xl border border-slate-700">
                      <h4 className="text-amber-400 font-bold mb-4 flex items-center"><i className="fas fa-exclamation-triangle mr-2"></i> Warnings</h4>
                      <ul className="space-y-2">
                        {result.validationReport.warnings.length > 0 ? result.validationReport.warnings.map((w, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-amber-500 mr-2 mt-1">•</span> {w}</li>
                        )) : <li className="text-sm text-slate-500 italic">No warnings.</li>}
                      </ul>
                    </div>
                  </div>

                  <div className="glass rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
                      <h4 className="font-bold text-sm text-white flex items-center"><i className="fas fa-table mr-2 text-blue-400"></i> Pin Traceability</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400">
                          <tr>
                            <th className="p-4 border-b border-slate-700">Pin</th>
                            <th className="p-4 border-b border-slate-700">Name</th>
                            <th className="p-4 border-b border-slate-700">Pad</th>
                            <th className="p-4 border-b border-slate-700">Type</th>
                            <th className="p-4 border-b border-slate-700">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-300">
                          {result.validationReport.traceability.map((row, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-white/5">
                              <td className="p-4 font-mono font-bold text-blue-400">{row.pin_number}</td>
                              <td className="p-4">{row.pin_name}</td>
                              <td className="p-4 font-mono">{row.footprint_pad}</td>
                              <td className="p-4 capitalize">{row.electrical_type}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.status === 'MATCH' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{row.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'code' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="glass rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center text-white">
                      <h3 className="font-bold text-sm flex items-center"><i className="fas fa-project-diagram mr-2 text-indigo-400"></i> .kicad_sym (Symbol)</h3>
                      <button onClick={() => downloadFile(result.symbol?.kicad_symbol_text || '', `${metadata.footprintName}.kicad_sym`)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"><i className="fas fa-download"></i></button>
                    </div>
                    <pre className="p-4 text-[11px] leading-relaxed text-indigo-300 overflow-x-auto max-h-[350px] bg-slate-900/50"><code>{result.symbol?.kicad_symbol_text}</code></pre>
                  </div>
                  <div className="glass rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center text-white">
                      <h3 className="font-bold text-sm flex items-center"><i className="fas fa-microchip mr-2 text-orange-400"></i> .kicad_mod (Footprint)</h3>
                      <button onClick={() => downloadFile(result.kicadMod, `${metadata.footprintName}.kicad_mod`)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"><i className="fas fa-download"></i></button>
                    </div>
                    <pre className="p-4 text-[11px] leading-relaxed text-blue-300 overflow-x-auto max-h-[350px] bg-slate-900/50"><code>{result.kicadMod}</code></pre>
                  </div>
                  <div className="glass rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center text-white">
                      <h3 className="font-bold text-sm flex items-center"><i className="fas fa-cube mr-2 text-emerald-400"></i> .scad (3D Script)</h3>
                      <button onClick={() => downloadFile(result.stepScript, `${metadata.modelName}.scad`)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"><i className="fas fa-download"></i></button>
                    </div>
                    <pre className="p-4 text-[11px] leading-relaxed text-emerald-300 overflow-x-auto max-h-[350px] bg-slate-900/50"><code>{result.stepScript}</code></pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] glass rounded-3xl border border-slate-700 border-dashed text-slate-600">
              <div className="relative mb-8">
                <i className="fas fa-microchip text-8xl opacity-10"></i>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-wand-magic-sparkles text-3xl text-blue-500 animate-pulse"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-400">Professional Asset Lab</p>
              <p className="mt-2 text-sm max-w-sm text-center px-6">
                Upload a datasheet or component image. We generate the symbol, footprint, and 3D model in parallel with synchronized cross-probing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
