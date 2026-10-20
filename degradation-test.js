import http from 'k6/http';
import { check, sleep } from 'k6';

const targetVUs = Number(__ENV.TARGET_VUS) || 20;
const testDuration = __ENV.TEST_DURATION || '20s';

export const options = {
  vus: targetVUs,
  duration: testDuration,
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Fallas toleradas < 1%
    http_req_duration: ['p(95)<250'],  // p(95) objetivo < 250ms
  },
};

export default function () {
  const res = http.get('http://localhost:30080/api/info');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Pausa constante controlada para garantizar comparación homogénea
  sleep(0.05);
}
