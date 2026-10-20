const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const replicaCounts = [1, 3, 10];
const vuLevels = [20, 50, 100, 200, 500];
const results = [];

console.log('================================================================');
console.log('  INICIANDO SUITE AUTOMATIZADA: PUNTO DE DEGRADACIÓN (RETO 3)  ');
console.log('================================================================\n');

for (const replicas of replicaCounts) {
  console.log(`\n>>> [1/3] Ajustando Deployment a ${replicas} réplicas...`);
  try {
    execSync(`kubectl scale deployment distributed-app --replicas=${replicas}`, { stdio: 'inherit' });
    console.log('Esperando 10 segundos a que los Pods estén Ready...');
    execSync('powershell -Command "Start-Sleep -Seconds 10"');
    execSync('kubectl wait --for=condition=ready pod -l app=distributed-app --timeout=60s', { stdio: 'inherit' });
  } catch (e) {
    console.warn(`Aviso escalando a ${replicas} réplicas: ${e.message}`);
  }

  for (const vus of vuLevels) {
    console.log(`\n--- Ejecutando prueba: Réplicas=${replicas} | VUs=${vus} ---`);
    const summaryFile = path.join(__dirname, `summary_${replicas}rep_${vus}vus.json`);
    if (fs.existsSync(summaryFile)) fs.unlinkSync(summaryFile);

    const cmd = `k6 run -e TARGET_VUS=${vus} -e TEST_DURATION=20s --summary-export="${summaryFile}" degradation-test.js`;

    let exitPass = true;
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      exitPass = false;
      console.log(`[ALERTA] La prueba con ${vus} VUs no superó los thresholds (FAIL).`);
    }

    if (fs.existsSync(summaryFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
        const metrics = raw.metrics;

        const reqsRate = (metrics.http_reqs && metrics.http_reqs.values && metrics.http_reqs.values.rate) ? metrics.http_reqs.values.rate.toFixed(1) : 'N/A';
        const failedRate = (metrics.http_req_failed && metrics.http_req_failed.values) ? (metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : '0.00%';
        const avg = (metrics.http_req_duration && metrics.http_req_duration.values) ? metrics.http_req_duration.values.avg.toFixed(2) + 'ms' : 'N/A';
        const p95 = (metrics.http_req_duration && metrics.http_req_duration.values) ? metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms' : 'N/A';
        const max = (metrics.http_req_duration && metrics.http_req_duration.values) ? metrics.http_req_duration.values.max.toFixed(2) + 'ms' : 'N/A';
        const status = exitPass ? 'PASS' : 'FAIL';

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
      } catch (parseErr) {
        console.error('Error parseando json:', parseErr);
      }
    }
  }
}

console.log('\n\n================================================================');
console.log('                   TABLA FINAL DE DEGRADACIÓN                   ');
console.log('================================================================');
console.log('| Réplicas | VUs | Requests/s | Failed % | Avg | p(95) | Max | PASS/FAIL |');
console.log('|---|---|---|---|---|---|---|---|');
results.forEach(r => {
  console.log(`| ${r.replicas} | ${r.vus} | ${r.reqsRate} | ${r.failedRate} | ${r.avg} | ${r.p95} | ${r.max} | ${r.status} |`);
});
console.log('================================================================\n');

fs.writeFileSync(path.join(__dirname, 'degradation-results.json'), JSON.stringify(results, null, 2));
