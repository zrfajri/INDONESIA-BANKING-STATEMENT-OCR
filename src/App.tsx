import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, Image as ImageIcon, Lock, Loader2, Download, Trash2, TrendingUp, TrendingDown, Building2, CreditCard } from 'lucide-react';
import { convertPdfToImages, convertImageToBase64 } from './lib/pdfUtils';
import { extractTransactions, Transaction, BankProfile, StatementType } from './services/geminiService';
import { cn } from './lib/utils';

const BANK_PROFILES: BankProfile[] = [
  'Auto-detect',
  'BCA',
  'BNI',
  'CIMB Niaga',
  'Danamon',
  'Krom',
  'Mandiri',
  'Mayapada',
  'UOB'
];

const STATEMENT_TYPES: StatementType[] = [
  'Auto-detect',
  'Savings/Current',
  'Credit Card'
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankProfile>('Auto-detect');
  const [statementType, setStatementType] = useState<StatementType>('Auto-detect');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preloadedImages, setPreloadedImages] = useState<{ data: string; mimeType: string }[] | null>(null);

  const summary = useMemo(() => {
    let inflowCount = 0;
    let outflowCount = 0;
    let inflowTotal = 0;
    let outflowTotal = 0;

    transactions.forEach(t => {
      if (t.type === 'Inflow') {
        inflowCount++;
        inflowTotal += t.amount;
      } else if (t.type === 'Outflow') {
        outflowCount++;
        outflowTotal += t.amount;
      }
    });

    return { inflowCount, outflowCount, inflowTotal, outflowTotal };
  }, [transactions]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setTransactions([]);
    setError(null);
    setShowPasswordPrompt(false);
    setPassword('');
    setPreloadedImages(null);
    
    if (selectedFile.type === 'application/pdf') {
      // Check if it needs a password
      try {
        const images = await convertPdfToImages(selectedFile);
        setPreloadedImages(images);
      } catch (err: any) {
        if (err.message === 'PASSWORD_REQUIRED') {
          setShowPasswordPrompt(true);
        } else {
          setError('Failed to read PDF file.');
        }
      }
    }
  };

  const processFile = async (currentPassword?: string) => {
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      let images: { data: string; mimeType: string }[] = [];
      
      if (file.type === 'application/pdf') {
        if (preloadedImages && !currentPassword) {
          images = preloadedImages;
        } else {
          images = await convertPdfToImages(file, currentPassword);
          setShowPasswordPrompt(false);
        }
      } else if (file.type.startsWith('image/')) {
        images = [await convertImageToBase64(file)];
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or Image.');
      }
      
      const extractedData = await extractTransactions(images, selectedBank, statementType);
      setTransactions(extractedData);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setError('Incorrect password.');
        setShowPasswordPrompt(true);
      } else {
        setError(err.message || 'An error occurred during processing.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processFile(password);
  };

  const exportToCsv = () => {
    if (transactions.length === 0) return;
    
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Category'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(t => 
        `"${t.date}","${t.description.replace(/"/g, '""')}","${t.amount}","${t.type}","${t.category}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `statement_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold tracking-tight">IndoBank Statement OCR</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium mb-4">Upload Statement</h2>
              
              <div className="mb-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    Bank Profile
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value as BankProfile)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {BANK_PROFILES.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    Statement Type
                  </label>
                  <select
                    value={statementType}
                    onChange={(e) => setStatementType(e.target.value as StatementType)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {STATEMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  
                  {selectedBank === 'CIMB Niaga' && statementType === 'Auto-detect' && (
                    <p className="text-xs text-amber-600 mt-1">
                      * For CIMB Combined Statements, it's recommended to select a specific statement type.
                    </p>
                  )}
                  {selectedBank === 'CIMB Niaga' && statementType === 'Savings/Current' && (
                    <p className="text-xs text-amber-600 mt-1">
                      * Only Saving/Current Account transactions will be extracted.
                    </p>
                  )}
                  {selectedBank === 'CIMB Niaga' && statementType === 'Credit Card' && (
                    <p className="text-xs text-amber-600 mt-1">
                      * Only Credit Card transactions will be extracted.
                    </p>
                  )}
                </div>
              </div>

              {!file ? (
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Click or drag file to upload</p>
                  <p className="text-xs text-gray-400">PDF, PNG, JPG supported</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {file.type === 'application/pdf' ? (
                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setFile(null);
                        setTransactions([]);
                        setShowPasswordPrompt(false);
                      }}
                      className="p-1 hover:bg-blue-100 rounded-md text-blue-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {showPasswordPrompt ? (
                    <form onSubmit={handlePasswordSubmit} className="space-y-3">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-amber-800">
                          <Lock className="w-4 h-4" />
                          <span className="text-sm font-medium">Password Protected PDF</span>
                        </div>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter PDF password"
                          className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                          Unlock & Process
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => processFile()}
                      disabled={isProcessing}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing with AI...
                        </>
                      ) : (
                        'Extract Transactions'
                      )}
                    </button>
                  )}
                  
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Instructions</h3>
              <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                <li>Upload your Indonesian bank statement (Credit Card or Savings).</li>
                <li>If it's a password-protected PDF (e.g., BCA, Mandiri e-statements), you will be prompted to enter the password.</li>
                <li>The AI will extract date, description, amount, type, and auto-categorize.</li>
                <li>Export to CSV to easily paste into Google Sheets or Excel.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 space-y-6">
            {transactions.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                  <div className="p-3 bg-green-100 text-green-700 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Inflow ({summary.inflowCount})</p>
                    <p className="text-xl font-bold text-gray-900">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(summary.inflowTotal)}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                  <div className="p-3 bg-red-100 text-red-700 rounded-lg">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Outflow ({summary.outflowCount})</p>
                    <p className="text-xl font-bold text-gray-900">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(summary.outflowTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-medium">Extracted Data</h2>
                <button
                  onClick={exportToCsv}
                  disabled={transactions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              
              <div className="flex-1 overflow-auto">
                {transactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                    {isProcessing ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p>Analyzing document with Gemini 3.1 Pro...</p>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p>No data extracted yet. Upload a statement to begin.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Description</th>
                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {transactions.map((t, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-gray-600">{t.date}</td>
                          <td className="px-6 py-4 text-gray-900 font-medium max-w-[300px] truncate" title={t.description}>
                            {t.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(t.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium",
                              t.type === 'Inflow' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            )}>
                              {t.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {t.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
