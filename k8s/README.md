# VoteWise — Kubernetes Manifests (EKS / AKS / GKE)

These manifests deploy the full VoteWise stack to any Kubernetes cluster.
They are environment-agnostic — override `env` values via ConfigMaps and
Secrets per environment (staging / production).

## Architecture

```
Ingress (NGINX / ALB Ingress)
   ├── app (Next.js) × HPA (2–20 replicas)
   ├── results-service (Socket.io) × 2 replicas
   ├── worker (background jobs) × 2 replicas
   ├── scheduler (cron) × 1 replica (leader-election)
   ├── notification-service × 2 replicas
   ├── fraud-engine × 1 replica
   └── analytics-engine × 1 replica

PostgreSQL — managed (RDS / Cloud SQL) via externalName service
Redis      — managed (ElastiCache) via externalName service
S3 / R2    — object storage (no pod)
```

## Apply order

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/results-service.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/scheduler.yaml
kubectl apply -f k8s/notification.yaml
kubectl apply -f k8s/fraud-engine.yaml
kubectl apply -f k8s/analytics-engine.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/networkpolicy.yaml
```

## Migration from Docker Compose

No code changes required. The same Docker images are used. Only the
orchestration layer changes. The `docker-compose.yml` file remains the
recommended path for single-server / small-org deployments.
