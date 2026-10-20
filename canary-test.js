import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

const v2Counter = new Counter('canary_v2_requests');
const v3Counter = new Counter('canary_v3_requests');
const v2Rate = new Rate('canary_v2_rate');
const v3Rate = new Rate('canary_v3_rate');

export default function () {
  const res = http.get('http://localhost:30080/api/info');

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has version field': (r) => r.body.includes('version'),
  });

  if (ok) {
    const data = res.json();
    const isV2 = data.version === 'v2';
    const isV3 = data.version === 'v3';

    if (isV2) {
      v2Counter.add(1);
      v2Rate.add(1);
      v3Rate.add(0);
    } else if (isV3) {
      v3Counter.add(1);
      v3Rate.add(1);
      v2Rate.add(0);
    }

    if (__ITER % 15 === 0) {
      console.log(
        `VU: ${__VU} | ` +
        `Iter: ${__ITER} | ` +
        `Pod: ${data.pod} | ` +
        `Versión: ${data.version} | ` +
        `Mensaje: ${data.message}`
      );
    }
  }

  sleep(0.1);
}

export function teardown() {
  console.log('--- REPORTE FINAL CANARY DEPLOYMENT ---');
  console.log('Distribución objetivo esperada : 80% v2 (Estable) / 20% v3 (Canary)');
  console.log('Verifique la tabla resumen en métricas para canary_v2_rate y canary_v3_rate.');
}
