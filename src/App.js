import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 1000 }) => {
    const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const [currentValue, setCurrentValue] = React.useState(numericValue);
    const animationFrameRef = React.useRef(null);

    React.useEffect(() => {
        if (numericValue !== currentValue) {
            const start = performance.now();
            const startValue = currentValue;

            const animate = (currentTime) => {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
                setCurrentValue(Math.floor(startValue + (numericValue - startValue) * easedProgress));

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    setCurrentValue(numericValue);
                }
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [numericValue, duration]);

    return <p className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{currentValue.toLocaleString()}</p>;
};

// --- API Calls ---

const fetchGlobalData = async () => {
    try {
        const response = await fetch('https://disease.sh/v3/covid-19/all');
        if (!response.ok) {
            throw new Error(`Failed to fetch global data: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            totalCases: data.cases,
            totalDeaths: data.deaths,
            totalRecovered: data.recovered,
            totalTests: data.tests || 0
        };
    } catch (error) {
        console.error("Error in fetchGlobalData:", error);
        throw error;
    }
};

const processHistoricalData = (casesData, recoveredData, vaccineData) => {
    const dates = new Set([
        ...Object.keys(casesData || {}),
        ...Object.keys(recoveredData || {}),
        ...Object.keys(vaccineData || {})
    ].sort((a, b) => new Date(a) - new Date(b)));

    const processedData = Array.from(dates).map(date => ({
        date: date,
        cases: casesData ? casesData[date] || 0 : 0,
        recovered: recoveredData ? recoveredData[date] || 0 : 0,
        vaccines: vaccineData ? vaccineData[date] || 0 : 0,
    }));
    return processedData;
};

const fetchDataForCountry = async (countryName) => {
    try {
        const countryResponse = await fetch(`https://disease.sh/v3/covid-19/countries/${countryName}?strict=true`);
        if (!countryResponse.ok) {
            if (countryResponse.status === 404) {
                throw new Error(`Country data not found for "${countryName}". Please check the country name.`);
            }
            throw new Error(`Failed to fetch data for ${countryName}: ${countryResponse.statusText}`);
        }
        const data = await countryResponse.json();

        const historicalResponse = await fetch(`https://disease.sh/v3/covid-19/historical/${countryName}?lastdays=365`);
        let historicalTimelineData = null;
        if (historicalResponse.ok) {
            const histData = await historicalResponse.json();
            if (histData && histData.timeline) {
                historicalTimelineData = histData.timeline;
            }
        } else {
            console.warn(`Failed to fetch historical data for ${countryName}: ${historicalResponse.statusText}.`);
        }

        const vaccineResponse = await fetch(`https://disease.sh/v3/covid-19/vaccine/coverage/countries/${countryName}?lastdays=365`);
        let historicalVaccineData = null;
        let totalVaccinatedCount = 0;
        if (vaccineResponse.ok) {
            const vacData = await vaccineResponse.json();
            if (vacData && vacData.timeline) {
                historicalVaccineData = vacData.timeline;
                const vaccineDates = Object.keys(historicalVaccineData);
                if (vaccineDates.length > 0) {
                    totalVaccinatedCount = historicalVaccineData[vaccineDates[vaccineDates.length - 1]];
                }
            }
        } else {
            console.warn(`Failed to fetch vaccination data for ${countryName}: ${vaccineResponse.statusText}.`);
        }

        const historicalChartData = processHistoricalData(
            historicalTimelineData?.cases,
            historicalTimelineData?.recovered,
            historicalVaccineData
        );

        return {
            cases: data.cases,
            deaths: data.deaths,
            recovered: data.recovered,
            activeCases: data.active,
            newCasesToday: data.todayCases,
            newDeathsToday: data.todayDeaths,
            newRecoveredToday: data.todayRecovered,
            totalVaccinated: totalVaccinatedCount,
            critical: data.critical,
            casesPerOneMillion: data.casesPerOneMillion,
            population: data.population,
            historicalChartData: historicalChartData,
            countryInfo: data.countryInfo,
        };
    } catch (error) {
        console.error("Error in fetchDataForCountry:", error);
        throw error;
    }
};

const fetchCountryList = async () => {
    try {
        const response = await fetch('https://disease.sh/v3/covid-19/countries');
        if (!response.ok) {
            throw new Error(`Failed to fetch country list: ${response.statusText}`);
        }
        const data = await response.json();
        return data.map(country => country.country).sort();
    } catch (error) {
        console.error("Error in fetchCountryList:", error);
        return [];
    }
};

// Recharts Historical Chart Component
const HistoricalChart = ({ data, dataKey, strokeColor, label, dataKey2, strokeColor2, label2 }) => {
    if (!data || data.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400">No {label} historical data available for charting.</p>;
    }

    return (
        <ResponsiveContainer width="100%" height={250}>
            <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-700" />
                <XAxis dataKey="date" tickFormatter={(tick) => {
                    const date = new Date(tick);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                }} className="dark:text-gray-300" />
                <YAxis className="dark:text-gray-300" />
                <Tooltip formatter={(value) => value.toLocaleString()} labelFormatter={(label) => `Date: ${label}`} />
                <Legend />
                <Line type="monotone" dataKey={dataKey} stroke={strokeColor} activeDot={{ r: 8 }} name={label} />
                {dataKey2 && strokeColor2 && label2 && (
                    <Line type="monotone" dataKey={dataKey2} stroke={strokeColor2} activeDot={{ r: 8 }} name={label2} />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
};

// Basic Linear Regression for Forecasting
const forecastData = (historicalData, daysToForecast = 7) => {
    if (!historicalData || historicalData.length < 10) { // Need enough data points for a meaningful trend
        return [];
    }

    // Simple Linear Regression: y = mx + b
    // x = day index, y = cases
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    const n = historicalData.length;

    historicalData.forEach((d, i) => {
        sumX += i;
        sumY += d.cases; // Forecasting cases for simplicity
        sumXY += (i * d.cases);
        sumX2 += (i * i);
    });

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    const lastDate = new Date(historicalData[n - 1].date);
    const forecasted = [];

    for (let i = 1; i <= daysToForecast; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + i);
        const forecastedCases = Math.max(0, Math.round(m * (n + i - 1) + b)); // Ensure non-negative cases
        forecasted.push({
            date: nextDate.toISOString().split('T')[0], // Format date as YYYY-MM-DD
            cases: forecastedCases,
            isForecast: true
        });
    }
    return forecasted;
};

// AI Assistant Component
const AIAssistant = () => {
    const [messages, setMessages] = React.useState([]);
    const [input, setInput] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const messagesEndRef = React.useRef(null);

    const sendMessage = async () => {
        if (input.trim() === '') return;

        const userMessage = { role: 'user', text: input };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setInput('');
        setIsSending(true);

        try {
            let chatHistory = messages.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
            chatHistory.push({ role: "user", parts: [{ text: input }] });

            const payload = { contents: chatHistory };
            const apiKey = ""; // Leave as-is, Canvas will provide it at runtime.
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const assistantText = result.candidates[0].content.parts[0].text;
                setMessages((prevMessages) => [...prevMessages, { role: 'assistant', text: assistantText }]);
            } else {
                setMessages((prevMessages) => [...prevMessages, { role: 'assistant', text: 'Sorry, I could not get a response. Please try again.' }]);
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setMessages((prevMessages) => [...prevMessages, { role: 'assistant', text: 'Error: Could not connect to the AI assistant.' }]);
        } finally {
            setIsSending(false);
        }
    };

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col h-[500px] dark:bg-gray-800 dark:border-gray-700">
            <h4 className="text-xl font-semibold text-gray-700 mb-4 text-center dark:text-gray-200">COVID-19 AI Assistant</h4>
            <div className="flex-1 overflow-y-auto p-2 border border-gray-300 rounded-md bg-white mb-4 custom-scrollbar dark:bg-gray-700 dark:border-gray-600">
                {messages.length === 0 && (
                    <p className="text-gray-500 text-center mt-4 dark:text-gray-400">Ask me anything about COVID-19!</p>
                )}
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded-lg max-w-[80%] ${
                            msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                        }`}>
                            {msg.text}
                        </span>
                    </div>
                ))}
                {isSending && (
                    <div className="text-left mb-2">
                        <span className="inline-block p-2 rounded-lg bg-gray-200 text-gray-800 animate-pulse dark:bg-gray-600 dark:text-gray-100">
                            Typing...
                        </span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isSending) {
                            sendMessage();
                        }
                    }}
                    placeholder="Type your question..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    disabled={isSending}
                />
                <button
                    onClick={sendMessage}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-r-md transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-700 dark:hover:bg-indigo-800"
                    disabled={isSending}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

// Did You Know Facts
const didYouKnowFacts = [
    "COVID-19 is caused by the SARS-CoV-2 virus, a new strain of coronavirus.",
    "Vaccines significantly reduce the risk of severe illness, hospitalization, and death from COVID-19.",
    "Handwashing for at least 20 seconds with soap and water is crucial for preventing the spread of germs.",
    "Maintaining physical distance helps reduce the transmission of respiratory droplets.",
    "Masks, especially well-fitting ones, are effective in preventing the spread of the virus.",
    "Symptoms can range from mild to severe and may appear 2-14 days after exposure.",
    "Early detection and isolation are key to controlling outbreaks.",
    "The pandemic accelerated the development of mRNA vaccine technology.",
    "Global collaboration was essential in sharing data and research during the pandemic.",
    "Ventilation plays a significant role in reducing indoor transmission risk."
];

// Main App Component
function App() {
    const [selectedCountry, setSelectedCountry] = React.useState('India');
    const [compareCountry, setCompareCountry] = React.useState('');
    const [countryData, setCountryData] = React.useState(null);
    const [compareCountryData, setCompareCountryData] = React.useState(null);
    const [globalData, setGlobalData] = React.useState(null);
    const [countryList, setCountryList] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [lastUpdated, setLastUpdated] = React.useState(new Date());
    const [currentFactIndex, setCurrentFactIndex] = React.useState(0);
    const [darkMode, setDarkMode] = React.useState(false);

    // Toggle Dark Mode
    React.useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Effect to fetch the list of countries once on component mount
    React.useEffect(() => {
        const getCountries = async () => {
            try {
                const countries = await fetchCountryList();
                setCountryList(countries);
            } catch (err) {
                console.error("Error fetching country list:", err);
            }
        };
        getCountries();
    }, []);

    // Effect to fetch global data periodically
    React.useEffect(() => {
        const getGlobal = async () => {
            try {
                const data = await fetchGlobalData();
                setGlobalData(data);
            } catch (err) {
                console.error("Error fetching global data:", err);
            }
        };
        getGlobal();
        const interval = setInterval(getGlobal, 600000); 
        return () => clearInterval(interval);
    }, []);

    // Effect to fetch data for the selected country and compare country periodically
    React.useEffect(() => {
        const getData = async () => {
            setLoading(true);
            setError(null);
            try {
                const mainCountryData = await fetchDataForCountry(selectedCountry);
                setCountryData(mainCountryData);

                if (compareCountry && compareCountry !== selectedCountry) {
                    const compData = await fetchDataForCountry(compareCountry);
                    setCompareCountryData(compData);
                } else {
                    setCompareCountryData(null); // Clear comparison data if not selected or same country
                }
                setLastUpdated(new Date());
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.message || "Failed to load data for the selected country(ies).");
            } finally {
                setLoading(false);
            }
        };
        getData();
        const interval = setInterval(getData, 300000); 
        return () => clearInterval(interval);
    }, [selectedCountry, compareCountry]); // Re-run effect when selectedCountry or compareCountry changes

    // Effect for "Did You Know?" fact carousel
    React.useEffect(() => {
        const factInterval = setInterval(() => {
            setCurrentFactIndex((prevIndex) => (prevIndex + 1) % didYouKnowFacts.length);
        }, 10000); // Change fact every 10 seconds
        return () => clearInterval(factInterval);
    }, []);

    // Prepare data for comparison chart
    const combinedChartData = React.useMemo(() => {
        if (!countryData?.historicalChartData) return [];

        let data = countryData.historicalChartData.map(d => ({
            date: d.date,
            [selectedCountry + ' Cases']: d.cases,
            [selectedCountry + ' Vaccinations']: d.vaccines,
            [selectedCountry + ' Recovered']: d.recovered,
        }));

        if (compareCountryData?.historicalChartData) {
            compareCountryData.historicalChartData.forEach(compD => {
                const existingEntry = data.find(d => d.date === compD.date);
                if (existingEntry) {
                    existingEntry[compareCountry + ' Cases'] = compD.cases;
                    existingEntry[compareCountry + ' Vaccinations'] = compD.vaccines;
                    existingEntry[compareCountry + ' Recovered'] = compD.recovered;
                } else {
                    data.push({
                        date: compD.date,
                        [compareCountry + ' Cases']: compD.cases,
                        [compareCountry + ' Vaccinations']: compD.vaccines,
                        [compareCountry + ' Recovered']: compD.recovered,
                    });
                }
            });
        }
        // Sort by date to ensure correct chart rendering
        return data.sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [countryData, compareCountryData, selectedCountry, compareCountry]);

    // Prepare data for forecasting chart
    const forecastChartData = React.useMemo(() => {
        if (!countryData?.historicalChartData) return [];
        const historicalCases = countryData.historicalChartData.map(d => ({ date: d.date, cases: d.cases }));
        const forecastedCases = forecastData(historicalCases, 14); // Forecast 14 days
        return [...historicalCases, ...forecastedCases];
    }, [countryData]);


    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col transition-colors duration-300">
            <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow transition-colors duration-300">
                {/* Header Section */}
                <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 sm:p-8 text-center rounded-t-xl dark:from-blue-800 dark:to-indigo-900">
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight">
                        COVID-19 Tracker: Global & Country Data
                    </h1>
                    <p className="text-blue-100 text-sm sm:text-base">
                        Powered by disease.sh API
                    </p>
                    <p className="text-blue-200 text-xs mt-2">
                        Last Updated: {lastUpdated.toLocaleString()}
                    </p>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="mt-4 px-4 py-2 bg-white text-gray-800 rounded-full shadow-md hover:bg-gray-100 transition-colors duration-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                    >
                        {darkMode ? 'Light Mode ☀️' : 'Dark Mode 🌙'}
                    </button>
                </header>

                {/* Country Selection Navigation */}
                <nav className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200 dark:bg-gray-700 dark:border-gray-600">
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <label htmlFor="country-select" className="text-lg font-medium text-gray-700 dark:text-gray-200">
                            Select Country:
                        </label>
                        <div className="relative w-full sm:w-auto">
                            <select
                                id="country-select"
                                value={selectedCountry}
                                onChange={(e) => setSelectedCountry(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm appearance-none cursor-pointer bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                            >
                                {countryList.length > 0 ? (
                                    countryList.map((country) => (
                                        <option key={country} value={country}>
                                            {country}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">Loading countries...</option>
                                )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-200">
                                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Compare Country Selector */}
                        <label htmlFor="compare-country-select" className="text-lg font-medium text-gray-700 dark:text-gray-200 sm:ml-8">
                            Compare With:
                        </label>
                        <div className="relative w-full sm:w-auto">
                            <select
                                id="compare-country-select"
                                value={compareCountry}
                                onChange={(e) => setCompareCountry(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm appearance-none cursor-pointer bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                            >
                                <option value="">-- Select Country --</option>
                                {countryList.length > 0 ? (
                                    countryList
                                        .filter(country => country !== selectedCountry) // Don't allow comparing with itself
                                        .map((country) => (
                                            <option key={country} value={country}>
                                                {country}
                                            </option>
                                        ))
                                ) : (
                                    <option value="">Loading countries...</option>
                                )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-200">
                                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Main Dashboard Content */}
                <main className="p-4 sm:p-6 lg:p-8">
                    {/* Loading Indicator */}
                    {loading && (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4 dark:border-blue-300 dark:border-t-transparent"></div>
                            <p className="text-gray-600 text-lg dark:text-gray-300">Loading data for {selectedCountry}{compareCountry && ` and ${compareCountry}`}...</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative text-center mb-8 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                            <strong className="font-bold">Error!</strong>
                            <span className="block sm:inline"> {error}</span>
                            <p className="text-sm mt-2">Please check your internet connection or try selecting another country.</p>
                        </div>
                    )}

                    {/* Global Overview (Always show if loaded) */}
                    {globalData && (
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 transition-colors duration-300">
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center dark:text-gray-100">
                                Global COVID-19 Statistics
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md flex flex-col items-center dark:bg-blue-900 dark:border-blue-700">
                                    <p className="text-lg text-blue-800 dark:text-blue-200">Total Cases:</p>
                                    <AnimatedCounter value={globalData.totalCases} />
                                </div>
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex flex-col items-center dark:bg-red-900 dark:border-red-700">
                                    <p className="text-lg text-red-800 dark:text-red-200">Total Deaths:</p>
                                    <AnimatedCounter value={globalData.totalDeaths} />
                                </div>
                                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex flex-col items-center dark:bg-green-900 dark:border-green-700">
                                    <p className="text-lg text-green-800 dark:text-green-200">Total Recovered:</p>
                                    <AnimatedCounter value={globalData.totalRecovered} />
                                </div>
                                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-md flex flex-col items-center col-span-full sm:col-span-1 sm:col-start-2 dark:bg-purple-900 dark:border-purple-700">
                                    <p className="text-lg text-purple-800 dark:text-purple-200">Total Tests:</p>
                                    <AnimatedCounter value={globalData.totalTests} />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Country-Specific Data (Show only if data is loaded and no error) */}
                    {countryData && !loading && !error && (
                        <div className="space-y-8">
                            {/* Country Overview */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center dark:text-gray-100">
                                    {countryData.countryInfo && countryData.countryInfo.flag && (
                                        <img src={countryData.countryInfo.flag} alt={`${selectedCountry} Flag`} className="w-8 h-auto mr-3 shadow" />
                                    )}
                                    {selectedCountry} Overview
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-red-900 dark:border-red-700">
                                        <h3 className="text-lg font-semibold text-red-700 mb-2 dark:text-red-200">Active Cases</h3>
                                        <AnimatedCounter value={countryData.activeCases} />
                                        <span className="text-red-600 text-sm mt-1 dark:text-red-300">
                                            ({countryData.newCasesToday > 0 ? `+${countryData.newCasesToday}` : countryData.newCasesToday} today)
                                        </span>
                                    </div>
                                    <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-green-900 dark:border-green-700">
                                        <h3 className="text-lg font-semibold text-green-700 mb-2 dark:text-green-200">Total Vaccinations</h3>
                                        <AnimatedCounter value={countryData.totalVaccinated} />
                                        <span className="text-green-600 text-sm mt-1 dark:text-green-300">
                                            (Total doses administered)
                                        </span>
                                    </div>
                                    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-blue-900 dark:border-blue-700">
                                        <h3 className="text-lg font-semibold text-blue-700 mb-2 dark:text-blue-200">Total Recovered</h3>
                                        <AnimatedCounter value={countryData.recovered} />
                                        <span className="text-blue-600 text-sm mt-1 dark:text-blue-300">
                                            ({countryData.newRecoveredToday > 0 ? `+${countryData.newRecoveredToday}` : countryData.newRecoveredToday} today)
                                        </span>
                                    </div>
                                    <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-yellow-900 dark:border-yellow-700">
                                        <h3 className="text-lg font-semibold text-yellow-700 mb-2 dark:text-yellow-200">Critical Cases</h3>
                                        <AnimatedCounter value={countryData.critical} />
                                    </div>
                                    <div className="bg-gray-50 border-l-4 border-gray-500 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-gray-900 dark:border-gray-700">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2 dark:text-gray-200">Cases Per One Million</h3>
                                        <AnimatedCounter value={countryData.casesPerOneMillion} />
                                    </div>
                                    <div className="bg-red-100 border-l-4 border-red-400 rounded-lg p-5 shadow-sm flex flex-col items-center dark:bg-red-900 dark:border-red-700">
                                        <h3 className="text-lg font-semibold text-red-800 mb-2 dark:text-red-200">Total Deaths</h3>
                                        <AnimatedCounter value={countryData.deaths} />
                                        <span className="text-red-700 text-sm mt-1 dark:text-red-300">
                                            ({countryData.newDeathsToday > 0 ? `+${countryData.newDeathsToday}` : countryData.newDeathsToday} today)
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {/* Country Comparison Chart */}
                            {compareCountryData && (
                                <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                        Comparison: {selectedCountry} vs. {compareCountry}
                                    </h3>
                                    <p className="text-gray-600 text-center mb-4 dark:text-gray-300">
                                        Historical Cases Comparison (Last 365 Days)
                                    </p>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-700 dark:border-gray-600">
                                        <HistoricalChart
                                            data={combinedChartData}
                                            dataKey={`${selectedCountry} Cases`}
                                            strokeColor="#ef4444" // Red for selected country
                                            label={`${selectedCountry} Cases`}
                                            dataKey2={`${compareCountry} Cases`}
                                            strokeColor2="#3b82f6" // Blue for compare country
                                            label2={`${compareCountry} Cases`}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2 text-center dark:text-gray-400">
                                        (Note: Vaccination and Recovered trends can also be compared by modifying the chart dataKey)
                                    </p>
                                </section>
                            )}

                            {/* Basic Trend Forecasting Chart */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                    Basic Case Trend & Forecast ({selectedCountry})
                                </h3>
                                <p className="text-gray-600 text-center mb-4 dark:text-gray-300">
                                    Historical Cases with a 14-day basic forecast (linear regression).
                                </p>
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-700 dark:border-gray-600">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart
                                            data={forecastChartData}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-700" />
                                            <XAxis dataKey="date" tickFormatter={(tick) => {
                                                const date = new Date(tick);
                                                return `${date.getMonth() + 1}/${date.getDate()}`;
                                            }} className="dark:text-gray-300" />
                                            <YAxis className="dark:text-gray-300" />
                                            <Tooltip formatter={(value) => value.toLocaleString()} labelFormatter={(label) => `Date: ${label}`} />
                                            <Legend />
                                            <Line type="monotone" dataKey="cases" stroke="#ef4444" name="Actual Cases" dot={false} />
                                            <Line type="monotone" dataKey="cases" stroke="#8884d8" strokeDasharray="5 5" name="Forecast" dot={false}
                                                data={forecastChartData.filter(d => d.isForecast)} // Only draw forecast line for forecast data
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-sm text-gray-500 mt-2 text-center dark:text-gray-400">
                                    *This is a basic statistical forecast and should not be used for medical or critical decision-making. Real-world predictions are complex and require advanced epidemiological models.
                                </p>
                            </section>

                            {/* Trends Chart (Original) */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                    Case & Vaccination Trends ({selectedCountry})
                                </h3>
                                <p className="text-gray-600 text-center mb-4 dark:text-gray-300">
                                    Visualizing the last 365 days of data.
                                </p>
                                <div className="flex flex-col space-y-8">
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-700 dark:border-gray-600">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-2 dark:text-gray-200">Historical Cases</h4>
                                        <HistoricalChart data={countryData.historicalChartData} dataKey="cases" strokeColor="#ef4444" label="Cases" />
                                        <p className="text-sm text-gray-500 mt-2 text-center dark:text-gray-400">
                                            (Daily reported cases)
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-700 dark:border-gray-600">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-2 dark:text-gray-200">Historical Vaccinations</h4>
                                        <HistoricalChart data={countryData.historicalChartData} dataKey="vaccines" strokeColor="#22c55e" label="Vaccinations" />
                                        <p className="text-sm text-gray-500 mt-2 text-center dark:text-gray-400">
                                            (Daily reported total vaccinations)
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 dark:bg-gray-700 dark:border-gray-600">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-2 dark:text-gray-200">Historical Recoveries</h4>
                                        <HistoricalChart data={countryData.historicalChartData} dataKey="recovered" strokeColor="#3b82f6" label="Recoveries" />
                                        <p className="text-sm text-gray-500 mt-2 text-center dark:text-gray-400">
                                            (Daily reported recoveries)
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Emergency & Prevention - Static as API doesn't provide this */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                    Emergency & Prevention
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-5 shadow-sm dark:bg-orange-900 dark:border-orange-700">
                                        <h4 className="text-xl font-semibold text-orange-700 mb-3 dark:text-orange-200">Emergency Contacts (General)</h4>
                                        <ul className="list-disc list-inside text-gray-700 space-y-1 dark:text-gray-300">
                                            <li>For medical emergencies, call your local emergency number (e.g., 911 in US, 112 in EU, 108 in India).</li>
                                            <li>Consult official government health websites or national health services for specific COVID-19 helplines.</li>
                                            <li>Contact your primary healthcare provider for personalized advice.</li>
                                        </ul>
                                    </div>
                                    <div className="bg-teal-50 border-l-4 border-teal-500 rounded-lg p-5 shadow-sm dark:bg-teal-900 dark:border-teal-700">
                                        <h4 className="text-xl font-semibold text-teal-700 mb-3 dark:text-teal-200">Prevention Guidelines</h4>
                                        <ul className="list-disc list-inside text-gray-700 space-y-1 dark:text-gray-300">
                                            <li>Wear masks in crowded places.</li>
                                            <li>Practice frequent hand washing.</li>
                                            <li>Maintain social distancing.</li>
                                            <li>Get vaccinated and boosted.</li>
                                            <li>Stay home if you feel unwell.</li>
                                        </ul>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 mt-4 text-center dark:text-gray-400">
                                    *Detailed local health resource data (e.g., specific available beds, oxygen supply, doctor consultations) are generally not publicly available via common APIs for most countries. Please refer to official local government health websites for the most accurate information.
                                </p>
                            </section>

                            {/* COVID-19 & Vaccination Overview */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                    COVID-19 & Vaccination Snapshot for {selectedCountry}
                                </h3>
                                <p className="text-gray-700 text-lg mb-4 leading-relaxed dark:text-gray-300">
                                    As of {lastUpdated.toLocaleDateString()}, {selectedCountry} has reported a total of <span className="font-semibold text-red-600 dark:text-red-400">{countryData.cases?.toLocaleString()}</span> COVID-19 cases, with <span className="font-semibold text-blue-600 dark:text-blue-400">{countryData.recovered?.toLocaleString()}</span> recoveries, and <span className="font-semibold text-red-800 dark:text-red-300">{countryData.deaths?.toLocaleString()}</span> total deaths.
                                    The active caseload stands at <span className="font-semibold text-orange-600 dark:text-orange-400">{countryData.activeCases?.toLocaleString()}</span>.
                                    A significant effort in vaccination has led to <span className="font-semibold text-green-600 dark:text-green-400">{countryData.totalVaccinated?.toLocaleString()}</span> total vaccine doses administered.
                                    These figures reflect the ongoing public health situation and the country's response to the pandemic.
                                </p>
                                <div className="bg-gray-100 border border-gray-200 rounded-md p-6 text-center text-gray-500 mt-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400">
                                    <p>For more granular, localized data, please consult official government health portals of {selectedCountry}.</p>
                                </div>
                            </section>
                            
                            {/* Did You Know? Section */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center dark:text-gray-100">
                                    Did You Know?
                                </h3>
                                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 text-center shadow-sm dark:bg-blue-900 dark:border-blue-700">
                                    <p className="text-lg font-medium text-blue-800 dark:text-blue-200 transition-opacity duration-1000 ease-in-out">
                                        {didYouKnowFacts[currentFactIndex]}
                                    </p>
                                </div>
                            </section>

                            {/* AI Assistant Section */}
                            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                                <AIAssistant />
                            </section>
                        </div>
                    )}
                </main>
            </div>

            {/* Footer Section */}
            <footer className="mt-8 py-6 bg-gray-800 text-white text-center rounded-b-xl shadow-inner dark:bg-gray-950">
                <div className="max-w-6xl mx-auto px-4">
                    <p className="text-xl font-bold mb-4">Application Features</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">📊 Animated Counters</h4>
                            <p className="text-gray-300">Visually engaging display of real-time statistics.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">📈 Trend Charts (Recharts)</h4>
                            <p className="text-gray-300">Interactive historical data visualization for cases, recoveries, and vaccinations.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">🤖 AI Assistant (Gemini API)</h4>
                            <p className="text-gray-300">Chatbot providing answers to COVID-19 related questions.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">🌍 Country Comparison</h4>
                            <p className="text-gray-300">Compare COVID-19 metrics and trends between two selected countries.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">🔮 Basic Trend Forecasting</h4>
                            <p className="text-gray-300">Simple client-side predictions for future case trends.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">💡 "Did You Know?" Facts</h4>
                            <p className="text-gray-300">Engaging carousel of COVID-19 related facts and tips.</p>
                        </div>
                        <div className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 col-span-full sm:col-span-1 sm:col-start-2 dark:bg-gray-800 dark:hover:bg-gray-700">
                            <h4 className="font-semibold text-lg mb-1">🌓 Dark Mode</h4>
                            <p className="text-gray-300">User-friendly toggle for light and dark themes.</p>
                        </div>
                    </div>
                    <p className="mt-6 text-gray-400 text-xs">
                        All listed features are fully functional and interactive within the application.
                    </p>
                    <p className="mt-2 text-gray-400 text-xs">
                        &copy; {new Date().getFullYear()} COVID-19 Tracker. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default App;
