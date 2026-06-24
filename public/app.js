const API_URL = '/api/latest';
let historyChart = null;

// DOM Elements
const elSoil = document.getElementById('soil-moisture');
const barSoil = document.getElementById('soil-bar');
const elWater = document.getElementById('water-tank');
const barWater = document.getElementById('water-bar');
const elTemp = document.getElementById('temperature');
const elHumid = document.getElementById('humidity');
const elLight = document.getElementById('light-status');
const iconLight = document.getElementById('light-icon');
const elPump = document.getElementById('pump-status');
const elConn = document.getElementById('connection-status');

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    // Create gradient for Water
    const gradientWater = ctx.createLinearGradient(0, 0, 0, 400);
    gradientWater.addColorStop(0, 'rgba(0, 210, 255, 0.5)');
    gradientWater.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

    // Create gradient for Soil
    const gradientSoil = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSoil.addColorStop(0, 'rgba(0, 230, 118, 0.5)');
    gradientSoil.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    Chart.defaults.color = '#a0aec0';
    Chart.defaults.font.family = "'Inter', sans-serif";

    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Water Tank Level (%)',
                    borderColor: '#00d2ff',
                    backgroundColor: gradientWater,
                    borderWidth: 2,
                    pointBackgroundColor: '#00d2ff',
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.4,
                    data: []
                },
                {
                    label: 'Soil Moisture (%)',
                    borderColor: '#00e676',
                    backgroundColor: gradientSoil,
                    borderWidth: 2,
                    pointBackgroundColor: '#00e676',
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.4,
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(22, 28, 45, 0.9)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

// Update UI Functions
function updateDashboard(data) {
    if(!data || data.length === 0) {
        elConn.textContent = "Waiting for data...";
        elConn.style.color = "#ff9100";
        return;
    }

    const latest = data[0];
    
    // Status
    elConn.textContent = "Live";
    elConn.style.color = "var(--soil)";

    // Update Values
    elSoil.innerHTML = `${latest.soil_moisture.toFixed(1)}<span class="unit">%</span>`;
    barSoil.style.width = `${latest.soil_moisture}%`;
    
    elWater.innerHTML = `${latest.water_tank_level.toFixed(1)}<span class="unit">%</span>`;
    barWater.style.width = `${latest.water_tank_level}%`;

    elTemp.innerHTML = `${latest.temperature.toFixed(1)}<span class="unit">°C</span>`;
    elHumid.innerHTML = `${latest.humidity.toFixed(1)}<span class="unit">%</span>`;

    // Process Light logic (approximate thresholds from the ESP code)
    if(latest.light_intensity < 50) {
        elLight.textContent = "Dark";
        iconLight.className = "fa-solid fa-moon icon-light";
        iconLight.style.color = "#a0aec0";
    } else {
        elLight.textContent = "Bright";
        iconLight.className = "fa-solid fa-sun icon-light";
        iconLight.style.color = "var(--light)";
    }

    // Process Pump logic
    if(latest.pump_status === 1) {
        elPump.textContent = "ON";
        elPump.className = "status-badge status-on";
    } else {
        elPump.textContent = "OFF";
        elPump.className = "status-badge status-off";
    }

    // Update Chart (reverse data so oldest is first on left)
    const reversedData = [...data].reverse();
    
    const labels = reversedData.map(row => {
        const d = new Date(row.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    });
    const waterData = reversedData.map(r => r.water_tank_level);
    const soilData = reversedData.map(r => r.soil_moisture);

    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = waterData;
    historyChart.data.datasets[1].data = soilData;
    historyChart.update();
}

// Fetch Data Loop
async function fetchLatestData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        updateDashboard(data);
    } catch (err) {
        console.error("Error fetching data:", err);
        elConn.textContent = "Offline";
        elConn.style.color = "var(--pump-off)";
    }
}

// Boot up
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    
    // Initial data load
    fetchLatestData();
    
    // Connect to SSE for instant real-time updates
    const evtSource = new EventSource('/api/stream');
    
    evtSource.onmessage = (event) => {
        const newData = JSON.parse(event.data);
        if (newData.status === 'connected') return;
        
        console.log("Real-time data incoming:", newData);
        // Refresh the dashboard immediately when new data arrives!
        fetchLatestData(); 
    };

    evtSource.onerror = () => {
        elConn.textContent = "Reconnecting...";
        elConn.style.color = "#ff9100";
    };
});
