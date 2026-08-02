# VoteWise — Infrastructure as Code (Terraform)
# Production cloud infrastructure for VoteWise Election Platform.
# Deploy with: terraform init && terraform plan -var-file=tfvars/production.tfvars && terraform apply

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
variable "aws_region" { type = string; default = "eu-west-1" }
variable "project_name" { type = string; default = "votewise" }
variable "environment" {
  type = string
  default = "production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}
variable "domain" { type = string; default = "votewise.com.ng" }
variable "db_password" { type = string; sensitive = true }
variable "db_instance_class" {
  type = string
  default = "db.r6g.large"
  description = "RDS instance class — smaller for staging, larger for production."
}
variable "redis_node_type" {
  type = string
  default = "cache.r6g.large"
}
variable "app_min_replicas" { type = number; default = 3 }
variable "app_max_replicas" { type = number; default = 20 }
variable "worker_min_replicas" { type = number; default = 2 }
variable "worker_max_replicas" { type = number; default = 10 }
variable "multi_az" { type = bool; default = true }
variable "backup_retention_days" { type = number; default = 30 }

provider "aws" { region = var.aws_region }

# ---------------------------------------------------------------------------
# VPC — 2 AZ minimum for HA (spec: "multiple availability zones")
# ---------------------------------------------------------------------------
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "${var.project_name}-${var.environment}"
  cidr    = "10.0.0.0/16"
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = var.environment == "staging"   # cost optimisation for staging
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL — Primary (Multi-AZ, encrypted, PITR, automated backups)
# Spec: "Connection pooling, read replicas, automatic backups,
#        point-in-time recovery, high availability."
# ---------------------------------------------------------------------------
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 200
  storage_encrypted      = true
  db_name                = "votewise"
  username               = "votewise"
  password               = var.db_password
  multi_az               = var.multi_az
  backup_retention_period = var.backup_retention_days
  backup_window          = "02:00-03:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment == "staging"
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Spec: "Point-in-time recovery"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
}

# Read replica for reporting / analytics (spec: "Reporting should never
# slow down voting"). All RAEI analytics queries hit the replica.
resource "aws_db_instance" "postgres_replica" {
  identifier             = "${var.project_name}-db-replica-${var.environment}"
  replicate_source_db    = aws_db_instance.postgres.id
  instance_class         = var.db_instance_class
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  backup_retention_period = 0   # replicas can't have their own backups
}

# RDS Proxy — connection pooling (spec: "Connection pooling").
# Reduces connection overhead on the primary during traffic spikes by
# pooling and reusing database connections. The app connects to the proxy
# endpoint instead of the RDS endpoint directly.
resource "aws_db_proxy" "main" {
  name                   = "${var.project_name}-proxy-${var.environment}"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = module.vpc.private_subnets
  vpc_security_group_ids = [aws_security_group.db.id]

  target_role_arn = aws_iam_role.rds_proxy.arn
  auth {
    auth_scheme = "SECRETS"
    description = "RDS Proxy auth via Secrets Manager"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }
}

resource "aws_db_proxy_target" "main" {
  db_proxy_name          = aws_db_proxy.main.name
  db_instance_identifier = aws_db_instance.postgres.id
  target_group_name      = aws_db_proxy.main.name
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}-db-creds-${var.environment}"
  description = "Database credentials for RDS Proxy"
}

resource "aws_iam_role" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-policy"
  role = aws_iam_role.rds_proxy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.db_credentials.arn]
    }]
  })
}

# ---------------------------------------------------------------------------
# GuardDuty — Intrusion Detection (spec: "Intrusion detection")
# ---------------------------------------------------------------------------
resource "aws_guardduty_detector" "main" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
  datasources {
    s3_logs { enable = true }
    kubernetes { enable = var.environment == "production" ? true : false }
  }
}

# ---------------------------------------------------------------------------
# AWS Config — compliance + configuration drift detection
# ---------------------------------------------------------------------------
resource "aws_config_configuration_recorder" "main" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.config.arn
}

resource "aws_iam_role" "config" {
  name = "${var.project_name}-config-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "config.amazonaws.com" }
    }]
  })
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

# ---------------------------------------------------------------------------
# ElastiCache Redis — Multi-AZ, encrypted, automatic failover
# Spec: "Session storage, OTVP cache, rate limiting, queue backend,
#        temporary election state."
# ---------------------------------------------------------------------------
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.project_name}-redis-${var.environment}"
  description                   = "VoteWise Redis (${var.environment})"
  node_type                     = var.redis_node_type
  number_cache_clusters         = 2
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  automatic_failover_enabled    = true
  multi_az_enabled              = var.multi_az
  subnet_group_name             = aws_elasticache_subnet_group.main.name
  security_group_ids            = [aws_security_group.redis.id]
  snapshot_retention_limit      = 7
  snapshot_window               = "03:00-05:00"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

