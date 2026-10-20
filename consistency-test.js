import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

export const options = {
  scenarios: {
    concurrent_increments: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const successfulIncrements = new Counter('successful_increments');
const failedIncrements = new Counter('failed_increments');

export function setup() {
  console.log('--- INICIANDO PRUEBA DE CONSISTENCIA DISTRIBUIDA ---');
  console.log('Reseteando contador a 0 en el clúster...');
  const res = http.post('http://localhost:30080/reset');
  console.log(`Reset status: ${res.status}`);
  sleep(1);
  return { startTime: new Date().toISOString() };
}

export default function () {
  const res = http.post('http://localhost:30080/increment');

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  if (ok) {
    successfulIncrements.add(1);
    const data = res.json();
    if (__VU <= 5 || __VU >= 95) {
      console.log(
        `[CONCURRENCY] VU ${__VU} -> Pod Atendió: ${data.pod} | ` +
        `Modo: ${data.coordinationMode} | ` +
        `Contador: ${data.counter} | ` +
        `CoordPod: ${data.coordinatorPod || 'N/A'}`
      );
    }
  } else {
    failedIncrements.add(1);
    console.error(`[ERROR] VU ${__VU} falló: ${res.status}`);
  }
}

export function teardown(data) {
  sleep(1);
  console.log('--- EVALUANDO CONSISTENCIA FINAL ---');
  const res = http.get('http://localhost:30080/api/info');
  if (res.status === 200) {
    const finalData = res.json();
    console.log('==============================================');
    console.log(`Modo de Coordinación : ${finalData.coordinationMode}`);
    console.log(`Pod que respondió    : ${finalData.pod}`);
    console.log(`Contador Final Leído : ${finalData.counter}`);
    console.log(`Operaciones Lanzadas : 100`);
    console.log(`Resultado Esperado   : 100`);
    if (finalData.counter === 100) {
      console.log('ESTADO: CONSISTENCIA FUERTE PRESERVADA (100 / 100)');
    } else {
      console.log(`ESTADO: INCONSISTENCIA DETECTADA (${finalData.counter} / 100). Hubo ${100 - finalData.counter} actualizaciones perdidas.`);
    }
    console.log('==============================================');
  } else {
    console.error(`Error consultando estado final: ${res.status}`);
  }
}
