import React, { useState, useRef } from 'react';

const API_BASE = 'https://staging.empromptu.ai/api_tools';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer 3e946f102602f7c3fa91a90a3e690860',
  'X-Generated-App-ID': 'e8850c61-cf4d-438a-8bdd-17adf93965cc',
  'X-Usage-Key': 'e908b484ab7c525fdd929e0e956fa2d4'
};

const DataSummarizer = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [createdObjects, setCreatedObjects] = useState([]);
  const fileInputRef = useRef(null);

  const logApiCall = (method, endpoint, data, response) => {
    const log = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      request: data,
      response
    };
    setApiLogs(prev => [...prev, log]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setInputText(e.target.result);
    };
    reader.readAsText(selectedFile);
  };

  const processData = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text or upload a file to summarize');
      return;
    }

    setLoading(true);
    setError('');
    setSummary('');
    setCurrentStep(2);
    setProgress(0);

    try {
      // Step 1: Ingest the text data
      setProgress(33);
      const ingestData = {
        created_object_name: 'input_text_data',
        data_type: 'strings',
        input_data: [inputText]
      };

      const ingestResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(ingestData)
      });

      const ingestResult = await ingestResponse.json();
      logApiCall('POST', '/input_data', ingestData, ingestResult);

      if (!ingestResponse.ok) {
        throw new Error('Failed to ingest data');
      }

      setCreatedObjects(prev => [...prev, 'input_text_data']);

      // Step 2: Apply summarization prompt
      setProgress(66);
      const promptData = {
        created_object_names: ['summary_result'],
        prompt_string: 'Summarize the following text in exactly 1-2 clear, concise sentences that capture the main points: {input_text_data}',
        inputs: [{
          input_object_name: 'input_text_data',
          mode: 'combine_events'
        }]
      };

      const promptResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(promptData)
      });

      const promptResult = await promptResponse.json();
      logApiCall('POST', '/apply_prompt', promptData, promptResult);

      if (!promptResponse.ok) {
        throw new Error('Failed to generate summary');
      }

      setCreatedObjects(prev => [...prev, 'summary_result']);

      // Step 3: Retrieve the summary
      setProgress(100);
      const retrieveData = {
        object_name: 'summary_result',
        return_type: 'pretty_text'
      };

      const retrieveResponse = await fetch(`${API_BASE}/return_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(retrieveData)
      });

      const result = await retrieveResponse.json();
      logApiCall('POST', '/return_data', retrieveData, result);

      if (!retrieveResponse.ok) {
        throw new Error('Failed to retrieve summary');
      }

      setSummary(result.value || 'No summary generated');
      setCurrentStep(3);

    } catch (err) {
      setError(err.message || 'An error occurred while summarizing');
      setCurrentStep(1);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const clearAll = () => {
    setInputText('');
    setFile(null);
    setSummary('');
    setError('');
    setCurrentStep(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteObjects = async () => {
    for (const objectName of createdObjects) {
      try {
        const response = await fetch(`${API_BASE}/objects/${objectName}`, {
          method: 'DELETE',
          headers: API_HEADERS
        });
        logApiCall('DELETE', `/objects/${objectName}`, null, await response.text());
      } catch (err) {
        console.error(`Failed to delete ${objectName}:`, err);
      }
    }
    setCreatedObjects([]);
  };

  const downloadCSV = () => {
    const csvContent = `Summary\n"${summary.replace(/"/g, '""')}"`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Data Summarizer
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  aria-label="Toggle debug information"
                >
                  {showDebug ? 'Hide' : 'Show'} Debug
                </button>
                <button
                  onClick={deleteObjects}
                  disabled={createdObjects.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                  aria-label="Delete created objects"
                >
                  Delete Objects
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? 'âï¸' : 'ð'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step 
                        ? 'bg-primary-600' 
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Upload */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Upload Your Data
                </h2>
                
                {/* File Upload Area */}
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload file area"
                >
                  <div className="text-6xl mb-4">ð</div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Supports text files (.txt, .csv, .json)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.csv,.json"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    aria-label="File input"
                  />
                </div>

                {file && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-green-800 dark:text-green-200">
                      â File loaded: {file.name}
                    </p>
                  </div>
                )}

                {/* Text Input Area */}
                <div className="mt-6">
                  <label htmlFor="textInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Or paste your text directly:
                  </label>
                  <textarea
                    id="textInput"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your text data here..."
                    className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    aria-describedby="textInputHelp"
                  />
                  <p id="textInputHelp" className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {inputText.length} characters
                  </p>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200">â {error}</p>
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <button
                    onClick={clearAll}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    aria-label="Clear all data"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={processData}
                    disabled={!inputText.trim()}
                    className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    aria-label="Generate summary"
                  >
                    Generate Summary
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Processing */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                <div className="spinner mx-auto mb-6"></div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Processing Your Data
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Analyzing and generating summary...
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{progress}% complete</p>
                <button
                  onClick={() => {
                    setLoading(false);
                    setCurrentStep(1);
                  }}
                  className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  aria-label="Cancel processing"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Summary Results
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="table table-striped table-hover w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Field
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Content
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          Summary
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <div className="max-w-2xl">
                            {summary}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          Original Length
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {inputText.length} characters
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          Summary Length
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {summary.length} characters
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    aria-label="Process new data"
                  >
                    Process New Data
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    aria-label="Download results as CSV"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Debug Panel */}
          {showDebug && (
            <div className="mt-8 max-w-6xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  API Debug Information
                </h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {apiLogs.map((log, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {log.method} {log.endpoint}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                          Request/Response Details
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Request:</p>
                            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.request, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Response:</p>
                            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataSummarizer;