# ---------------------------------------------------------------------------
# S3 Object Storage — versioned, encrypted, lifecycle to Glacier
# Spec: "Store logos, attachments, reports, evidence, export files, audit archives."
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "storage" {
  bucket = "${var.project_name}-${var.environment}-storage"
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Multi-region backup bucket (spec: "Backups must be encrypted and stored
# in multiple regions.")
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-${var.environment}-backups"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_replication_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.replication.arn
  rules {
    id     = "cross-region-replication"
    status = "Enabled"
    destination { bucket = aws_s3_bucket.backups_dr.arn }
  }
}

resource "aws_s3_bucket" "backups_dr" {
  bucket = "${var.project_name}-${var.environment}-backups-dr"
  # Created in a different region via provider alias (see below).
  provider = aws.dr
}

provider "aws" {
  alias  = "dr"
  region = "eu-central-1"   # DR region (Frankfurt)
}

resource "aws_iam_role" "replication" {
  name = "${var.project_name}-s3-replication"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })
}

# ---------------------------------------------------------------------------
# ECS Cluster + Services (app, worker, scheduler, notification, fraud, analytics)
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
  setting { name = "containerInsights", value = "enabled" }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb-${var.environment}"
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-app-${var.environment}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id
  health_check {
    path                = "/api/pihed/health"
    matcher             = "200"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# ---------------------------------------------------------------------------
# Auto Scaling — target tracking on CPU + memory
# Spec: "Automatically increase resources based on CPU usage, memory usage,
#        active users, queue size, request rate."
# ---------------------------------------------------------------------------
resource "aws_appautoscaling_target" "app" {
  max_capacity       = var.app_max_replicas
  min_capacity       = var.app_min_replicas
  resource_id        = "service/${aws_ecs_cluster.main.name}/votewise-app"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "app_cpu" {
  name               = "${var.project_name}-app-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "app_memory" {
  name               = "${var.project_name}-app-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageMemoryUtilization" }
    target_value       = 80
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_replicas
  min_capacity       = var.worker_min_replicas
  resource_id        = "service/${aws_ecs_cluster.main.name}/votewise-worker"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${var.project_name}-worker-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
    target_value = 75
  }
}

# ---------------------------------------------------------------------------
# CloudWatch Alarms — alerting triggers
# Spec: "Critical events trigger alerts: server down, high CPU, queue failure,
#        database replication failure, SMS provider outage, payment gateway failure."
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${var.project_name}-db-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "db_replica_lag" {
  alarm_name          = "${var.project_name}-db-replica-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ReplicaLag"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 30   # seconds
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# SNS topic for alerts (email/SMS/Lambda subscriber fan-out)
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-${var.environment}"
}

# ---------------------------------------------------------------------------
# Route53 DNS — apex + wildcard for multi-tenant subdomains
# Spec: "mouau.verifyvotes.com, unilag.verifyvotes.com, company.verifyvotes.com"
# ---------------------------------------------------------------------------
resource "aws_route53_zone" "main" { name = var.domain }

resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Wildcard record for org subdomains (org.votewise.com.ng)
resource "aws_route53_record" "wildcard" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "*.${var.domain}"
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ACM certificate for apex + wildcard + custom domains (spec: "Automatic SSL")
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain
  subject_alternative_names = ["*.${var.domain}", "*.verifyvotes.com"]
  validation_method = "DNS"
}

# ---------------------------------------------------------------------------
# Security Groups
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name   = "${var.project_name}-alb-${var.environment}"
  vpc_id = module.vpc.vpc_id
  ingress { from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 80,  to_port = 80,  protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0,   to_port = 0,   protocol = "-1",  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "db" {
  name   = "${var.project_name}-db-${var.environment}"
  vpc_id = module.vpc.vpc_id
  ingress { from_port = 5432, to_port = 5432, protocol = "tcp", cidr_blocks = ["10.0.0.0/16"] }
  egress  { from_port = 0,    to_port = 0,    protocol = "-1",  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "redis" {
  name   = "${var.project_name}-redis-${var.environment}"
  vpc_id = module.vpc.vpc_id
  ingress { from_port = 6379, to_port = 6379, protocol = "tcp", cidr_blocks = ["10.0.0.0/16"] }
  egress  { from_port = 0,    to_port = 0,    protocol = "-1",  cidr_blocks = ["0.0.0.0/0"] }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "db_endpoint"          { value = aws_db_instance.postgres.endpoint }
output "db_proxy_endpoint"    { value = aws_db_proxy.main.endpoint }
output "db_replica_endpoint"  { value = aws_db_instance.postgres_replica.endpoint }
output "redis_endpoint"       { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
output "alb_dns"              { value = aws_lb.main.dns_name }
output "s3_storage_bucket"    { value = aws_s3_bucket.storage.bucket }
output "s3_backups_bucket"    { value = aws_s3_bucket.backups.bucket }
output "sns_alerts_topic"     { value = aws_sns_topic.alerts.arn }
output "acm_certificate_arn"  { value = aws_acm_certificate.main.arn }
