const fs = require('fs');
const path = require('path');

const replicaCounts = [1, 3, 10];
const vuLevels = [20, 50, 100, 200, 500];
const results = [];

for (const replicas of replicaCounts) {
  for (const vus of vuLevels) {
    const file = path.join(__dirname, `summary_${replicas}rep_${vus}vus.json`);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const m = data.metrics;

      const reqsRate = m.http_reqs ? m.http_reqs.rate.toFixed(1) : 'N/A';
      const failedRate = m.http_req_failed ? (m.http_req_failed.value * 100).toFixed(2) + '%' : '0.00%';
      const avg = m.http_req_duration ? m.http_req_duration.avg.toFixed(2) + ' ms' : 'N/A';
      const p95 = m.http_req_duration ? m.http_req_duration['p(95)'].toFixed(2) + ' ms' : 'N/A';
      const max = m.http_req_duration ? m.http_req_duration.max.toFixed(2) + ' ms' : 'N/A';

      const durFailed = m.http_req_duration && m.http_req_duration.thresholds ? m.http_req_duration.thresholds['p(95)<250'] : false;
      const reqFailed = m.http_req_failed && m.http_req_failed.thresholds ? m.http_req_failed.thresholds['rate<0.01'] : false;
      const status = (!durFailed && !reqFailed) ? 'PASS' : 'FAIL';

      results.push({
        replicas,
        vus,
        reqsRate,
        failedRate,
        avg,
        p95,
        max,
        status
      });
    }
  }
}

console.log('\n### Tabla Completa del Punto de Degradación (Reto 3)\n');
console.log('| Réplicas | VUs | Requests/s | Failed % | Avg | p(95) | Max | PASS/FAIL |');
console.log('|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|');
results.forEach(r => {
  console.log(`| ${r.replicas} | ${r.vus} | ${r.reqsRate} | ${r.failedRate} | ${r.avg} | ${r.p95} | ${r.max} | **${r.status}** |`);
});

fs.writeFileSync(path.join(__dirname, 'degradation-results-clean.json'), JSON.stringify(results, null, 2));
