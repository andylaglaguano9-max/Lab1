# Laboratorio: Análisis de Consistencia y Disponibilidad en Kubernetes y k6

Este repositorio contiene la implementación completa del laboratorio integrador de aplicaciones distribuidas utilizando **Node.js**, **Docker**, **Kubernetes** y **Grafana k6**, incluyendo los tres retos independientes de consistencia de estado, despliegue progresivo (Canary) y punto de degradación.

---

## 📁 Estructura del Proyecto

```text
├── Dockerfile                      # Empaquetamiento de la aplicación en Node 22 Alpine
├── server.js                       # Servidor HTTP con endpoints /, /api/info, /increment y /health
├── service.js                      # Punto de entrada secundario
├── coordinator.js                  # Servicio Coordinador de Estado en Memoria (Reto 1)
│
├── deployment.yaml                 # Manifiesto base de Kubernetes (3 réplicas, readinessProbe)
├── service.yaml                    # Service NodePort (puerto 30080)
├── reto1-consistency.yaml          # Manifiesto Kubernetes para el Reto 1 (Coordinador y Réplicas)
├── reto2-canary.yaml               # Manifiesto Kubernetes para el Reto 2 (Canary 80/20)
│
├── smoke-test.js                   # k6: Verificación mínima de operatividad y balanceo
├── baseline-test.js                # k6: Línea base de rendimiento bajo carga (100 VUs)
├── resilience-test.js              # k6: Prueba de resiliencia y Self-Healing ante caída de Pod
├── update-test.js                  # k6: Tráfico continuo durante Rolling Update
├── consistency-test.js             # k6: Prueba de concurrencia y consistencia distribuida (Reto 1)
├── canary-test.js                  # k6: Medición de distribución de tráfico 80/20 (Reto 2)
├── degradation-test.js             # k6: Prueba de carga progresiva (Reto 3)
├── generate-degradation-table.js   # Generador de la matriz comparativa de degradación
└── run-degradation-suite.js        # Suite automatizada de pruebas para 1, 3 y 10 réplicas
```

---

## 🚀 Despliegue de la Aplicación Base

### 1. Construcción de imágenes Docker
```bash
docker build -t distributed-app:v2 .
docker tag distributed-app:v2 distributed-app:v3
```

### 2. Despliegue en Kubernetes
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl rollout status deployment/distributed-app
```

Acceso al servicio: [http://localhost:30080](http://localhost:30080)

---

## 🧪 Pruebas Experimentales con Grafana k6

### Smoke Test
```bash
k6 run smoke-test.js
```

### Baseline Test (Línea base)
```bash
k6 run baseline-test.js
```

### Resilience Test (Self-Healing)
Ejecutar la prueba de carga y eliminar deliberadamente un Pod para observar la auto-recuperación en tiempo real:
```bash
k6 run resilience-test.js
# En otra terminal:
kubectl delete pod -l app=distributed-app --wait=false
```

---

## 🎯 Retos Independientes

### Reto 1: Consistencia del Estado Distribuido
* **Línea Base Inconsistente (sin coordinador):**
  ```bash
  k6 run consistency-test.js
  # Resultado: 100 operaciones concurrentes -> Contador = ~30 (70 actualizaciones perdidas por memoria aislada).
  ```

* **Consistencia Fuerte (con State Coordinator en memoria):**
  ```bash
  kubectl apply -f reto1-consistency.yaml
  kubectl scale deployment distributed-app --replicas=0
  kubectl rollout status deployment/counter-coordinator
  k6 run consistency-test.js
  # Resultado: 100 operaciones concurrentes -> Contador = 100 / 100 (Consistencia linealizable).
  ```

---

### Reto 2: Canary Deployment (80% Estable / 20% Candidata)
Despliega 4 réplicas de la versión estable (`v2`) y 1 réplica de la versión candidata (`v3`):
```bash
kubectl delete -f reto1-consistency.yaml --ignore-not-found
kubectl apply -f reto2-canary.yaml
kubectl get pods -l app=distributed-app -L track,app
k6 run canary-test.js
```
* **Resultado observado:** 80.39% del tráfico dirigido a `v2` y 19.60% hacia `v3`.

---

### Reto 3: Punto de Degradación del Sistema
Restaurar el deployment base y ejecutar la suite progresiva evaluando 1, 3 y 10 réplicas frente a 20, 50, 100, 200 y 500 VUs:
```bash
kubectl delete -f reto2-canary.yaml --ignore-not-found
kubectl apply -f deployment.yaml
node run-degradation-suite.js
node generate-degradation-table.js
```
