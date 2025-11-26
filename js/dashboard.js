/* Dashboard Charts (Optional)
   Requires you to include Chart.js in dashboard.html

   <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
*/

function createBarChart(canvasId, labels, data, title) {
    new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: 'rgba(0, 140, 255, 0.6)',
                borderColor: 'rgba(0, 110, 210, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function createPieChart(canvasId, labels, data, title) {
    new Chart(document.getElementById(canvasId), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: [
                    '#0077cc', '#00b894', '#e17055', '#fdcb6e', '#6c5ce7'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}
